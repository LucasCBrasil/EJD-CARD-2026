-- Carrinhos compartilhados da Lojinha com reserva transacional de estoque.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS image_url TEXT;

CREATE TABLE IF NOT EXISTS public.lojinha_carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.app_users(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'completed', 'cancelled')),
  version BIGINT NOT NULL DEFAULT 0 CHECK (version >= 0),
  created_by UUID REFERENCES public.app_users(id) ON DELETE SET NULL,
  completed_by UUID REFERENCES public.app_users(id) ON DELETE SET NULL,
  cancelled_by UUID REFERENCES public.app_users(id) ON DELETE SET NULL,
  sale_id UUID UNIQUE REFERENCES public.sales(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  CONSTRAINT lojinha_carts_completion_consistency CHECK (
    (status = 'completed' AND sale_id IS NOT NULL AND completed_at IS NOT NULL)
    OR (status <> 'completed' AND sale_id IS NULL AND completed_at IS NULL)
  ),
  CONSTRAINT lojinha_carts_cancellation_consistency CHECK (
    (status = 'cancelled' AND cancelled_at IS NOT NULL)
    OR (status <> 'cancelled' AND cancelled_at IS NULL)
  )
);

ALTER TABLE public.lojinha_carts
  ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS lojinha_carts_one_open_per_user_uidx
  ON public.lojinha_carts (user_id)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS lojinha_carts_user_created_idx
  ON public.lojinha_carts (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.lojinha_cart_items (
  cart_id UUID NOT NULL REFERENCES public.lojinha_carts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  product_name TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  reserved_quantity INTEGER NOT NULL DEFAULT 0 CHECK (
    reserved_quantity >= 0 AND reserved_quantity <= quantity
  ),
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (cart_id, product_id)
);

CREATE INDEX IF NOT EXISTS lojinha_cart_items_product_idx
  ON public.lojinha_cart_items (product_id);

ALTER TABLE public.lojinha_carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lojinha_cart_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.lojinha_carts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.lojinha_cart_items FROM PUBLIC, anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public.lojinha_carts TO service_role;
GRANT ALL PRIVILEGES ON TABLE public.lojinha_cart_items TO service_role;

DROP POLICY IF EXISTS block_direct_api_access ON public.lojinha_carts;
CREATE POLICY block_direct_api_access ON public.lojinha_carts
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS block_direct_api_access ON public.lojinha_cart_items;
CREATE POLICY block_direct_api_access ON public.lojinha_cart_items
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.get_or_create_lojinha_cart(
  p_user_id UUID,
  p_created_by UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cart_id UUID;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_USER' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.lojinha_carts (user_id, created_by)
  VALUES (p_user_id, p_created_by)
  ON CONFLICT (user_id) WHERE status = 'open' DO NOTHING;

  SELECT cart.id
  INTO v_cart_id
  FROM public.lojinha_carts AS cart
  WHERE cart.user_id = p_user_id
    AND cart.status = 'open';

  IF v_cart_id IS NULL THEN
    RAISE EXCEPTION 'OPEN_CART_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  RETURN v_cart_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_lojinha_cart_item(
  p_cart_id UUID,
  p_product_id UUID,
  p_quantity INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cart public.lojinha_carts%ROWTYPE;
  v_product public.products%ROWTYPE;
  v_existing_quantity INTEGER;
BEGIN
  IF p_quantity IS NULL OR p_quantity < 1 OR p_quantity > 999 THEN
    RAISE EXCEPTION 'INVALID_QUANTITY' USING ERRCODE = '22023';
  END IF;

  SELECT cart.*
  INTO v_cart
  FROM public.lojinha_carts AS cart
  WHERE cart.id = p_cart_id
  FOR UPDATE;

  IF NOT FOUND OR v_cart.status <> 'open' THEN
    RAISE EXCEPTION 'CART_NOT_OPEN' USING ERRCODE = 'P0001';
  END IF;

  SELECT product.*
  INTO v_product
  FROM public.products AS product
  WHERE product.id = p_product_id
    AND product.category = 'lojinha'
    AND product.active IS TRUE
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PRODUCT_UNAVAILABLE' USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(item.quantity, 0)
  INTO v_existing_quantity
  FROM (SELECT 1) AS singleton
  LEFT JOIN public.lojinha_cart_items AS item
    ON item.cart_id = p_cart_id
   AND item.product_id = p_product_id;

  IF v_existing_quantity + p_quantity > 999 THEN
    RAISE EXCEPTION 'INVALID_QUANTITY' USING ERRCODE = '22023';
  END IF;

  IF v_product.stock IS NOT NULL THEN
    IF v_product.stock < p_quantity THEN
      RAISE EXCEPTION 'INSUFFICIENT_STOCK'
        USING ERRCODE = 'P0001',
              DETAIL = jsonb_build_object(
                'productName', v_product.name,
                'available', v_product.stock,
                'requested', p_quantity
              )::TEXT;
    END IF;

    UPDATE public.products
    SET stock = stock - p_quantity,
        updated_at = NOW()
    WHERE id = p_product_id;
  END IF;

  INSERT INTO public.lojinha_cart_items (
    cart_id, product_id, product_name, price, quantity, reserved_quantity, image_url
  )
  VALUES (
    p_cart_id,
    p_product_id,
    v_product.name,
    v_product.price,
    p_quantity,
    CASE WHEN v_product.stock IS NOT NULL THEN p_quantity ELSE 0 END,
    v_product.image_url
  )
  ON CONFLICT (cart_id, product_id) DO UPDATE
  SET quantity = public.lojinha_cart_items.quantity + EXCLUDED.quantity,
      reserved_quantity = public.lojinha_cart_items.reserved_quantity + EXCLUDED.reserved_quantity,
      updated_at = NOW();

  UPDATE public.lojinha_carts
  SET updated_at = NOW(),
      version = version + 1
  WHERE id = p_cart_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_lojinha_cart_item_quantity(
  p_cart_id UUID,
  p_product_id UUID,
  p_quantity INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cart public.lojinha_carts%ROWTYPE;
  v_item public.lojinha_cart_items%ROWTYPE;
  v_product public.products%ROWTYPE;
  v_difference INTEGER;
  v_reserved_release INTEGER;
BEGIN
  IF p_quantity IS NULL OR p_quantity < 0 OR p_quantity > 999 THEN
    RAISE EXCEPTION 'INVALID_QUANTITY' USING ERRCODE = '22023';
  END IF;

  SELECT cart.*
  INTO v_cart
  FROM public.lojinha_carts AS cart
  WHERE cart.id = p_cart_id
  FOR UPDATE;

  IF NOT FOUND OR v_cart.status <> 'open' THEN
    RAISE EXCEPTION 'CART_NOT_OPEN' USING ERRCODE = 'P0001';
  END IF;

  SELECT item.*
  INTO v_item
  FROM public.lojinha_cart_items AS item
  WHERE item.cart_id = p_cart_id
    AND item.product_id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    IF p_quantity = 0 THEN
      RETURN;
    END IF;
    RAISE EXCEPTION 'CART_ITEM_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  v_difference := p_quantity - v_item.quantity;

  SELECT product.*
  INTO v_product
  FROM public.products AS product
  WHERE product.id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PRODUCT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  v_reserved_release := CASE
    WHEN v_difference < 0 THEN LEAST(ABS(v_difference), v_item.reserved_quantity)
    ELSE 0
  END;

  IF v_difference > 0 AND v_product.stock IS NOT NULL THEN
    IF v_product.stock < v_difference THEN
      RAISE EXCEPTION 'INSUFFICIENT_STOCK'
        USING ERRCODE = 'P0001',
              DETAIL = jsonb_build_object(
                'productName', v_item.product_name,
                'available', v_product.stock,
                'requested', v_difference
              )::TEXT;
    END IF;

    UPDATE public.products
    SET stock = stock - v_difference,
        updated_at = NOW()
    WHERE id = p_product_id;
  ELSIF v_difference < 0 AND v_product.stock IS NOT NULL AND v_reserved_release > 0 THEN
    UPDATE public.products
    SET stock = stock + v_reserved_release,
        updated_at = NOW()
    WHERE id = p_product_id;
  END IF;

  IF p_quantity = 0 THEN
    DELETE FROM public.lojinha_cart_items
    WHERE cart_id = p_cart_id
      AND product_id = p_product_id;
  ELSE
    UPDATE public.lojinha_cart_items
    SET quantity = p_quantity,
        reserved_quantity = CASE
          WHEN v_difference > 0 AND v_product.stock IS NOT NULL
            THEN v_item.reserved_quantity + v_difference
          WHEN v_difference < 0
            THEN v_item.reserved_quantity - v_reserved_release
          ELSE v_item.reserved_quantity
        END,
        updated_at = NOW()
    WHERE cart_id = p_cart_id
      AND product_id = p_product_id;
  END IF;

  UPDATE public.lojinha_carts
  SET updated_at = NOW(),
      version = version + 1
  WHERE id = p_cart_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.decrease_lojinha_cart_item(
  p_cart_id UUID,
  p_product_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cart public.lojinha_carts%ROWTYPE;
  v_item public.lojinha_cart_items%ROWTYPE;
  v_product public.products%ROWTYPE;
  v_reserved_release INTEGER;
BEGIN
  SELECT cart.*
  INTO v_cart
  FROM public.lojinha_carts AS cart
  WHERE cart.id = p_cart_id
  FOR UPDATE;

  IF NOT FOUND OR v_cart.status <> 'open' THEN
    RAISE EXCEPTION 'CART_NOT_OPEN' USING ERRCODE = 'P0001';
  END IF;

  SELECT item.*
  INTO v_item
  FROM public.lojinha_cart_items AS item
  WHERE item.cart_id = p_cart_id
    AND item.product_id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT product.*
  INTO v_product
  FROM public.products AS product
  WHERE product.id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PRODUCT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  v_reserved_release := LEAST(v_item.reserved_quantity, 1);

  IF v_product.stock IS NOT NULL AND v_reserved_release > 0 THEN
    UPDATE public.products
    SET stock = stock + v_reserved_release,
        updated_at = NOW()
    WHERE id = p_product_id;
  END IF;

  IF v_item.quantity = 1 THEN
    DELETE FROM public.lojinha_cart_items
    WHERE cart_id = p_cart_id
      AND product_id = p_product_id;
  ELSE
    UPDATE public.lojinha_cart_items
    SET quantity = quantity - 1,
        reserved_quantity = reserved_quantity - v_reserved_release,
        updated_at = NOW()
    WHERE cart_id = p_cart_id
      AND product_id = p_product_id;
  END IF;

  UPDATE public.lojinha_carts
  SET updated_at = NOW(),
      version = version + 1
  WHERE id = p_cart_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_lojinha_cart(
  p_cart_id UUID,
  p_cancelled_by UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cart public.lojinha_carts%ROWTYPE;
  v_item RECORD;
BEGIN
  SELECT cart.*
  INTO v_cart
  FROM public.lojinha_carts AS cart
  WHERE cart.id = p_cart_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CART_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_cart.status = 'cancelled' THEN
    RETURN 'cancelled';
  END IF;

  IF v_cart.status <> 'open' THEN
    RAISE EXCEPTION 'CART_NOT_OPEN' USING ERRCODE = 'P0001';
  END IF;

  FOR v_item IN
    SELECT item.product_id, item.reserved_quantity
    FROM public.lojinha_cart_items AS item
    WHERE item.cart_id = p_cart_id
    ORDER BY item.product_id
  LOOP
    UPDATE public.products
    SET stock = stock + v_item.reserved_quantity,
        updated_at = NOW()
    WHERE id = v_item.product_id
      AND stock IS NOT NULL;
  END LOOP;

  UPDATE public.lojinha_carts
  SET status = 'cancelled',
      cancelled_by = p_cancelled_by,
      cancelled_at = NOW(),
      updated_at = NOW(),
      version = version + 1
  WHERE id = p_cart_id;

  RETURN 'cancelled';
END;
$$;

CREATE OR REPLACE FUNCTION public.checkout_lojinha_cart(
  p_cart_id UUID,
  p_user_id UUID,
  p_seller_id UUID,
  p_expected_version BIGINT,
  p_coupon TEXT DEFAULT NULL
)
RETURNS TABLE(sale_id UUID, sale_number BIGINT, total NUMERIC, already_completed BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_cart public.lojinha_carts%ROWTYPE;
  v_sale public.sales%ROWTYPE;
  v_subtotal NUMERIC(10, 2);
  v_total NUMERIC(10, 2);
  v_balance NUMERIC(10, 2);
  v_order_number BIGINT;
  v_coupon TEXT;
  v_item_count INTEGER;
  v_bad_product RECORD;
BEGIN
  SELECT cart.*
  INTO v_cart
  FROM public.lojinha_carts AS cart
  WHERE cart.id = p_cart_id
  FOR UPDATE;

  IF NOT FOUND OR v_cart.user_id <> p_user_id THEN
    RAISE EXCEPTION 'CART_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_cart.status = 'completed' AND v_cart.sale_id IS NOT NULL THEN
    SELECT sale.*
    INTO v_sale
    FROM public.sales AS sale
    WHERE sale.id = v_cart.sale_id;

    RETURN QUERY SELECT v_sale.id, v_sale.sale_number, v_sale.total, TRUE;
    RETURN;
  END IF;

  IF p_expected_version IS NULL OR v_cart.version <> p_expected_version THEN
    RAISE EXCEPTION 'CART_CHANGED' USING ERRCODE = 'P0001';
  END IF;

  IF v_cart.status <> 'open' THEN
    RAISE EXCEPTION 'CART_NOT_OPEN' USING ERRCODE = 'P0001';
  END IF;

  SELECT COUNT(*), COALESCE(SUM(item.price * item.quantity), 0)
  INTO v_item_count, v_subtotal
  FROM public.lojinha_cart_items AS item
  WHERE item.cart_id = p_cart_id;

  IF v_item_count = 0 THEN
    RAISE EXCEPTION 'EMPTY_CART' USING ERRCODE = '22023';
  END IF;

  PERFORM 1
  FROM public.products AS product
  JOIN public.lojinha_cart_items AS item ON item.product_id = product.id
  WHERE item.cart_id = p_cart_id
  ORDER BY product.id
  FOR UPDATE OF product;

  SELECT product.id, item.product_name
  INTO v_bad_product
  FROM public.lojinha_cart_items AS item
  LEFT JOIN public.products AS product ON product.id = item.product_id
  WHERE item.cart_id = p_cart_id
    AND (product.id IS NULL OR product.category <> 'lojinha' OR product.active IS NOT TRUE)
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'PRODUCT_UNAVAILABLE'
      USING ERRCODE = 'P0001',
            DETAIL = COALESCE(v_bad_product.product_name, v_bad_product.id::TEXT);
  END IF;

  SELECT account.balance
  INTO v_balance
  FROM public.app_users AS account
  WHERE account.id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ACCOUNT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  v_total := v_subtotal;
  v_coupon := NULLIF(BTRIM(p_coupon), '');

  IF v_coupon IS NOT NULL THEN
    IF v_subtotal < 150 THEN
      RAISE EXCEPTION 'COUPON_MINIMUM_NOT_MET' USING ERRCODE = 'P0001';
    END IF;

    PERFORM 1
    FROM public.coupons AS coupon
    WHERE coupon.name = v_coupon;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'COUPON_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;

    v_total := v_subtotal - 10.00;
  END IF;

  IF v_total <= 0 THEN
    RAISE EXCEPTION 'INVALID_TOTAL' USING ERRCODE = '22023';
  END IF;

  IF v_balance < v_total THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.sales (user_id, seller_id, category, total, status)
  VALUES (p_user_id, p_seller_id, 'lojinha', v_total, 'completed')
  RETURNING * INTO v_sale;

  INSERT INTO public.sale_items (
    sale_id, product_id, product_name, quantity, price
  )
  SELECT
    v_sale.id, item.product_id, item.product_name, item.quantity, item.price
  FROM public.lojinha_cart_items AS item
  WHERE item.cart_id = p_cart_id;

  PERFORM 1
  FROM public.adjust_account_balance(
    p_user_id,
    v_total,
    'debit',
    format('Venda lojinha - %s itens', v_item_count),
    p_seller_id::TEXT
  );

  PERFORM pg_advisory_xact_lock(hashtext('public.orders.order_code'));

  SELECT COALESCE(MAX(order_record.order_code::BIGINT), 0) + 1
  INTO v_order_number
  FROM public.orders AS order_record
  WHERE order_record.order_code ~ '^[0-9]+$';

  INSERT INTO public.orders (
    sale_id, user_id, customer_name, total, status, order_code
  )
  SELECT
    v_sale.id,
    p_user_id,
    COALESCE(NULLIF(account.name, ''), 'Cliente'),
    v_total,
    'completed',
    LPAD(v_order_number::TEXT, 5, '0')
  FROM public.app_users AS account
  WHERE account.id = p_user_id;

  UPDATE public.lojinha_carts
  SET status = 'completed',
      sale_id = v_sale.id,
      completed_by = p_seller_id,
      completed_at = NOW(),
      updated_at = NOW(),
      version = version + 1
  WHERE id = p_cart_id;

  RETURN QUERY SELECT v_sale.id, v_sale.sale_number, v_total, FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_lojinha_cart(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.add_lojinha_cart_item(UUID, UUID, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_lojinha_cart_item_quantity(UUID, UUID, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.decrease_lojinha_cart_item(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancel_lojinha_cart(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.checkout_lojinha_cart(UUID, UUID, UUID, BIGINT, TEXT) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_or_create_lojinha_cart(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.add_lojinha_cart_item(UUID, UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_lojinha_cart_item_quantity(UUID, UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.decrease_lojinha_cart_item(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_lojinha_cart(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.checkout_lojinha_cart(UUID, UUID, UUID, BIGINT, TEXT) TO service_role;
