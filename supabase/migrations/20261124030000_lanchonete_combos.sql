ALTER TABLE public.products
  ADD COLUMN is_combo BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE public.product_combo_items (
  combo_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  component_product_id UUID NOT NULL REFERENCES public.products(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  PRIMARY KEY (combo_id, component_product_id),
  CHECK (combo_id <> component_product_id)
);

CREATE INDEX idx_product_combo_items_component
  ON public.product_combo_items(component_product_id);
ALTER TABLE public.product_combo_items ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.sale_item_components (
  sale_item_id UUID NOT NULL REFERENCES public.sale_items(id) ON DELETE CASCADE,
  component_product_id UUID NOT NULL REFERENCES public.products(id),
  quantity_per_combo INTEGER NOT NULL CHECK (quantity_per_combo > 0),
  PRIMARY KEY (sale_item_id, component_product_id)
);

CREATE INDEX idx_sale_item_components_product
  ON public.sale_item_components(component_product_id);
ALTER TABLE public.sale_item_components ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.create_lanchonete_combo(
  p_name TEXT,
  p_price NUMERIC,
  p_components JSONB
)
RETURNS public.products
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_combo public.products%ROWTYPE;
  v_component_count INTEGER;
BEGIN
  IF p_name IS NULL OR LENGTH(BTRIM(p_name)) = 0 OR LENGTH(BTRIM(p_name)) > 120
     OR p_price IS NULL OR p_price <= 0 OR p_price >= 100000000 THEN
    RAISE EXCEPTION 'INVALID_COMBO' USING ERRCODE = '22023';
  END IF;

  IF p_components IS NULL OR jsonb_typeof(p_components) <> 'array'
     OR jsonb_array_length(p_components) < 2 OR jsonb_array_length(p_components) > 20 THEN
    RAISE EXCEPTION 'INVALID_COMBO_COMPONENTS' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_components) AS component
    WHERE CASE
      WHEN jsonb_typeof(component) <> 'object' THEN TRUE
      WHEN jsonb_typeof(component -> 'productId') IS DISTINCT FROM 'string' THEN TRUE
      WHEN (component ->> 'productId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN TRUE
      WHEN jsonb_typeof(component -> 'quantity') IS DISTINCT FROM 'number' THEN TRUE
      ELSE (component ->> 'quantity')::NUMERIC <> TRUNC((component ->> 'quantity')::NUMERIC)
        OR (component ->> 'quantity')::NUMERIC < 1
        OR (component ->> 'quantity')::NUMERIC > 10
    END
  ) THEN
    RAISE EXCEPTION 'INVALID_COMBO_COMPONENTS' USING ERRCODE = '22023';
  END IF;

  SELECT COUNT(DISTINCT (component ->> 'productId')::UUID)
  INTO v_component_count
  FROM jsonb_array_elements(p_components) AS component;

  IF v_component_count <> jsonb_array_length(p_components) THEN
    RAISE EXCEPTION 'DUPLICATE_COMBO_COMPONENT' USING ERRCODE = '22023';
  END IF;

  PERFORM 1
  FROM public.products AS product
  WHERE product.id IN (
    SELECT (component ->> 'productId')::UUID
    FROM jsonb_array_elements(p_components) AS component
  )
  ORDER BY product.id
  FOR UPDATE;

  IF (
    SELECT COUNT(*)
    FROM jsonb_array_elements(p_components) AS requested
    JOIN public.products AS component
      ON component.id = (requested ->> 'productId')::UUID
    WHERE component.category = 'lanchonete'
      AND component.active IS TRUE
      AND component.is_combo IS FALSE
  ) <> v_component_count THEN
    RAISE EXCEPTION 'COMBO_COMPONENT_UNAVAILABLE' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.products (name, price, category, description, stock, active, is_combo)
  VALUES (BTRIM(p_name), ROUND(p_price, 2), 'lanchonete', 'Combo', NULL, TRUE, TRUE)
  RETURNING * INTO v_combo;

  INSERT INTO public.product_combo_items (combo_id, component_product_id, quantity)
  SELECT v_combo.id, (component ->> 'productId')::UUID, (component ->> 'quantity')::INTEGER
  FROM jsonb_array_elements(p_components) AS component;

  RETURN v_combo;
END;
$$;

