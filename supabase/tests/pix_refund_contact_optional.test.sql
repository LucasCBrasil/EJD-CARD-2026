BEGIN;
SELECT plan(2);
INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES ('b1000000-0000-0000-0000-000000000001', 'pix-refund@test.local', '{"name":"Teste"}');
SELECT lives_ok($$INSERT INTO public.refund_requests (id, user_id, pix_key, whatsapp) VALUES ('b2000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', NULL, NULL)$$, 'solicitação para Pix original não exige chave ou contato');
SELECT is((SELECT count(*) FROM public.refund_requests WHERE user_id = 'b1000000-0000-0000-0000-000000000001' AND pix_key IS NULL AND whatsapp IS NULL), 1::bigint, 'solicitação é registrada sem dados fictícios');
SELECT * FROM finish();
ROLLBACK;
