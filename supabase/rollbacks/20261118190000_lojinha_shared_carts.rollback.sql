-- Rollback de 20261118190000_lojinha_shared_carts.sql.
-- Carrinhos abertos são removidos; suas quantidades reservadas são devolvidas
-- ao estoque antes da exclusão. Vendas já concluídas não são revertidas.
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.lojinha_carts') IS NOT NULL
     AND to_regclass('public.lojinha_cart_items') IS NOT NULL THEN
    UPDATE public.products AS product
    SET stock = product.stock + reservations.quantity,
        updated_at = NOW()
    FROM (
      SELECT item.product_id, SUM(item.reserved_quantity)::INTEGER AS quantity
      FROM public.lojinha_cart_items AS item
      JOIN public.lojinha_carts AS cart ON cart.id = item.cart_id
      WHERE cart.status = 'open'
      GROUP BY item.product_id
    ) AS reservations
    WHERE product.id = reservations.product_id
      AND product.stock IS NOT NULL
      AND reservations.quantity > 0;
  END IF;
END;
$$;

DROP FUNCTION IF EXISTS public.checkout_lojinha_cart(UUID, UUID, UUID, BIGINT, TEXT);
DROP FUNCTION IF EXISTS public.cancel_lojinha_cart(UUID, UUID);
DROP FUNCTION IF EXISTS public.decrease_lojinha_cart_item(UUID, UUID);
DROP FUNCTION IF EXISTS public.set_lojinha_cart_item_quantity(UUID, UUID, INTEGER);
DROP FUNCTION IF EXISTS public.add_lojinha_cart_item(UUID, UUID, INTEGER);
DROP FUNCTION IF EXISTS public.get_or_create_lojinha_cart(UUID, UUID);

DROP POLICY IF EXISTS block_direct_api_access ON public.lojinha_cart_items;
DROP POLICY IF EXISTS block_direct_api_access ON public.lojinha_carts;

DROP TABLE IF EXISTS public.lojinha_cart_items;
DROP TABLE IF EXISTS public.lojinha_carts;

ALTER TABLE public.products
  DROP COLUMN IF EXISTS image_url;

COMMIT;
