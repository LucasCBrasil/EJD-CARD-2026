-- =============================================================================
-- Pedido de autoatendimento na Lanchonete
--
-- Permite que o proprio usuario faca o pedido usando o proprio saldo. A venda
-- de balcao (make-sale) continua igual, com status 'completed'.
--
-- Fluxo do pedido: pending -> preparing -> ready -> delivered
--                  pending|preparing|ready -> cancelled (com estorno)
--
-- Ordem de locks em todas as funcoes (evita deadlock):
--   sales -> app_users -> products (products sempre ORDER BY id)
--
-- Rollback: supabase/rollbacks/20261025200000_lanchonete_self_order_down.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Colunas e constraints em sales
-- ---------------------------------------------------------------------------
ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_status_check;
ALTER TABLE public.sales
  ADD CONSTRAINT sales_status_check
  CHECK (status IN ('completed', 'delivered', 'pending', 'preparing', 'ready', 'cancelled'));

ALTER TABLE public.sales
  ADD COLUMN origin TEXT NOT NULL DEFAULT 'balcao'
    CONSTRAINT sales_origin_check CHECK (origin IN ('balcao', 'autoatendimento')),
  ADD COLUMN client_request_id UUID,
  ADD COLUMN status_updated_at TIMESTAMPTZ,
  ADD COLUMN status_updated_by UUID REFERENCES public.app_users(id) ON DELETE SET NULL;

-- Idempotencia: o mesmo request do mesmo usuario nunca gera dois pedidos
CREATE UNIQUE INDEX sales_user_client_request_uidx
  ON public.sales (user_id, client_request_id)
  WHERE client_request_id IS NOT NULL;

-- Fila de pedidos em aberto da Lanchonete
CREATE INDEX idx_sales_lanchonete_open_orders
  ON public.sales (created_at)
  WHERE category = 'lanchonete' AND status IN ('pending', 'preparing', 'ready');

