ALTER TABLE public.products
  ADD COLUMN menu_category TEXT NOT NULL DEFAULT 'Outros'
  CHECK (menu_category IN ('Salgados', 'Sobremesas', 'Bebidas', 'Outros'));

CREATE INDEX idx_products_lanchonete_menu_category
  ON public.products(menu_category)
  WHERE category = 'lanchonete' AND active IS TRUE;

CREATE OR REPLACE FUNCTION public.create_lanchonete_combo_with_category(
  p_name TEXT,
  p_price NUMERIC,
  p_components JSONB,
  p_menu_category TEXT
)
RETURNS public.products
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_combo public.products%ROWTYPE;
BEGIN
  IF p_menu_category IS NULL OR p_menu_category NOT IN ('Salgados', 'Sobremesas', 'Bebidas', 'Outros') THEN
    RAISE EXCEPTION 'INVALID_MENU_CATEGORY' USING ERRCODE = '22023';
  END IF;

  v_combo := public.create_lanchonete_combo(p_name, p_price, p_components);

  UPDATE public.products
  SET menu_category = p_menu_category
  WHERE id = v_combo.id
  RETURNING * INTO v_combo;

  RETURN v_combo;
END;
$$;

REVOKE ALL ON FUNCTION public.create_lanchonete_combo_with_category(TEXT, NUMERIC, JSONB, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_lanchonete_combo_with_category(TEXT, NUMERIC, JSONB, TEXT)
  TO service_role;
