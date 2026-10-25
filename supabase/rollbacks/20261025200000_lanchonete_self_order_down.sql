-- =============================================================================
-- ROLLBACK de 20261025200000_lanchonete_self_order.sql
--
-- O Supabase CLI nao tem "migration down". Para desfazer, rode este script
-- manualmente (SQL Editor ou psql) e depois remova o registro da migration:
--   supabase migration repair --status reverted 20261025200000
--
-- ATENCAO, leia antes de rodar:
-- * Pedidos em aberto (pending/preparing/ready) viram 'completed', que e o
--   status de "pago, aguardando retirada" do fluxo de balcao. Nenhum saldo e
--   alterado: o debito ja feito continua valido.
-- * Pedidos 'cancelled' ja foram estornados (credito em transactions). O CHECK
--   antigo nao aceita 'cancelled', entao eles sao APAGADOS de sales (sale_items
--   vai junto por CASCADE). Os lancamentos de debito e estorno continuam em
--   transactions, entao o extrato do usuario fecha em zero.
--   Se precisar guardar esses pedidos, exporte antes:
--     SELECT * FROM public.sales WHERE status = 'cancelled';
-- =============================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.create_lanchonete_self_order(UUID, JSONB, UUID);
DROP FUNCTION IF EXISTS public.update_lanchonete_order_status(UUID, TEXT, UUID);
DROP FUNCTION IF EXISTS public.cancel_lanchonete_order(UUID, UUID, BOOLEAN);

UPDATE public.sales
SET status = 'completed'
WHERE status IN ('pending', 'preparing', 'ready');

DELETE FROM public.sales
WHERE status = 'cancelled';

ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_status_check;
ALTER TABLE public.sales
  ADD CONSTRAINT sales_status_check CHECK (status IN ('completed', 'delivered'));

DROP INDEX IF EXISTS public.idx_sales_lanchonete_open_orders;
DROP INDEX IF EXISTS public.sales_user_client_request_uidx;

ALTER TABLE public.sales
  DROP COLUMN IF EXISTS status_updated_by,
  DROP COLUMN IF EXISTS status_updated_at,
  DROP COLUMN IF EXISTS client_request_id,
  DROP COLUMN IF EXISTS origin;

DELETE FROM public.feature_flags
WHERE key = 'lanchonete_self_order';

COMMIT;
