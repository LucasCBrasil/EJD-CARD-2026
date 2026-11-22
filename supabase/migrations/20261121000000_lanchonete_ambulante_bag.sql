-- =============================================================================
-- Estoque individual (Bag) para Vendas Ambulantes da Lanchonete
--
-- Permite que vendedores da lanchonete retirem itens do estoque geral para sua
-- bag pessoal, realizem vendas debitando apenas da propria bag e devolvam
-- sobras ao estoque geral.
--
-- Ordem de locks (evita deadlock):
--   app_users -> lanchonete_ambulante_bags -> products (sempre ORDER BY id)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Expandir origin em sales para suportar 'ambulante'
-- ---------------------------------------------------------------------------
ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_origin_check;
ALTER TABLE public.sales
  ADD CONSTRAINT sales_origin_check
  CHECK (origin IN ('balcao', 'autoatendimento', 'ambulante'));

-- ---------------------------------------------------------------------------
-- 2. Tabela da bag de cada ambulante
-- ---------------------------------------------------------------------------
CREATE TABLE public.lanchonete_ambulante_bags (
  user_id UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, product_id)
);

CREATE INDEX idx_ambulante_bags_user_id ON public.lanchonete_ambulante_bags(user_id);
CREATE INDEX idx_ambulante_bags_product_id ON public.lanchonete_ambulante_bags(product_id);

CREATE TRIGGER update_lanchonete_ambulante_bags_updated_at
BEFORE UPDATE ON public.lanchonete_ambulante_bags
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seguranca: acesso apenas via service_role (Edge Functions)
ALTER TABLE public.lanchonete_ambulante_bags ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.lanchonete_ambulante_bags FROM PUBLIC, anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public.lanchonete_ambulante_bags TO service_role;
CREATE POLICY block_direct_api_access ON public.lanchonete_ambulante_bags
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- ---------------------------------------------------------------------------
-- 3. Funcao: Retirar itens do estoque geral para a bag do ambulante
--    p_items: [{"productId": "<uuid>", "quantity": <int>}, ...]
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.take_to_ambulante_bag(
  p_seller_id UUID,
  p_items JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_product_ids UUID[];
  v_quantities INTEGER[];
  v_bad RECORD;
BEGIN
  IF p_seller_id IS NULL OR p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'INVALID_REQUEST' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_items) AS item
    WHERE jsonb_typeof(item) <> 'object'
       OR jsonb_typeof(item -> 'productId') IS DISTINCT FROM 'string'
       OR (item ->> 'productId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       OR jsonb_typeof(item -> 'quantity') IS DISTINCT FROM 'number'
       OR (item ->> 'quantity')::NUMERIC <> TRUNC((item ->> 'quantity')::NUMERIC)
       OR (item ->> 'quantity')::NUMERIC < 1
  ) THEN
    RAISE EXCEPTION 'INVALID_ITEM' USING ERRCODE = '22023';
  END IF;

  SELECT array_agg(grouped.product_id ORDER BY grouped.product_id),
         array_agg(grouped.quantity ORDER BY grouped.product_id)
  INTO v_product_ids, v_quantities
  FROM (
    SELECT (item ->> 'productId')::UUID AS product_id,
           SUM((item ->> 'quantity')::INTEGER)::INTEGER AS quantity
    FROM jsonb_array_elements(p_items) AS item
    GROUP BY 1
  ) AS grouped;

  -- Trava linhas existentes da bag e dos produtos em ordem deterministica
  PERFORM 1
  FROM public.lanchonete_ambulante_bags AS bag
  WHERE bag.user_id = p_seller_id
    AND bag.product_id = ANY(v_product_ids)
  ORDER BY bag.product_id
  FOR UPDATE;

  PERFORM 1
  FROM public.products AS product
  WHERE product.id = ANY(v_product_ids)
  ORDER BY product.id
  FOR UPDATE;

  -- Verifica se produtos existem, estao ativos e sao da lanchonete
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

  -- Verifica se ha estoque suficiente no estoque geral
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

  -- Desconta do estoque geral
  UPDATE public.products AS product
  SET stock = product.stock - requested.quantity
  FROM unnest(v_product_ids, v_quantities) AS requested(product_id, quantity)
  WHERE product.id = requested.product_id
    AND product.stock IS NOT NULL;

  -- Adiciona na bag do ambulante
  INSERT INTO public.lanchonete_ambulante_bags (user_id, product_id, quantity)
  SELECT p_seller_id, requested.product_id, requested.quantity
  FROM unnest(v_product_ids, v_quantities) AS requested(product_id, quantity)
  ON CONFLICT (user_id, product_id) DO UPDATE
  SET quantity = public.lanchonete_ambulante_bags.quantity + EXCLUDED.quantity;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. Funcao: Devolver itens da bag do ambulante para o estoque geral
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.return_from_ambulante_bag(
  p_seller_id UUID,
  p_items JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_product_ids UUID[];
  v_quantities INTEGER[];
  v_bad RECORD;
BEGIN
  IF p_seller_id IS NULL OR p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'INVALID_REQUEST' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_items) AS item
    WHERE jsonb_typeof(item) <> 'object'
       OR jsonb_typeof(item -> 'productId') IS DISTINCT FROM 'string'
       OR (item ->> 'productId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       OR jsonb_typeof(item -> 'quantity') IS DISTINCT FROM 'number'
       OR (item ->> 'quantity')::NUMERIC <> TRUNC((item ->> 'quantity')::NUMERIC)
       OR (item ->> 'quantity')::NUMERIC < 1
  ) THEN
    RAISE EXCEPTION 'INVALID_ITEM' USING ERRCODE = '22023';
  END IF;

  SELECT array_agg(grouped.product_id ORDER BY grouped.product_id),
         array_agg(grouped.quantity ORDER BY grouped.product_id)
  INTO v_product_ids, v_quantities
  FROM (
    SELECT (item ->> 'productId')::UUID AS product_id,
           SUM((item ->> 'quantity')::INTEGER)::INTEGER AS quantity
    FROM jsonb_array_elements(p_items) AS item
    GROUP BY 1
  ) AS grouped;

  PERFORM 1
  FROM public.lanchonete_ambulante_bags AS bag
  WHERE bag.user_id = p_seller_id
    AND bag.product_id = ANY(v_product_ids)
  ORDER BY bag.product_id
  FOR UPDATE;

  PERFORM 1
  FROM public.products AS product
  WHERE product.id = ANY(v_product_ids)
  ORDER BY product.id
  FOR UPDATE;

  -- Verifica se o ambulante possui na bag a quantidade que quer devolver
  SELECT requested.product_id, product.name, COALESCE(bag.quantity, 0) AS available
  INTO v_bad
  FROM unnest(v_product_ids, v_quantities) AS requested(product_id, quantity)
  LEFT JOIN public.lanchonete_ambulante_bags AS bag
    ON bag.user_id = p_seller_id AND bag.product_id = requested.product_id
  LEFT JOIN public.products AS product
    ON product.id = requested.product_id
  WHERE COALESCE(bag.quantity, 0) < requested.quantity
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'INSUFFICIENT_BAG_STOCK'
      USING ERRCODE = 'P0001',
            DETAIL = jsonb_build_object(
              'productId', v_bad.product_id,
              'productName', v_bad.name,
              'available', v_bad.available
            )::TEXT;
  END IF;

  -- Subtrai da bag do ambulante
  UPDATE public.lanchonete_ambulante_bags AS bag
  SET quantity = bag.quantity - requested.quantity
  FROM unnest(v_product_ids, v_quantities) AS requested(product_id, quantity)
  WHERE bag.user_id = p_seller_id
    AND bag.product_id = requested.product_id;

  -- Remove linhas zeradas para manter a bag limpa
  DELETE FROM public.lanchonete_ambulante_bags
  WHERE user_id = p_seller_id
    AND quantity = 0;

  -- Devolve ao estoque geral
  UPDATE public.products AS product
  SET stock = product.stock + requested.quantity
  FROM unnest(v_product_ids, v_quantities) AS requested(product_id, quantity)
  WHERE product.id = requested.product_id
    AND product.stock IS NOT NULL;
