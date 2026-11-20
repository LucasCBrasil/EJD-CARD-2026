BEGIN;
SELECT no_plan();
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'manual-user@test.local', '{"name":"Teste"}'),
  ('a1000000-0000-0000-0000-000000000002', 'manual-admin@test.local', '{"name":"Admin"}'),
  ('a1000000-0000-0000-0000-000000000003', 'manual-admin2@test.local', '{"name":"Admin 2"}');
UPDATE public.app_users SET role = 'admin' WHERE id = 'a1000000-0000-0000-0000-000000000002';
UPDATE public.app_users SET role = 'admin' WHERE id = 'a1000000-0000-0000-0000-000000000003';
UPDATE public.app_users SET balance = 10 WHERE id = 'a1000000-0000-0000-0000-000000000001';
INSERT INTO public.refund_requests (id, user_id, pix_key, whatsapp)
VALUES ('a2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'teste', '11999999999');
SELECT ok(NOT has_function_privilege('authenticated', 'public.settle_manual_refund(uuid,numeric,uuid)', 'EXECUTE'), 'usuário autenticado não pode executar a função diretamente');
SELECT ok(has_function_privilege('service_role', 'public.settle_manual_refund(uuid,numeric,uuid)', 'EXECUTE'), 'servidor pode executar a função');
SELECT throws_ok($$SELECT public.settle_manual_refund('a2000000-0000-0000-0000-000000000001',10,'a1000000-0000-0000-0000-000000000001')$$, 'P0001', 'Acesso negado', 'exige administrador');
INSERT INTO public.pix_payments (id, user_id, amount, pix_code, status, payment_method, external_id, webhook_data)
VALUES ('a3000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 10, 'teste', 'confirmed', 'api', '123456', '{"provider":"mercadopago"}');
INSERT INTO public.refund_payment_operations (id, refund_request_id, payment_id, user_id, amount, status)
VALUES ('a4000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 1, 'processing');
SELECT throws_ok($$SELECT public.claim_manual_refund('a2000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000002')$$, 'P0001', 'Há uma devolução Pix aguardando confirmação', 'bloqueia reserva com devolução em processamento');
UPDATE public.refund_payment_operations SET status = 'rejected' WHERE id = 'a4000000-0000-0000-0000-000000000001';
SELECT is((public.claim_manual_refund('a2000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000002')->>'amount')::numeric, 10::numeric, 'reserva o valor exibido');
SELECT throws_ok($$SELECT public.claim_manual_refund('a2000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000003')$$, 'P0001', 'Solicitação já está reservada por outro administrador', 'outro administrador não pode abrir');
SELECT throws_ok($$SELECT public.release_manual_refund('a2000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000003')$$, 'P0001', 'Reserva indisponível', 'outro administrador não pode liberar');
SELECT throws_ok($$SELECT public.settle_manual_refund('a2000000-0000-0000-0000-000000000001',10,'a1000000-0000-0000-0000-000000000003')$$, 'P0001', 'Reserva indisponível', 'outro administrador não pode concluir');
SELECT lives_ok($$SELECT public.release_manual_refund('a2000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000002')$$, 'responsável pode liberar');
SELECT is((public.claim_manual_refund('a2000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000003')->>'amount')::numeric, 10::numeric, 'outro administrador pode reservar após liberação');
SELECT lives_ok($$SELECT public.release_manual_refund('a2000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000003')$$, 'novo responsável pode liberar');
SELECT is((public.claim_manual_refund('a2000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000002')->>'amount')::numeric, 10::numeric, 'responsável original pode reservar novamente');
SELECT throws_ok($$SELECT public.settle_manual_refund('a2000000-0000-0000-0000-000000000001',9,'a1000000-0000-0000-0000-000000000002')$$, 'P0001', 'Saldo insuficiente ou dados alterados; mantenha a reserva e procure a administração', 'impede baixa com valor divergente');
SELECT throws_ok($$INSERT INTO public.refund_payment_operations (refund_request_id, payment_id, user_id, amount) VALUES ('a2000000-0000-0000-0000-000000000001', 'a3000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 1)$$, 'P0001', 'Solicitação reservada para ressarcimento manual', 'bloqueia novo reembolso Pix automático');
UPDATE public.app_users SET balance = 0 WHERE id = 'a1000000-0000-0000-0000-000000000001';
SELECT is((public.claim_manual_refund('a2000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000002')->>'balance_changed')::boolean, true, 'responsável pode retomar mesmo se saldo mudou');
SELECT throws_ok($$SELECT public.settle_manual_refund('a2000000-0000-0000-0000-000000000001',10,'a1000000-0000-0000-0000-000000000002')$$, 'P0001', 'Saldo insuficiente ou dados alterados; mantenha a reserva e procure a administração', 'mantém reserva quando não há saldo suficiente');
UPDATE public.app_users SET balance = 10 WHERE id = 'a1000000-0000-0000-0000-000000000001';
SELECT is(public.settle_manual_refund('a2000000-0000-0000-0000-000000000001',10,'a1000000-0000-0000-0000-000000000002'), 10::numeric, 'registra a baixa');
SELECT is((SELECT balance FROM public.app_users WHERE id = 'a1000000-0000-0000-0000-000000000001'), 0::numeric, 'desconta saldo');
SELECT is(public.settle_manual_refund('a2000000-0000-0000-0000-000000000001',10,'a1000000-0000-0000-0000-000000000002'), 10::numeric, 'repetição é idempotente');
SELECT is((SELECT count(*) FROM public.transactions WHERE user_id = 'a1000000-0000-0000-0000-000000000001'), 1::bigint, 'não duplica lançamento');
SELECT is((SELECT status FROM public.refund_requests WHERE id = 'a2000000-0000-0000-0000-000000000001'), 'authorized', 'finaliza solicitação');
SELECT ok((SELECT manual_settlement_transaction_id IS NOT NULL FROM public.refund_requests WHERE id = 'a2000000-0000-0000-0000-000000000001'), 'vincula lançamento à solicitação');
SELECT * FROM finish();
ROLLBACK;
