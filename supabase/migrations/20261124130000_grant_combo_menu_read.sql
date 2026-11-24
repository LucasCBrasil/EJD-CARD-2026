GRANT SELECT ON public.product_combo_items TO service_role;

CREATE POLICY "service role reads combo components"
  ON public.product_combo_items
  FOR SELECT
  TO service_role
  USING (TRUE);
