ALTER TABLE public.products
  ADD COLUMN is_consigned BOOLEAN NOT NULL DEFAULT FALSE,
  ADD CONSTRAINT products_consigned_only_lojinha_check
    CHECK (category = 'lojinha' OR is_consigned = FALSE);
