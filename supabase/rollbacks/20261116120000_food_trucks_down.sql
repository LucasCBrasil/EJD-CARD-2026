-- =============================================================================
-- ROLLBACK de 20261116120000_food_trucks.sql
--
-- O Supabase CLI nao tem "migration down". Para desfazer, rode este script
-- manualmente (SQL Editor ou psql) e depois remova o registro da migration:
--   supabase migration repair --status reverted 20261116120000
--
-- ATENCAO, leia antes de rodar:
-- * Todos os food trucks e itens cadastrados sao APAGADOS. Se precisar guardar,
--   exporte antes:
--     SELECT * FROM public.food_trucks;
--     SELECT * FROM public.food_truck_menu_items;
-- * O bucket 'food-trucks' nao e removido por SQL (o Storage protege a
--   remocao direta). Esvazie e apague o bucket pelo painel do Supabase ou com
--   a API de Storage, se quiser remover tambem as imagens.
-- =============================================================================

BEGIN;

DROP TABLE IF EXISTS public.food_truck_menu_items;
DROP TABLE IF EXISTS public.food_trucks;

COMMIT;
