DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.products AS product
    CROSS JOIN LATERAL jsonb_object_keys(product.size_stock) AS sizes(size_name)
    WHERE sizes.size_name = 'XGG'
  ) THEN
    RAISE EXCEPTION 'LEGACY_XGG_STOCK_EXISTS: migrate existing XGG inventory before applying the new shirt sizes';
  END IF;
END;
$$;

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
    IF v_entry.key NOT IN (
      'PP', 'PP Baby Look', 'P', 'P Baby Look', 'M', 'M Baby Look',
      'G', 'G Baby Look', 'GG', 'GG Baby Look'
    )
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

ALTER TABLE public.lojinha_cart_items
  DROP CONSTRAINT lojinha_cart_items_variant_size_check,
  ADD CONSTRAINT lojinha_cart_items_variant_size_check
    CHECK (variant_size IN (
      '', 'PP', 'PP Baby Look', 'P', 'P Baby Look', 'M', 'M Baby Look',
      'G', 'G Baby Look', 'GG', 'GG Baby Look'
    )) NOT VALID;

ALTER TABLE public.sale_items
  DROP CONSTRAINT sale_items_variant_size_check,
  ADD CONSTRAINT sale_items_variant_size_check
    CHECK (variant_size IS NULL OR variant_size IN (
      'PP', 'PP Baby Look', 'P', 'P Baby Look', 'M', 'M Baby Look',
      'G', 'G Baby Look', 'GG', 'GG Baby Look'
    )) NOT VALID;
