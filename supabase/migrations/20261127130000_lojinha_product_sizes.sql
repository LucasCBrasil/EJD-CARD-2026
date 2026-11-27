CREATE OR REPLACE FUNCTION public.valid_lojinha_size_stock(p_size_stock JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_entry RECORD;
  v_quantity NUMERIC;
  v_total NUMERIC := 0;
BEGIN
  IF p_size_stock IS NULL THEN
    RETURN TRUE;
  END IF;
  IF jsonb_typeof(p_size_stock) <> 'object' OR p_size_stock = '{}'::JSONB THEN
    RETURN FALSE;
  END IF;

  FOR v_entry IN SELECT * FROM jsonb_each(p_size_stock)
  LOOP
    IF v_entry.key NOT IN ('PP', 'P', 'M', 'G', 'GG', 'XGG')
       OR jsonb_typeof(v_entry.value) <> 'number'
       OR v_entry.value::TEXT !~ '^(0|[1-9][0-9]*)$'
       OR LENGTH(v_entry.value::TEXT) > 10 THEN
      RETURN FALSE;
    END IF;

    v_quantity := v_entry.value::TEXT::NUMERIC;
    IF v_quantity > 2147483647 THEN
      RETURN FALSE;
    END IF;
    v_total := v_total + v_quantity;
    IF v_total > 2147483647 THEN
      RETURN FALSE;
    END IF;
  END LOOP;

  RETURN v_total > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.valid_lojinha_size_stock(JSONB) TO PUBLIC;

ALTER TABLE public.products
  ADD COLUMN size_stock JSONB,
  ADD CONSTRAINT products_size_stock_valid_check
    CHECK (public.valid_lojinha_size_stock(size_stock));

ALTER TABLE public.lojinha_cart_items
  ADD COLUMN variant_size TEXT NOT NULL DEFAULT '';

ALTER TABLE public.lojinha_cart_items
  DROP CONSTRAINT lojinha_cart_items_pkey,
  ADD CONSTRAINT lojinha_cart_items_pkey PRIMARY KEY (cart_id, product_id, variant_size),
  ADD CONSTRAINT lojinha_cart_items_variant_size_check
    CHECK (variant_size IN ('', 'PP', 'P', 'M', 'G', 'GG', 'XGG'));

ALTER TABLE public.sale_items
  ADD COLUMN variant_size TEXT
  CHECK (variant_size IS NULL OR variant_size IN ('PP', 'P', 'M', 'G', 'GG', 'XGG'));

CREATE OR REPLACE FUNCTION public.save_lojinha_product_with_sizes(
  p_product_id UUID,
  p_name TEXT,
  p_price NUMERIC,
  p_description TEXT,
  p_image_url TEXT,
  p_is_consigned BOOLEAN,
  p_size_stock JSONB,
  p_stock INTEGER,
  p_active BOOLEAN DEFAULT TRUE,
  p_expected_size_stock JSONB DEFAULT NULL,
  p_expected_stock INTEGER DEFAULT NULL
)
RETURNS public.products
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product public.products%ROWTYPE;
  v_stock INTEGER;
BEGIN
  IF p_name IS NULL OR LENGTH(BTRIM(p_name)) = 0 OR LENGTH(BTRIM(p_name)) > 200
     OR p_price IS NULL OR p_price <= 0
     OR p_is_consigned IS NULL
     OR NOT public.valid_lojinha_size_stock(p_size_stock)
     OR (p_size_stock IS NULL AND (p_stock IS NULL OR p_stock < 0))
     OR (p_size_stock IS NOT NULL AND p_stock IS NOT NULL AND p_stock < 0) THEN
    RAISE EXCEPTION 'INVALID_PRODUCT' USING ERRCODE = '22023';
  END IF;

  v_stock := CASE
    WHEN p_size_stock IS NULL THEN p_stock
    ELSE (SELECT SUM(value::TEXT::NUMERIC)::INTEGER FROM jsonb_each(p_size_stock))
  END;

  IF p_product_id IS NULL THEN
    INSERT INTO public.products (
      name, price, category, description, stock, image_url, active, is_consigned, size_stock
    )
    VALUES (
      BTRIM(p_name), p_price, 'lojinha', p_description, v_stock, p_image_url,
      COALESCE(p_active, TRUE), p_is_consigned, p_size_stock
    )
    RETURNING * INTO v_product;
    RETURN v_product;
  END IF;

  SELECT product.*
  INTO v_product
  FROM public.products AS product
  WHERE product.id = p_product_id
    AND product.category = 'lojinha'
    AND product.is_combo IS NOT TRUE
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PRODUCT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF v_product.stock IS DISTINCT FROM p_expected_stock
     OR v_product.size_stock IS DISTINCT FROM p_expected_size_stock THEN
    RAISE EXCEPTION 'PRODUCT_STOCK_CHANGED' USING ERRCODE = 'P0001';
  END IF;

  IF v_product.size_stock IS DISTINCT FROM p_size_stock
     AND EXISTS (
       SELECT 1
       FROM public.lojinha_cart_items AS item
       JOIN public.lojinha_carts AS cart ON cart.id = item.cart_id
       WHERE item.product_id = p_product_id
         AND cart.status = 'open'
     ) THEN
    RAISE EXCEPTION 'PRODUCT_SIZE_RESERVED' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.products
  SET name = BTRIM(p_name),
      price = p_price,
      description = p_description,
      image_url = p_image_url,
      is_consigned = p_is_consigned,
      size_stock = p_size_stock,
      stock = v_stock,
      active = COALESCE(p_active, active),
      updated_at = NOW()
  WHERE id = p_product_id
  RETURNING * INTO v_product;

  RETURN v_product;
END;
$$;

REVOKE ALL ON FUNCTION public.save_lojinha_product_with_sizes(UUID, TEXT, NUMERIC, TEXT, TEXT, BOOLEAN, JSONB, INTEGER, BOOLEAN, JSONB, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_lojinha_product_with_sizes(UUID, TEXT, NUMERIC, TEXT, TEXT, BOOLEAN, JSONB, INTEGER, BOOLEAN, JSONB, INTEGER)
  TO service_role;

CREATE OR REPLACE FUNCTION public.add_lojinha_cart_item(
  p_cart_id UUID,
  p_product_id UUID,
  p_quantity INTEGER,
  p_variant_size TEXT
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
  v_available INTEGER;
  v_size_stock JSONB;
  v_size TEXT := COALESCE(p_variant_size, '');
BEGIN
  IF p_quantity IS NULL OR p_quantity < 1 OR p_quantity > 999 THEN
    RAISE EXCEPTION 'INVALID_QUANTITY' USING ERRCODE = '22023';
  END IF;

  SELECT cart.* INTO v_cart
  FROM public.lojinha_carts AS cart
  WHERE cart.id = p_cart_id
  FOR UPDATE;
  IF NOT FOUND OR v_cart.status <> 'open' THEN
    RAISE EXCEPTION 'CART_NOT_OPEN' USING ERRCODE = 'P0001';
  END IF;

  SELECT product.* INTO v_product
  FROM public.products AS product
  WHERE product.id = p_product_id AND product.category = 'lojinha' AND product.active IS TRUE
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PRODUCT_UNAVAILABLE' USING ERRCODE = 'P0001';
  END IF;

  IF v_product.size_stock IS NOT NULL THEN
    IF v_size = '' OR NOT (v_product.size_stock ? v_size) THEN
      RAISE EXCEPTION 'VARIANT_UNAVAILABLE' USING ERRCODE = 'P0001';
    END IF;
    v_available := (v_product.size_stock ->> v_size)::INTEGER;
  ELSE
    IF v_size <> '' THEN
      RAISE EXCEPTION 'VARIANT_UNAVAILABLE' USING ERRCODE = 'P0001';
    END IF;
    v_available := v_product.stock;
  END IF;

  SELECT COALESCE(item.quantity, 0) INTO v_existing_quantity
  FROM (SELECT 1) AS singleton
  LEFT JOIN public.lojinha_cart_items AS item
    ON item.cart_id = p_cart_id AND item.product_id = p_product_id AND item.variant_size = v_size;

  IF v_existing_quantity + p_quantity > 999 THEN
    RAISE EXCEPTION 'INVALID_QUANTITY' USING ERRCODE = '22023';
  END IF;

  IF v_available IS NOT NULL AND v_available < p_quantity THEN
    RAISE EXCEPTION 'INSUFFICIENT_STOCK'
      USING ERRCODE = 'P0001',
            DETAIL = jsonb_build_object(
              'productName', v_product.name,
              'variantSize', NULLIF(v_size, ''),
              'available', v_available,
              'requested', p_quantity
            )::TEXT;
  END IF;

  IF v_product.size_stock IS NOT NULL THEN
    v_size_stock := jsonb_set(v_product.size_stock, ARRAY[v_size], to_jsonb(v_available - p_quantity), FALSE);
    UPDATE public.products
    SET size_stock = v_size_stock, stock = stock - p_quantity, updated_at = NOW()
    WHERE id = p_product_id;
  ELSIF v_product.stock IS NOT NULL THEN
    UPDATE public.products SET stock = stock - p_quantity, updated_at = NOW() WHERE id = p_product_id;
  END IF;

  INSERT INTO public.lojinha_cart_items (
    cart_id, product_id, variant_size, product_name, price, quantity, reserved_quantity, image_url
  )
  VALUES (
    p_cart_id, p_product_id, v_size, v_product.name, v_product.price, p_quantity,
    CASE WHEN v_available IS NOT NULL THEN p_quantity ELSE 0 END, v_product.image_url
  )
  ON CONFLICT (cart_id, product_id, variant_size) DO UPDATE
  SET quantity = public.lojinha_cart_items.quantity + EXCLUDED.quantity,
      reserved_quantity = public.lojinha_cart_items.reserved_quantity + EXCLUDED.reserved_quantity,
      updated_at = NOW();

  UPDATE public.lojinha_carts SET updated_at = NOW(), version = version + 1 WHERE id = p_cart_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_lojinha_cart_item(
  p_cart_id UUID,
  p_product_id UUID,
  p_quantity INTEGER
)
RETURNS VOID
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$ SELECT public.add_lojinha_cart_item(p_cart_id, p_product_id, p_quantity, NULL); $$;

CREATE OR REPLACE FUNCTION public.set_lojinha_cart_item_quantity(
  p_cart_id UUID,
  p_product_id UUID,
  p_variant_size TEXT,
  p_quantity INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item public.lojinha_cart_items%ROWTYPE;
  v_product public.products%ROWTYPE;
  v_difference INTEGER;
  v_available INTEGER;
  v_release INTEGER;
  v_size TEXT := COALESCE(p_variant_size, '');
BEGIN
  IF p_quantity IS NULL OR p_quantity < 0 OR p_quantity > 999 THEN
    RAISE EXCEPTION 'INVALID_QUANTITY' USING ERRCODE = '22023';
  END IF;
  PERFORM 1 FROM public.lojinha_carts WHERE id = p_cart_id AND status = 'open' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CART_NOT_OPEN' USING ERRCODE = 'P0001'; END IF;

  SELECT * INTO v_item
  FROM public.lojinha_cart_items
  WHERE cart_id = p_cart_id AND product_id = p_product_id AND variant_size = v_size
  FOR UPDATE;
  IF NOT FOUND THEN
    IF p_quantity = 0 THEN RETURN; END IF;
    RAISE EXCEPTION 'CART_ITEM_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_product FROM public.products WHERE id = p_product_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCT_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF v_product.stock IS NOT NULL AND v_item.reserved_quantity <> v_item.quantity THEN
    RAISE EXCEPTION 'CART_RESERVATION_INCONSISTENT' USING ERRCODE = 'P0001';
  END IF;
  v_difference := p_quantity - v_item.quantity;
  v_release := CASE WHEN v_difference < 0 THEN LEAST(ABS(v_difference), v_item.reserved_quantity) ELSE 0 END;

  IF v_product.size_stock IS NOT NULL THEN
    IF v_size = '' OR NOT (v_product.size_stock ? v_size) THEN
      RAISE EXCEPTION 'VARIANT_UNAVAILABLE' USING ERRCODE = 'P0001';
    END IF;
    v_available := (v_product.size_stock ->> v_size)::INTEGER;
    IF v_difference > 0 AND v_available < v_difference THEN
      RAISE EXCEPTION 'INSUFFICIENT_STOCK'
        USING ERRCODE = 'P0001',
              DETAIL = jsonb_build_object('productName', v_item.product_name, 'variantSize', v_size,
                'available', v_available, 'requested', v_difference)::TEXT;
    END IF;
    IF v_difference > 0 OR v_release > 0 THEN
      UPDATE public.products
      SET size_stock = jsonb_set(v_product.size_stock, ARRAY[v_size],
            to_jsonb(v_available - v_difference), FALSE),
          stock = stock - v_difference,
          updated_at = NOW()
      WHERE id = p_product_id;
    END IF;
  ELSE
    IF v_difference > 0 AND v_product.stock IS NOT NULL AND v_product.stock < v_difference THEN
      RAISE EXCEPTION 'INSUFFICIENT_STOCK' USING ERRCODE = 'P0001';
    END IF;
    IF v_product.stock IS NOT NULL AND (v_difference > 0 OR v_release > 0) THEN
      UPDATE public.products SET stock = stock - v_difference, updated_at = NOW() WHERE id = p_product_id;
    END IF;
  END IF;

  IF p_quantity = 0 THEN
    DELETE FROM public.lojinha_cart_items
    WHERE cart_id = p_cart_id AND product_id = p_product_id AND variant_size = v_size;
  ELSE
    UPDATE public.lojinha_cart_items
    SET quantity = p_quantity,
        reserved_quantity = CASE
          WHEN v_difference > 0 AND (v_product.size_stock IS NOT NULL OR v_product.stock IS NOT NULL)
            THEN reserved_quantity + v_difference
          WHEN v_difference < 0 THEN reserved_quantity - v_release
          ELSE reserved_quantity
        END,
        updated_at = NOW()
    WHERE cart_id = p_cart_id AND product_id = p_product_id AND variant_size = v_size;
  END IF;
  UPDATE public.lojinha_carts SET updated_at = NOW(), version = version + 1 WHERE id = p_cart_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_lojinha_cart_item_quantity(
  p_cart_id UUID,
  p_product_id UUID,
  p_quantity INTEGER
)
RETURNS VOID
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$ SELECT public.set_lojinha_cart_item_quantity(p_cart_id, p_product_id, NULL, p_quantity); $$;

CREATE OR REPLACE FUNCTION public.decrease_lojinha_cart_item(
  p_cart_id UUID,
  p_product_id UUID,
  p_variant_size TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item public.lojinha_cart_items%ROWTYPE;
  v_product public.products%ROWTYPE;
  v_release INTEGER;
  v_size TEXT := COALESCE(p_variant_size, '');
BEGIN
  PERFORM 1 FROM public.lojinha_carts WHERE id = p_cart_id AND status = 'open' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CART_NOT_OPEN' USING ERRCODE = 'P0001'; END IF;
  SELECT * INTO v_item
  FROM public.lojinha_cart_items
  WHERE cart_id = p_cart_id AND product_id = p_product_id AND variant_size = v_size
  FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT * INTO v_product FROM public.products WHERE id = p_product_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCT_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;

  v_release := LEAST(v_item.reserved_quantity, 1);
  IF v_product.size_stock IS NOT NULL AND v_release > 0 THEN
    UPDATE public.products
    SET size_stock = jsonb_set(v_product.size_stock, ARRAY[v_size],
          to_jsonb((v_product.size_stock ->> v_size)::INTEGER + v_release), FALSE),
        stock = stock + v_release,
        updated_at = NOW()
    WHERE id = p_product_id;
  ELSIF v_product.stock IS NOT NULL AND v_release > 0 THEN
    UPDATE public.products SET stock = stock + v_release, updated_at = NOW() WHERE id = p_product_id;
  END IF;

  IF v_item.quantity = 1 THEN
    DELETE FROM public.lojinha_cart_items
    WHERE cart_id = p_cart_id AND product_id = p_product_id AND variant_size = v_size;
  ELSE
    UPDATE public.lojinha_cart_items
    SET quantity = quantity - 1, reserved_quantity = reserved_quantity - v_release, updated_at = NOW()
    WHERE cart_id = p_cart_id AND product_id = p_product_id AND variant_size = v_size;
  END IF;
  UPDATE public.lojinha_carts SET updated_at = NOW(), version = version + 1 WHERE id = p_cart_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.decrease_lojinha_cart_item(
  p_cart_id UUID,
  p_product_id UUID
)
RETURNS VOID
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$ SELECT public.decrease_lojinha_cart_item(p_cart_id, p_product_id, NULL); $$;

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
  v_product public.products%ROWTYPE;
BEGIN
  SELECT * INTO v_cart FROM public.lojinha_carts WHERE id = p_cart_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CART_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  IF v_cart.status = 'cancelled' THEN RETURN 'cancelled'; END IF;
  IF v_cart.status <> 'open' THEN RAISE EXCEPTION 'CART_NOT_OPEN' USING ERRCODE = 'P0001'; END IF;

  FOR v_item IN
    SELECT product_id, variant_size, reserved_quantity
    FROM public.lojinha_cart_items
    WHERE cart_id = p_cart_id AND reserved_quantity > 0
    ORDER BY product_id, variant_size
  LOOP
    SELECT * INTO v_product FROM public.products WHERE id = v_item.product_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'PRODUCT_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;
    IF v_product.size_stock IS NOT NULL THEN
      IF v_item.variant_size = '' OR NOT (v_product.size_stock ? v_item.variant_size) THEN
        RAISE EXCEPTION 'CART_RESERVATION_INCONSISTENT' USING ERRCODE = 'P0001';
      END IF;

      UPDATE public.products
      SET size_stock = jsonb_set(v_product.size_stock, ARRAY[v_item.variant_size],
            to_jsonb((v_product.size_stock ->> v_item.variant_size)::INTEGER + v_item.reserved_quantity), FALSE),
          stock = stock + v_item.reserved_quantity,
          updated_at = NOW()
      WHERE id = v_item.product_id;
    ELSIF v_product.stock IS NOT NULL THEN
      UPDATE public.products
      SET stock = stock + v_item.reserved_quantity, updated_at = NOW()
      WHERE id = v_item.product_id;
    END IF;
  END LOOP;

  UPDATE public.lojinha_carts
  SET status = 'cancelled', cancelled_by = p_cancelled_by, cancelled_at = NOW(),
      updated_at = NOW(), version = version + 1
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
  SELECT * INTO v_cart FROM public.lojinha_carts WHERE id = p_cart_id FOR UPDATE;
  IF NOT FOUND OR v_cart.user_id <> p_user_id THEN
    RAISE EXCEPTION 'CART_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF v_cart.status = 'completed' AND v_cart.sale_id IS NOT NULL THEN
    SELECT * INTO v_sale FROM public.sales WHERE id = v_cart.sale_id;
    RETURN QUERY SELECT v_sale.id, v_sale.sale_number, v_sale.total, TRUE;
    RETURN;
  END IF;
  IF p_expected_version IS NULL OR v_cart.version <> p_expected_version THEN
    RAISE EXCEPTION 'CART_CHANGED' USING ERRCODE = 'P0001';
  END IF;
  IF v_cart.status <> 'open' THEN RAISE EXCEPTION 'CART_NOT_OPEN' USING ERRCODE = 'P0001'; END IF;

  SELECT COUNT(*), COALESCE(SUM(item.price * item.quantity), 0)
  INTO v_item_count, v_subtotal
  FROM public.lojinha_cart_items AS item WHERE item.cart_id = p_cart_id;
  IF v_item_count = 0 THEN RAISE EXCEPTION 'EMPTY_CART' USING ERRCODE = '22023'; END IF;

  PERFORM 1
  FROM public.products AS product
  JOIN public.lojinha_cart_items AS item ON item.product_id = product.id
  WHERE item.cart_id = p_cart_id
  ORDER BY product.id
  FOR UPDATE OF product;

  SELECT product.id, item.product_name, item.variant_size
  INTO v_bad_product
  FROM public.lojinha_cart_items AS item
  LEFT JOIN public.products AS product ON product.id = item.product_id
  WHERE item.cart_id = p_cart_id
    AND (
      product.id IS NULL OR product.category <> 'lojinha' OR product.active IS NOT TRUE
      OR (product.size_stock IS NULL AND item.variant_size <> '')
      OR (product.size_stock IS NOT NULL AND (
        item.variant_size = '' OR NOT (product.size_stock ? item.variant_size)
      ))
      OR (product.stock IS NOT NULL AND item.reserved_quantity <> item.quantity)
    )
  LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'PRODUCT_UNAVAILABLE'
      USING ERRCODE = 'P0001',
            DETAIL = format('%s %s', COALESCE(v_bad_product.product_name, v_bad_product.id::TEXT),
              NULLIF(v_bad_product.variant_size, ''));
  END IF;

  SELECT account.balance INTO v_balance
  FROM public.app_users AS account WHERE account.id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ACCOUNT_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;

  v_total := v_subtotal;
  v_coupon := NULLIF(BTRIM(p_coupon), '');
  IF v_coupon IS NOT NULL THEN
    IF v_subtotal < 150 THEN RAISE EXCEPTION 'COUPON_MINIMUM_NOT_MET' USING ERRCODE = 'P0001'; END IF;
    PERFORM 1 FROM public.coupons WHERE name = v_coupon;
    IF NOT FOUND THEN RAISE EXCEPTION 'COUPON_NOT_FOUND' USING ERRCODE = 'P0001'; END IF;
    v_total := v_subtotal - 10.00;
  END IF;
  IF v_total <= 0 THEN RAISE EXCEPTION 'INVALID_TOTAL' USING ERRCODE = '22023'; END IF;
  IF v_balance < v_total THEN RAISE EXCEPTION 'INSUFFICIENT_BALANCE' USING ERRCODE = 'P0001'; END IF;

  INSERT INTO public.sales (user_id, seller_id, category, total, status)
  VALUES (p_user_id, p_seller_id, 'lojinha', v_total, 'completed')
  RETURNING * INTO v_sale;

  INSERT INTO public.sale_items (sale_id, product_id, product_name, quantity, price, variant_size)
  SELECT v_sale.id, item.product_id,
         CASE WHEN item.variant_size = '' THEN item.product_name
              ELSE format('%s (%s)', item.product_name, item.variant_size) END,
         item.quantity, item.price, NULLIF(item.variant_size, '')
  FROM public.lojinha_cart_items AS item
  WHERE item.cart_id = p_cart_id;

  PERFORM * FROM public.adjust_account_balance(
    p_user_id, v_total, 'debit', format('Venda lojinha - %s itens', v_item_count), p_seller_id::TEXT
  );
  PERFORM pg_advisory_xact_lock(hashtext('public.orders.order_code'));
  SELECT COALESCE(MAX(order_record.order_code::BIGINT), 0) + 1 INTO v_order_number
  FROM public.orders AS order_record WHERE order_record.order_code ~ '^[0-9]+$';

  INSERT INTO public.orders (sale_id, user_id, customer_name, total, status, order_code)
  SELECT v_sale.id, p_user_id, COALESCE(NULLIF(account.name, ''), 'Cliente'),
         v_total, 'completed', LPAD(v_order_number::TEXT, 5, '0')
  FROM public.app_users AS account WHERE account.id = p_user_id;

  UPDATE public.lojinha_carts
  SET status = 'completed', sale_id = v_sale.id, completed_by = p_seller_id,
      completed_at = NOW(), updated_at = NOW(), version = version + 1
  WHERE id = p_cart_id;
  RETURN QUERY SELECT v_sale.id, v_sale.sale_number, v_total, FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.add_lojinha_cart_item(UUID, UUID, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.add_lojinha_cart_item(UUID, UUID, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_lojinha_cart_item_quantity(UUID, UUID, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_lojinha_cart_item_quantity(UUID, UUID, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.decrease_lojinha_cart_item(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.decrease_lojinha_cart_item(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cancel_lojinha_cart(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.checkout_lojinha_cart(UUID, UUID, UUID, BIGINT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_lojinha_cart_item(UUID, UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.add_lojinha_cart_item(UUID, UUID, INTEGER, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_lojinha_cart_item_quantity(UUID, UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_lojinha_cart_item_quantity(UUID, UUID, TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.decrease_lojinha_cart_item(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.decrease_lojinha_cart_item(UUID, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_lojinha_cart(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.checkout_lojinha_cart(UUID, UUID, UUID, BIGINT, TEXT) TO service_role;