-- ---------------------------------------------------------------------------
-- Feature flag (comeca desligada; admin liga pela tela de Feature Flags)
-- ---------------------------------------------------------------------------
INSERT INTO public.feature_flags (key, enabled, description)
VALUES ('lanchonete_self_order', FALSE, 'Habilita pedidos de autoatendimento na Lanchonete')
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Criar pedido de autoatendimento
--
-- p_items: [{"productId": "<uuid>", "quantity": <int>}, ...]
-- Preco, nome e total vem sempre do banco. Tudo roda em uma transacao:
-- qualquer erro desfaz venda, itens, estoque e debito.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_lanchonete_self_order(
  p_user_id UUID,
  p_items JSONB,
  p_request_id UUID
)
RETURNS TABLE(sale_id UUID, sale_number BIGINT, total NUMERIC, new_balance NUMERIC, already_existed BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  c_max_lines CONSTANT INTEGER := 50;
  c_max_qty_per_item CONSTANT INTEGER := 10;
  c_max_qty_per_order CONSTANT INTEGER := 20;
  c_max_open_orders CONSTANT INTEGER := 3;
  v_product_ids UUID[];
  v_quantities INTEGER[];
  v_balance NUMERIC(10, 2);
  v_total NUMERIC(10, 2);
  v_sale public.sales%ROWTYPE;
  v_open_orders INTEGER;
  v_flag_enabled BOOLEAN;
  v_bad RECORD;
BEGIN
  IF p_user_id IS NULL OR p_request_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_REQUEST' USING ERRCODE = '22023';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'EMPTY_CART' USING ERRCODE = '22023';
  END IF;

  IF jsonb_array_length(p_items) > c_max_lines THEN
    RAISE EXCEPTION 'TOO_MANY_ITEMS' USING ERRCODE = '22023';
  END IF;

  -- Formato de cada item (CASE garante que o cast so roda em valor valido)
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_items) AS item
    WHERE CASE
      WHEN jsonb_typeof(item) <> 'object' THEN TRUE
      WHEN jsonb_typeof(item -> 'productId') IS DISTINCT FROM 'string' THEN TRUE
      ELSE (item ->> 'productId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    END
  ) THEN
    RAISE EXCEPTION 'INVALID_ITEM' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_items) AS item
    WHERE CASE
      WHEN jsonb_typeof(item -> 'quantity') IS DISTINCT FROM 'number' THEN TRUE
      ELSE (item ->> 'quantity')::NUMERIC <> TRUNC((item ->> 'quantity')::NUMERIC)
        OR (item ->> 'quantity')::NUMERIC < 1
        OR (item ->> 'quantity')::NUMERIC > c_max_qty_per_item
    END
  ) THEN
    RAISE EXCEPTION 'INVALID_QUANTITY' USING ERRCODE = '22023';
  END IF;

  -- Agrupa produtos repetidos, ordenando por id (ordem dos locks)
  SELECT array_agg(grouped.product_id ORDER BY grouped.product_id),
         array_agg(grouped.quantity ORDER BY grouped.product_id)
  INTO v_product_ids, v_quantities
  FROM (
    SELECT (item ->> 'productId')::UUID AS product_id,
           SUM((item ->> 'quantity')::INTEGER)::INTEGER AS quantity
    FROM jsonb_array_elements(p_items) AS item
    GROUP BY 1
  ) AS grouped;

  IF EXISTS (SELECT 1 FROM unnest(v_quantities) AS qty WHERE qty > c_max_qty_per_item) THEN
    RAISE EXCEPTION 'INVALID_QUANTITY' USING ERRCODE = '22023';
  END IF;

  IF (SELECT SUM(qty) FROM unnest(v_quantities) AS qty) > c_max_qty_per_order THEN
    RAISE EXCEPTION 'ORDER_TOO_LARGE' USING ERRCODE = '22023';
  END IF;

  -- Trava a conta: serializa pedidos simultaneos do mesmo usuario
  SELECT account.balance
  INTO v_balance
  FROM public.app_users AS account
  WHERE account.id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account not found' USING ERRCODE = 'P0002';
  END IF;

  -- Retry do mesmo pedido devolve o pedido ja criado
  SELECT s.*
  INTO v_sale
  FROM public.sales AS s
  WHERE s.user_id = p_user_id
    AND s.client_request_id = p_request_id;

  IF FOUND THEN
    RETURN QUERY SELECT v_sale.id, v_sale.sale_number, v_sale.total, v_balance, TRUE;
    RETURN;
  END IF;

  SELECT flag.enabled
  INTO v_flag_enabled
  FROM public.feature_flags AS flag
  WHERE flag.key = 'lanchonete_self_order';

  IF v_flag_enabled IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'SELF_ORDER_DISABLED' USING ERRCODE = 'P0001';
  END IF;

  SELECT COUNT(*)
  INTO v_open_orders
  FROM public.sales AS s
  WHERE s.user_id = p_user_id
    AND s.category = 'lanchonete'
    AND s.origin = 'autoatendimento'
    AND s.status IN ('pending', 'preparing', 'ready');

  IF v_open_orders >= c_max_open_orders THEN
    RAISE EXCEPTION 'TOO_MANY_OPEN_ORDERS' USING ERRCODE = 'P0001';
  END IF;

  PERFORM 1
  FROM public.products AS product
  WHERE product.id = ANY(v_product_ids)
  ORDER BY product.id
  FOR UPDATE;

  SELECT requested.product_id, product.name
  INTO v_bad
  FROM unnest(v_product_ids) AS requested(product_id)
  LEFT JOIN public.products AS product ON product.id = requested.product_id
  WHERE product.id IS NULL
     OR product.category <> 'lanchonete'
     OR product.active IS NOT TRUE
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'PRODUCT_UNAVAILABLE'
      USING ERRCODE = 'P0001',
            DETAIL = jsonb_build_object('productId', v_bad.product_id, 'productName', v_bad.name)::TEXT;
  END IF;

  SELECT requested.product_id, product.name, product.stock
  INTO v_bad
  FROM unnest(v_product_ids, v_quantities) AS requested(product_id, quantity)
  JOIN public.products AS product ON product.id = requested.product_id
  WHERE product.stock IS NOT NULL
    AND product.stock < requested.quantity
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'OUT_OF_STOCK'
      USING ERRCODE = 'P0001',
            DETAIL = jsonb_build_object(
              'productId', v_bad.product_id,
              'productName', v_bad.name,
              'available', v_bad.stock
            )::TEXT;
  END IF;

  SELECT ROUND(SUM(product.price * requested.quantity), 2)
  INTO v_total
  FROM unnest(v_product_ids, v_quantities) AS requested(product_id, quantity)
  JOIN public.products AS product ON product.id = requested.product_id;

  IF v_balance < v_total THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.sales (
    user_id, seller_id, category, total, status, origin,
    client_request_id, status_updated_at, status_updated_by
  )
  VALUES (
    p_user_id, NULL, 'lanchonete', v_total, 'pending', 'autoatendimento',
    p_request_id, NOW(), p_user_id
  )
  RETURNING * INTO v_sale;

  INSERT INTO public.sale_items (sale_id, product_id, product_name, quantity, price)
  SELECT v_sale.id, product.id, product.name, requested.quantity, product.price
  FROM unnest(v_product_ids, v_quantities) AS requested(product_id, quantity)
  JOIN public.products AS product ON product.id = requested.product_id;

  UPDATE public.products AS product
  SET stock = product.stock - requested.quantity
  FROM unnest(v_product_ids, v_quantities) AS requested(product_id, quantity)
  WHERE product.id = requested.product_id
    AND product.stock IS NOT NULL;

  SELECT adjustment.new_balance
  INTO v_balance
  FROM public.adjust_account_balance(
    p_user_id,
    v_total,
    'debit',
    format('Pedido Lanchonete #%s', v_sale.sale_number),
    p_user_id::TEXT
  ) AS adjustment;

  RETURN QUERY SELECT v_sale.id, v_sale.sale_number, v_sale.total, v_balance, FALSE;