REVOKE ALL ON FUNCTION public.create_lanchonete_combo(TEXT, NUMERIC, JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_lanchonete_combo(TEXT, NUMERIC, JSONB) TO service_role;

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
  v_inventory_product_ids UUID[];
  v_inventory_quantities INTEGER[];
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

  SELECT account.balance
  INTO v_balance
  FROM public.app_users AS account
  WHERE account.id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account not found' USING ERRCODE = 'P0002';
  END IF;

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
  WHERE product.id IN (
    SELECT unnest(v_product_ids)
    UNION
    SELECT component.component_product_id
    FROM public.product_combo_items AS component
    WHERE component.combo_id = ANY(v_product_ids)
  )
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

  IF EXISTS (
    SELECT 1
    FROM unnest(v_product_ids) AS requested(product_id)
    JOIN public.products AS combo ON combo.id = requested.product_id AND combo.is_combo
    WHERE NOT EXISTS (
      SELECT 1 FROM public.product_combo_items AS component WHERE component.combo_id = combo.id
    )
  ) THEN
    RAISE EXCEPTION 'PRODUCT_UNAVAILABLE' USING ERRCODE = 'P0001';
  END IF;

  SELECT combo.id AS product_id, combo.name AS product_name
  INTO v_bad
  FROM unnest(v_product_ids) AS requested(product_id)
  JOIN public.products AS combo ON combo.id = requested.product_id AND combo.is_combo
  JOIN public.product_combo_items AS combo_item ON combo_item.combo_id = combo.id
  JOIN public.products AS component ON component.id = combo_item.component_product_id
  WHERE component.category <> 'lanchonete'
     OR component.active IS NOT TRUE
     OR component.is_combo IS TRUE
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'PRODUCT_UNAVAILABLE'
      USING ERRCODE = 'P0001',
            DETAIL = jsonb_build_object('productId', v_bad.product_id, 'productName', v_bad.product_name)::TEXT;
  END IF;

  SELECT array_agg(inventory.product_id ORDER BY inventory.product_id),
         array_agg(inventory.quantity ORDER BY inventory.product_id)
  INTO v_inventory_product_ids, v_inventory_quantities
  FROM (
    SELECT demand.product_id, SUM(demand.quantity)::INTEGER AS quantity
    FROM (
      SELECT requested.product_id, requested.quantity
      FROM unnest(v_product_ids, v_quantities) AS requested(product_id, quantity)
      JOIN public.products AS product ON product.id = requested.product_id
      WHERE product.is_combo IS FALSE
      UNION ALL
      SELECT component.component_product_id, requested.quantity * component.quantity
      FROM unnest(v_product_ids, v_quantities) AS requested(product_id, quantity)
      JOIN public.products AS combo ON combo.id = requested.product_id AND combo.is_combo
      JOIN public.product_combo_items AS component ON component.combo_id = combo.id
    ) AS demand
    GROUP BY demand.product_id
  ) AS inventory;

  SELECT requested.product_id, product.name, product.stock
  INTO v_bad
  FROM unnest(v_inventory_product_ids, v_inventory_quantities) AS requested(product_id, quantity)
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

  INSERT INTO public.sale_item_components (sale_item_id, component_product_id, quantity_per_combo)
  SELECT item.id, component.component_product_id, component.quantity
  FROM public.sale_items AS item
  JOIN public.products AS combo ON combo.id = item.product_id AND combo.is_combo
  JOIN public.product_combo_items AS component ON component.combo_id = combo.id
  WHERE item.sale_id = v_sale.id;

  UPDATE public.products AS product
  SET stock = product.stock - requested.quantity
  FROM unnest(v_inventory_product_ids, v_inventory_quantities) AS requested(product_id, quantity)
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
  WHERE product.id IN (
    SELECT item.product_id FROM public.sale_items AS item WHERE item.sale_id = v_sale.id
    UNION
    SELECT component.component_product_id
    FROM public.sale_items AS item
    JOIN public.sale_item_components AS component ON component.sale_item_id = item.id
    WHERE item.sale_id = v_sale.id
  )
  ORDER BY product.id
  FOR UPDATE;

  UPDATE public.products AS product
  SET stock = product.stock + returned.quantity
  FROM (
    SELECT consumed.product_id, SUM(consumed.quantity)::INTEGER AS quantity
    FROM (
      SELECT item.product_id, item.quantity
      FROM public.sale_items AS item
      JOIN public.products AS sold_product ON sold_product.id = item.product_id AND NOT sold_product.is_combo
      WHERE item.sale_id = v_sale.id
      UNION ALL
      SELECT component.component_product_id, item.quantity * component.quantity_per_combo
      FROM public.sale_items AS item
      JOIN public.sale_item_components AS component ON component.sale_item_id = item.id
      WHERE item.sale_id = v_sale.id
    ) AS consumed
    GROUP BY consumed.product_id
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

REVOKE ALL ON FUNCTION public.cancel_lanchonete_order(UUID, UUID, BOOLEAN)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_lanchonete_order(UUID, UUID, BOOLEAN) TO service_role;