END;
$$;

-- ---------------------------------------------------------------------------
-- 5. Funcao: Finalizar venda ambulante (deduzindo da bag do vendedor)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.make_ambulante_sale(
  p_user_id UUID,
  p_seller_id UUID,
  p_items JSONB,
  p_coupon TEXT DEFAULT NULL
)
RETURNS TABLE(sale_id UUID, sale_number BIGINT, total NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_product_ids UUID[];
  v_quantities INTEGER[];
  v_balance NUMERIC(10, 2);
  v_subtotal NUMERIC(10, 2);
  v_discount NUMERIC(10, 2) := 0;
  v_total NUMERIC(10, 2);
  v_sale public.sales%ROWTYPE;
  v_bad RECORD;
BEGIN
  IF p_user_id IS NULL OR p_seller_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_REQUEST' USING ERRCODE = '22023';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'EMPTY_CART' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_items) AS item
    WHERE jsonb_typeof(item) <> 'object'
       OR jsonb_typeof(item -> 'productId') IS DISTINCT FROM 'string'
       OR (item ->> 'productId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       OR jsonb_typeof(item -> 'quantity') IS DISTINCT FROM 'number'
       OR (item ->> 'quantity')::NUMERIC <> TRUNC((item ->> 'quantity')::NUMERIC)
       OR (item ->> 'quantity')::NUMERIC < 1
  ) THEN
    RAISE EXCEPTION 'INVALID_ITEM' USING ERRCODE = '22023';
  END IF;

  SELECT array_agg(grouped.product_id ORDER BY grouped.product_id),
         array_agg(grouped.quantity ORDER BY grouped.product_id)
  INTO v_product_ids, v_quantities
  FROM (
    SELECT (item ->> 'productId')::UUID AS product_id,
           SUM((item ->> 'quantity')::INTEGER)::INTEGER AS quantity
    FROM jsonb_array_elements(p_items) AS item
    GROUP BY 1
  ) AS grouped;

  -- Trava conta do cliente
  SELECT account.balance
  INTO v_balance
  FROM public.app_users AS account
  WHERE account.id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account not found' USING ERRCODE = 'P0002';
  END IF;

  -- Trava bag do vendedor e produtos
  PERFORM 1
  FROM public.lanchonete_ambulante_bags AS bag
  WHERE bag.user_id = p_seller_id
    AND bag.product_id = ANY(v_product_ids)
  ORDER BY bag.product_id
  FOR UPDATE;

  PERFORM 1
  FROM public.products AS product
  WHERE product.id = ANY(v_product_ids)
  ORDER BY product.id
  FOR UPDATE;

  -- Verifica se produtos existem e estao ativos
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

  -- Verifica se o vendedor tem estoque suficiente NA BAG
  SELECT requested.product_id, product.name, COALESCE(bag.quantity, 0) AS available
  INTO v_bad
  FROM unnest(v_product_ids, v_quantities) AS requested(product_id, quantity)
  JOIN public.products AS product ON product.id = requested.product_id
  LEFT JOIN public.lanchonete_ambulante_bags AS bag
    ON bag.user_id = p_seller_id AND bag.product_id = requested.product_id
  WHERE COALESCE(bag.quantity, 0) < requested.quantity
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'INSUFFICIENT_BAG_STOCK'
      USING ERRCODE = 'P0001',
            DETAIL = jsonb_build_object(
              'productId', v_bad.product_id,
              'productName', v_bad.name,
              'available', v_bad.available
            )::TEXT;
  END IF;

  -- Calcula subtotal pelo preco oficial do banco
  SELECT ROUND(SUM(product.price * requested.quantity), 2)
  INTO v_subtotal
  FROM unnest(v_product_ids, v_quantities) AS requested(product_id, quantity)
  JOIN public.products AS product ON product.id = requested.product_id;

  -- Valida cupom da lanchonete, se enviado
  IF p_coupon IS NOT NULL AND BTRIM(p_coupon) <> '' THEN
    SELECT c.discount_amount
    INTO v_discount
    FROM public.lanchonete_coupons AS c
    WHERE c.name = BTRIM(p_coupon)
      AND c.active IS TRUE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'COUPON_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  v_total := GREATEST(0, ROUND(v_subtotal - COALESCE(v_discount, 0), 2));

  IF v_total <= 0 THEN
    RAISE EXCEPTION 'INVALID_TOTAL' USING ERRCODE = 'P0001';
  END IF;

  IF v_balance < v_total THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE' USING ERRCODE = 'P0001';
  END IF;

  -- Cria venda com origin = 'ambulante'
  INSERT INTO public.sales (
    user_id, seller_id, category, total, status, origin
  )
  VALUES (
    p_user_id, p_seller_id, 'lanchonete', v_total, 'completed', 'ambulante'
  )
  RETURNING * INTO v_sale;

  -- Cria itens da venda
  INSERT INTO public.sale_items (sale_id, product_id, product_name, quantity, price)
  SELECT v_sale.id, product.id, product.name, requested.quantity, product.price
  FROM unnest(v_product_ids, v_quantities) AS requested(product_id, quantity)
  JOIN public.products AS product ON product.id = requested.product_id;

  -- Desconta da bag do ambulante
  UPDATE public.lanchonete_ambulante_bags AS bag
  SET quantity = bag.quantity - requested.quantity
  FROM unnest(v_product_ids, v_quantities) AS requested(product_id, quantity)
  WHERE bag.user_id = p_seller_id
    AND bag.product_id = requested.product_id;

  DELETE FROM public.lanchonete_ambulante_bags
  WHERE user_id = p_seller_id
    AND quantity = 0;

  -- Debita saldo do cliente
  PERFORM *
  FROM public.adjust_account_balance(
    p_user_id,
    v_total,
    'debit',
    format('Venda lanchonete (ambulante) - %s itens', array_length(v_product_ids, 1)),
    p_seller_id::TEXT
  );

  RETURN QUERY SELECT v_sale.id, v_sale.sale_number, v_sale.total;
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. Privilegios: apenas service_role executa as funcoes
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.take_to_ambulante_bag(UUID, JSONB)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.return_from_ambulante_bag(UUID, JSONB)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.make_ambulante_sale(UUID, UUID, JSONB, TEXT)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.take_to_ambulante_bag(UUID, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.return_from_ambulante_bag(UUID, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.make_ambulante_sale(UUID, UUID, JSONB, TEXT) TO service_role;