END;
$$;

-- ---------------------------------------------------------------------------
-- Avancar status (equipe da Lanchonete)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_lanchonete_order_status(
  p_sale_id UUID,
  p_new_status TEXT,
  p_actor_id UUID
)
RETURNS TABLE(sale_id UUID, sale_number BIGINT, status TEXT, status_updated_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_sale public.sales%ROWTYPE;
  v_expected_current TEXT;
BEGIN
  v_expected_current := CASE p_new_status
    WHEN 'preparing' THEN 'pending'
    WHEN 'ready' THEN 'preparing'
    WHEN 'delivered' THEN 'ready'
  END;

  IF v_expected_current IS NULL THEN
    RAISE EXCEPTION 'INVALID_STATUS' USING ERRCODE = '22023';
  END IF;

  SELECT s.*
  INTO v_sale
  FROM public.sales AS s
  WHERE s.id = p_sale_id
    AND s.category = 'lanchonete'
    AND s.origin = 'autoatendimento'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_sale.status <> v_expected_current THEN
    RAISE EXCEPTION 'INVALID_STATUS_TRANSITION'
      USING ERRCODE = 'P0001',
            DETAIL = jsonb_build_object('currentStatus', v_sale.status)::TEXT;
  END IF;

  UPDATE public.sales AS s
  SET status = p_new_status,
      status_updated_at = NOW(),
      status_updated_by = p_actor_id,
      delivered_at = CASE WHEN p_new_status = 'delivered' THEN NOW() ELSE s.delivered_at END
  WHERE s.id = v_sale.id
  RETURNING * INTO v_sale;

  RETURN QUERY SELECT v_sale.id, v_sale.sale_number, v_sale.status, v_sale.status_updated_at;
END;
$$;

-- ---------------------------------------------------------------------------
-- Cancelar pedido com estorno integral (saldo + estoque)
--
-- Usuario: so o proprio pedido e so em 'pending'.
-- Equipe (p_is_staff): ate 'ready'. p_is_staff so e confiavel porque a funcao
-- e executavel apenas pelo service_role, depois da checagem de role na Edge Function.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_lanchonete_order(
  p_sale_id UUID,
  p_actor_id UUID,
  p_is_staff BOOLEAN
)
RETURNS TABLE(sale_id UUID, sale_number BIGINT, refunded_amount NUMERIC, new_balance NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_sale public.sales%ROWTYPE;
  v_balance NUMERIC(10, 2);
BEGIN
  IF p_actor_id IS NULL OR p_is_staff IS NULL THEN
    RAISE EXCEPTION 'INVALID_REQUEST' USING ERRCODE = '22023';
  END IF;

  SELECT s.*
  INTO v_sale
  FROM public.sales AS s
  WHERE s.id = p_sale_id
    AND s.category = 'lanchonete'
    AND s.origin = 'autoatendimento'
  FOR UPDATE;

  -- Pedido de outra pessoa responde igual a inexistente (nao revela que existe)
  IF NOT FOUND OR (NOT p_is_staff AND v_sale.user_id IS DISTINCT FROM p_actor_id) THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF (p_is_staff AND v_sale.status NOT IN ('pending', 'preparing', 'ready'))
     OR (NOT p_is_staff AND v_sale.status <> 'pending') THEN
    RAISE EXCEPTION 'INVALID_STATUS_TRANSITION'
      USING ERRCODE = 'P0001',
            DETAIL = jsonb_build_object('currentStatus', v_sale.status)::TEXT;
  END IF;

  IF v_sale.user_id IS NULL THEN
    RAISE EXCEPTION 'Account not found' USING ERRCODE = 'P0002';
  END IF;

  PERFORM 1
  FROM public.app_users AS account
  WHERE account.id = v_sale.user_id
  FOR UPDATE;

  PERFORM 1
  FROM public.products AS product
  WHERE product.id IN (SELECT item.product_id FROM public.sale_items AS item WHERE item.sale_id = v_sale.id)
  ORDER BY product.id
  FOR UPDATE;

  UPDATE public.products AS product
  SET stock = product.stock + returned.quantity
  FROM (
    SELECT item.product_id, SUM(item.quantity)::INTEGER AS quantity
    FROM public.sale_items AS item
    WHERE item.sale_id = v_sale.id
    GROUP BY item.product_id
  ) AS returned
  WHERE product.id = returned.product_id
    AND product.stock IS NOT NULL;

  UPDATE public.sales AS s
  SET status = 'cancelled',
      status_updated_at = NOW(),
      status_updated_by = p_actor_id
  WHERE s.id = v_sale.id;

  SELECT adjustment.new_balance
  INTO v_balance
  FROM public.adjust_account_balance(
    v_sale.user_id,
    v_sale.total,
    'credit',
    format('Estorno pedido Lanchonete #%s', v_sale.sale_number),
    p_actor_id::TEXT
  ) AS adjustment;

  RETURN QUERY SELECT v_sale.id, v_sale.sale_number, v_sale.total, v_balance;
END;
$$;

-- ---------------------------------------------------------------------------
-- Privilegios: so as Edge Functions (service_role) executam
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.create_lanchonete_self_order(UUID, JSONB, UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_lanchonete_order_status(UUID, TEXT, UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancel_lanchonete_order(UUID, UUID, BOOLEAN)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_lanchonete_self_order(UUID, JSONB, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_lanchonete_order_status(UUID, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_lanchonete_order(UUID, UUID, BOOLEAN) TO service_role;
