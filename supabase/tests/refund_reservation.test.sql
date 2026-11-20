-- Execute em um banco Supabase local descartavel: supabase test db
BEGIN;
SELECT no_plan();

INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('91000000-0000-0000-0000-000000000001', 'refund-user@test.local', '{"name":"Teste"}'),
  ('91000000-0000-0000-0000-000000000002', 'refund-admin@test.local', '{"name":"Admin"}');
UPDATE public.app_users SET role = 'admin' WHERE id = '91000000-0000-0000-0000-000000000002';
UPDATE public.app_users SET balance = 10 WHERE id = '91000000-0000-0000-0000-000000000001';
INSERT INTO public.pix_payments (id, user_id, amount, pix_code, status, payment_method, external_id, webhook_data)
VALUES ('92000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001', 10, 'teste', 'confirmed', 'api', '123456789', '{"provider":"mercadopago"}');
INSERT INTO public.refund_requests (id, user_id, pix_key, whatsapp)
VALUES ('93000000-0000-0000-0000-000000000001', '91000000-0000-0000-0000-000000000001', 'teste', '11999999999');

SELECT ok(NOT has_function_privilege('authenticated', 'public.reserve_pix_refund(uuid,uuid,numeric,numeric,bigint,uuid)', 'EXECUTE'), 'reserva indisponivel para authenticated');
SELECT ok(NOT has_function_privilege('anon', 'public.finalize_pix_refund(uuid,text,text,uuid)', 'EXECUTE'), 'finalizacao indisponivel para anon');
SELECT ok(has_function_privilege('service_role', 'public.reserve_pix_refund(uuid,uuid,numeric,numeric,bigint,uuid)', 'EXECUTE'), 'service_role pode reservar');
SELECT throws_ok($$SELECT public.reserve_pix_refund('93000000-0000-0000-0000-000000000001','92000000-0000-0000-0000-000000000001',3,10,0,'91000000-0000-0000-0000-000000000001')$$, 'P0001', 'Acesso negado', 'usuario comum nao pode reservar');
CREATE TEMP TABLE refund_test_operation AS
SELECT public.reserve_pix_refund('93000000-0000-0000-0000-000000000001','92000000-0000-0000-0000-000000000001',3,10,0,'91000000-0000-0000-0000-000000000002') AS id;
SELECT is((SELECT balance FROM public.app_users WHERE id='91000000-0000-0000-0000-000000000001'), 7::numeric, 'reserva debita uma vez');
SELECT is(public.reserve_pix_refund('93000000-0000-0000-0000-000000000001','92000000-0000-0000-0000-000000000001',3,10,0,'91000000-0000-0000-0000-000000000002'), (SELECT id FROM refund_test_operation), 'repeticao retorna a mesma reserva');
SELECT is((SELECT count(*) FROM public.transactions WHERE user_id='91000000-0000-0000-0000-000000000001'), 1::bigint, 'repeticao nao duplica debito');
SELECT is(public.finalize_pix_refund((SELECT id FROM refund_test_operation),'processing','456','91000000-0000-0000-0000-000000000002'), 'processing', 'processamento mantem reserva');
SELECT is((SELECT balance FROM public.app_users WHERE id='91000000-0000-0000-0000-000000000001'), 7::numeric, 'saldo permanece reservado');
SELECT is(public.finalize_pix_refund((SELECT id FROM refund_test_operation),'rejected','456','91000000-0000-0000-0000-000000000002'), 'rejected', 'rejeicao libera reserva');
SELECT is(public.finalize_pix_refund((SELECT id FROM refund_test_operation),'rejected','456','91000000-0000-0000-0000-000000000002'), 'rejected', 'repeticao da rejeicao e idempotente');
SELECT is((SELECT balance FROM public.app_users WHERE id='91000000-0000-0000-0000-000000000001'), 10::numeric, 'saldo restaurado uma unica vez');
SELECT is((SELECT count(*) FROM public.transactions WHERE user_id='91000000-0000-0000-0000-000000000001'), 2::bigint, 'um debito e um credito');
SELECT * FROM finish();
ROLLBACK;
