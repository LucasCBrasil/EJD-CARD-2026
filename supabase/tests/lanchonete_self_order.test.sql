-- Testes das RPCs de autoatendimento da Lanchonete
-- Rodar: supabase test db  (banco local com supabase-setup.sql + migrations)
BEGIN;
SELECT no_plan();

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('11111111-1111-1111-1111-111111111111', 'u1@test.local', '{"name":"Usuario Um"}'),
  ('22222222-2222-2222-2222-222222222222', 'u2@test.local', '{"name":"Usuario Dois"}'),
  ('33333333-3333-3333-3333-333333333333', 'staff@test.local', '{"name":"Equipe"}');

UPDATE public.app_users SET balance = 50.00 WHERE id = '11111111-1111-1111-1111-111111111111';
UPDATE public.app_users SET balance = 5.00 WHERE id = '22222222-2222-2222-2222-222222222222';
UPDATE public.app_users SET role = 'lanchonete' WHERE id = '33333333-3333-3333-3333-333333333333';

INSERT INTO public.products (id, name, price, category, stock, active) VALUES
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Coxinha teste', 5.00, 'lanchonete', 10, TRUE),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Refri teste', 4.50, 'lanchonete', NULL, TRUE),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'Inativo teste', 3.00, 'lanchonete', 10, FALSE),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'Camiseta teste', 20.00, 'lojinha', 10, TRUE),
  ('aaaaaaaa-0000-0000-0000-000000000005', 'Bolo teste', 6.00, 'lanchonete', 1, TRUE);

-- ---------------------------------------------------------------------------
-- Privilegios: so service_role executa
-- ---------------------------------------------------------------------------
SELECT ok(NOT has_function_privilege('authenticated', 'public.create_lanchonete_self_order(uuid,jsonb,uuid)', 'EXECUTE'),
  'authenticated nao executa create_lanchonete_self_order');
SELECT ok(NOT has_function_privilege('anon', 'public.create_lanchonete_self_order(uuid,jsonb,uuid)', 'EXECUTE'),
  'anon nao executa create_lanchonete_self_order');
SELECT ok(NOT has_function_privilege('authenticated', 'public.update_lanchonete_order_status(uuid,text,uuid)', 'EXECUTE'),
  'authenticated nao executa update_lanchonete_order_status');
SELECT ok(NOT has_function_privilege('authenticated', 'public.cancel_lanchonete_order(uuid,uuid,boolean)', 'EXECUTE'),
  'authenticated nao executa cancel_lanchonete_order');
SELECT ok(has_function_privilege('service_role', 'public.create_lanchonete_self_order(uuid,jsonb,uuid)', 'EXECUTE'),
  'service_role executa create_lanchonete_self_order');

-- ---------------------------------------------------------------------------
-- Feature flag
-- ---------------------------------------------------------------------------
SELECT is((SELECT enabled FROM public.feature_flags WHERE key = 'lanchonete_self_order'), FALSE,
  'flag lanchonete_self_order comeca desligada');

SELECT throws_ok(
  $$SELECT * FROM public.create_lanchonete_self_order('11111111-1111-1111-1111-111111111111',
    '[{"productId":"aaaaaaaa-0000-0000-0000-000000000001","quantity":1}]', gen_random_uuid())$$,
  'P0001', 'SELF_ORDER_DISABLED', 'flag desligada bloqueia pedido');

UPDATE public.feature_flags SET enabled = TRUE WHERE key = 'lanchonete_self_order';

-- ---------------------------------------------------------------------------
-- Validacao de entrada
-- ---------------------------------------------------------------------------
SELECT throws_ok(
  $$SELECT * FROM public.create_lanchonete_self_order('11111111-1111-1111-1111-111111111111', '[]', gen_random_uuid())$$,
  '22023', 'EMPTY_CART', 'carrinho vazio');

SELECT throws_ok(
  $$SELECT * FROM public.create_lanchonete_self_order('11111111-1111-1111-1111-111111111111', NULL, gen_random_uuid())$$,
  '22023', 'EMPTY_CART', 'carrinho nulo');

SELECT throws_ok(
  $$SELECT * FROM public.create_lanchonete_self_order('11111111-1111-1111-1111-111111111111',
    '[{"productId":"aaaaaaaa-0000-0000-0000-000000000001","quantity":0}]', gen_random_uuid())$$,
  '22023', 'INVALID_QUANTITY', 'quantidade zero');

SELECT throws_ok(
  $$SELECT * FROM public.create_lanchonete_self_order('11111111-1111-1111-1111-111111111111',
    '[{"productId":"aaaaaaaa-0000-0000-0000-000000000001","quantity":-2}]', gen_random_uuid())$$,
  '22023', 'INVALID_QUANTITY', 'quantidade negativa');

SELECT throws_ok(
  $$SELECT * FROM public.create_lanchonete_self_order('11111111-1111-1111-1111-111111111111',
    '[{"productId":"aaaaaaaa-0000-0000-0000-000000000001","quantity":1.5}]', gen_random_uuid())$$,
  '22023', 'INVALID_QUANTITY', 'quantidade fracionaria');

SELECT throws_ok(
  $$SELECT * FROM public.create_lanchonete_self_order('11111111-1111-1111-1111-111111111111',
    '[{"productId":"aaaaaaaa-0000-0000-0000-000000000001","quantity":"2"}]', gen_random_uuid())$$,
  '22023', 'INVALID_QUANTITY', 'quantidade como texto');

SELECT throws_ok(
  $$SELECT * FROM public.create_lanchonete_self_order('11111111-1111-1111-1111-111111111111',
    '[{"productId":"aaaaaaaa-0000-0000-0000-000000000001","quantity":11}]', gen_random_uuid())$$,
  '22023', 'INVALID_QUANTITY', 'mais de 10 unidades do item');

SELECT throws_ok(
  $$SELECT * FROM public.create_lanchonete_self_order('11111111-1111-1111-1111-111111111111',
    '[{"productId":"aaaaaaaa-0000-0000-0000-000000000001","quantity":6},
      {"productId":"aaaaaaaa-0000-0000-0000-000000000001","quantity":6}]', gen_random_uuid())$$,
  '22023', 'INVALID_QUANTITY', 'linhas repetidas somam acima de 10');

SELECT throws_ok(
  $$SELECT * FROM public.create_lanchonete_self_order('11111111-1111-1111-1111-111111111111',
    '[{"productId":"aaaaaaaa-0000-0000-0000-000000000001","quantity":10},
      {"productId":"aaaaaaaa-0000-0000-0000-000000000002","quantity":10},
      {"productId":"aaaaaaaa-0000-0000-0000-000000000005","quantity":1}]', gen_random_uuid())$$,
  '22023', 'ORDER_TOO_LARGE', 'mais de 20 unidades no pedido');

SELECT throws_ok(
  $$SELECT * FROM public.create_lanchonete_self_order('11111111-1111-1111-1111-111111111111',
    '[{"productId":"nao-e-uuid","quantity":1}]', gen_random_uuid())$$,
  '22023', 'INVALID_ITEM', 'productId invalido');

-- ---------------------------------------------------------------------------
-- Produto indisponivel / estoque
-- ---------------------------------------------------------------------------
SELECT throws_ok(
  $$SELECT * FROM public.create_lanchonete_self_order('11111111-1111-1111-1111-111111111111',
    '[{"productId":"aaaaaaaa-0000-0000-0000-000000000003","quantity":1}]', gen_random_uuid())$$,
  'P0001', 'PRODUCT_UNAVAILABLE', 'produto inativo (removido do cardapio)');

SELECT throws_ok(
  $$SELECT * FROM public.create_lanchonete_self_order('11111111-1111-1111-1111-111111111111',
    '[{"productId":"aaaaaaaa-0000-0000-0000-000000000004","quantity":1}]', gen_random_uuid())$$,
  'P0001', 'PRODUCT_UNAVAILABLE', 'produto da lojinha');

SELECT throws_ok(
  $$SELECT * FROM public.create_lanchonete_self_order('11111111-1111-1111-1111-111111111111',
    '[{"productId":"aaaaaaaa-0000-0000-0000-0000000000ff","quantity":1}]', gen_random_uuid())$$,
  'P0001', 'PRODUCT_UNAVAILABLE', 'produto inexistente');

SELECT throws_ok(
  $$SELECT * FROM public.create_lanchonete_self_order('11111111-1111-1111-1111-111111111111',
    '[{"productId":"aaaaaaaa-0000-0000-0000-000000000005","quantity":2}]', gen_random_uuid())$$,
  'P0001', 'OUT_OF_STOCK', 'estoque insuficiente');

-- ---------------------------------------------------------------------------
-- Saldo insuficiente: nada e gravado
-- ---------------------------------------------------------------------------
SELECT throws_ok(
  $$SELECT * FROM public.create_lanchonete_self_order('22222222-2222-2222-2222-222222222222',
    '[{"productId":"aaaaaaaa-0000-0000-0000-000000000001","quantity":2}]', gen_random_uuid())$$,
  'P0001', 'INSUFFICIENT_BALANCE', 'saldo insuficiente');

SELECT is((SELECT balance FROM public.app_users WHERE id = '22222222-2222-2222-2222-222222222222'), 5.00::NUMERIC,
  'saldo insuficiente nao altera saldo');
SELECT is((SELECT COUNT(*)::INT FROM public.sales WHERE user_id = '22222222-2222-2222-2222-222222222222'), 0,
  'saldo insuficiente nao cria venda');
SELECT is((SELECT stock FROM public.products WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001'), 10,
  'saldo insuficiente nao baixa estoque');

-- ---------------------------------------------------------------------------
-- Pedido com sucesso (preco do cliente e ignorado)
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE order1 AS
SELECT * FROM public.create_lanchonete_self_order(
  '11111111-1111-1111-1111-111111111111',
  '[{"productId":"aaaaaaaa-0000-0000-0000-000000000001","quantity":2,"price":0.01},
    {"productId":"aaaaaaaa-0000-0000-0000-000000000002","quantity":1,"price":0.01}]',
  'cccccccc-0000-0000-0000-000000000001');

SELECT is((SELECT total FROM order1), 14.50::NUMERIC, 'total calculado com precos do banco');
SELECT is((SELECT new_balance FROM order1), 35.50::NUMERIC, 'saldo novo retornado');
SELECT is((SELECT already_existed FROM order1), FALSE, 'pedido novo');
SELECT is((SELECT balance FROM public.app_users WHERE id = '11111111-1111-1111-1111-111111111111'), 35.50::NUMERIC,
  'saldo debitado');
SELECT results_eq(
  $$SELECT status, origin, seller_id, category FROM public.sales WHERE id = (SELECT sale_id FROM order1)$$,
  $$VALUES ('pending'::TEXT, 'autoatendimento'::TEXT, NULL::UUID, 'lanchonete'::TEXT)$$,
  'venda criada como pending/autoatendimento sem vendedor');
SELECT results_eq(
  $$SELECT product_name, quantity, price FROM public.sale_items
    WHERE sale_id = (SELECT sale_id FROM order1) ORDER BY product_name$$,
  $$VALUES ('Coxinha teste'::TEXT, 2, 5.00::NUMERIC), ('Refri teste'::TEXT, 1, 4.50::NUMERIC)$$,
  'itens gravados com nome e preco do banco');
SELECT is((SELECT stock FROM public.products WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001'), 8, 'estoque baixado');
SELECT is((SELECT stock FROM public.products WHERE id = 'aaaaaaaa-0000-0000-0000-000000000002'), NULL::INT,
  'produto sem controle de estoque continua NULL');
SELECT results_eq(
  $$SELECT amount, type FROM public.transactions WHERE user_id = '11111111-1111-1111-1111-111111111111'$$,
  $$VALUES (-14.50::NUMERIC, 'debit'::TEXT)$$,
  'debito registrado no extrato');

-- ---------------------------------------------------------------------------
-- Idempotencia
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE order1_retry AS
SELECT * FROM public.create_lanchonete_self_order(
  '11111111-1111-1111-1111-111111111111',
  '[{"productId":"aaaaaaaa-0000-0000-0000-000000000001","quantity":2}]',
  'cccccccc-0000-0000-0000-000000000001');

SELECT is((SELECT sale_id FROM order1_retry), (SELECT sale_id FROM order1), 'retry devolve o mesmo pedido');
SELECT is((SELECT already_existed FROM order1_retry), TRUE, 'retry sinaliza pedido existente');
SELECT is((SELECT balance FROM public.app_users WHERE id = '11111111-1111-1111-1111-111111111111'), 35.50::NUMERIC,
  'retry nao debita de novo');

-- Mesmo request id de outro usuario nao colide
CREATE TEMP TABLE order_other_user AS
SELECT * FROM public.create_lanchonete_self_order(
  '22222222-2222-2222-2222-222222222222',
  '[{"productId":"aaaaaaaa-0000-0000-0000-000000000002","quantity":1}]',
  'cccccccc-0000-0000-0000-000000000001');
SELECT is((SELECT already_existed FROM order_other_user), FALSE, 'request id e por usuario');

-- ---------------------------------------------------------------------------
-- Limite de pedidos em aberto (3)
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE order2 AS
SELECT * FROM public.create_lanchonete_self_order('11111111-1111-1111-1111-111111111111',
  '[{"productId":"aaaaaaaa-0000-0000-0000-000000000002","quantity":1}]', 'cccccccc-0000-0000-0000-000000000002');
CREATE TEMP TABLE order3 AS
SELECT * FROM public.create_lanchonete_self_order('11111111-1111-1111-1111-111111111111',
  '[{"productId":"aaaaaaaa-0000-0000-0000-000000000002","quantity":1}]', 'cccccccc-0000-0000-0000-000000000003');

SELECT throws_ok(
  $$SELECT * FROM public.create_lanchonete_self_order('11111111-1111-1111-1111-111111111111',
    '[{"productId":"aaaaaaaa-0000-0000-0000-000000000002","quantity":1}]', gen_random_uuid())$$,
  'P0001', 'TOO_MANY_OPEN_ORDERS', 'quarto pedido em aberto bloqueado');

-- ---------------------------------------------------------------------------
-- Transicoes de status
-- ---------------------------------------------------------------------------
SELECT throws_ok(
  format($$SELECT * FROM public.update_lanchonete_order_status(%L, 'ready', '33333333-3333-3333-3333-333333333333')$$,
    (SELECT sale_id FROM order1)),
  'P0001', 'INVALID_STATUS_TRANSITION', 'nao pula de pending para ready');

SELECT throws_ok(
  format($$SELECT * FROM public.update_lanchonete_order_status(%L, 'completed', '33333333-3333-3333-3333-333333333333')$$,
    (SELECT sale_id FROM order1)),
  '22023', 'INVALID_STATUS', 'status alvo invalido');

SELECT is(
  (SELECT status FROM public.update_lanchonete_order_status((SELECT sale_id FROM order1), 'preparing',
    '33333333-3333-3333-3333-333333333333')),
  'preparing', 'pending -> preparing');
SELECT is(
  (SELECT status FROM public.update_lanchonete_order_status((SELECT sale_id FROM order1), 'ready',
    '33333333-3333-3333-3333-333333333333')),
  'ready', 'preparing -> ready');
SELECT is((SELECT status_updated_by FROM public.sales WHERE id = (SELECT sale_id FROM order1)),
  '33333333-3333-3333-3333-333333333333'::UUID, 'registra quem mudou o status');

-- Venda de balcao nao entra no fluxo de autoatendimento
INSERT INTO public.sales (id, user_id, seller_id, category, total, status)
VALUES ('dddddddd-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
        '33333333-3333-3333-3333-333333333333', 'lanchonete', 5.00, 'completed');
SELECT throws_ok(
  $$SELECT * FROM public.update_lanchonete_order_status('dddddddd-0000-0000-0000-000000000001', 'preparing',
    '33333333-3333-3333-3333-333333333333')$$,
  'P0002', 'ORDER_NOT_FOUND', 'venda de balcao nao e alterada');
SELECT is((SELECT origin FROM public.sales WHERE id = 'dddddddd-0000-0000-0000-000000000001'), 'balcao',
  'venda de balcao recebe origin balcao por padrao');

-- ---------------------------------------------------------------------------
-- Cancelamento e estorno
-- ---------------------------------------------------------------------------
SELECT throws_ok(
  format($$SELECT * FROM public.cancel_lanchonete_order(%L, '11111111-1111-1111-1111-111111111111', FALSE)$$,
    (SELECT sale_id FROM order1)),
  'P0001', 'INVALID_STATUS_TRANSITION', 'usuario nao cancela pedido que nao esta pending');

SELECT throws_ok(
  format($$SELECT * FROM public.cancel_lanchonete_order(%L, '22222222-2222-2222-2222-222222222222', FALSE)$$,
    (SELECT sale_id FROM order2)),
  'P0002', 'ORDER_NOT_FOUND', 'usuario nao cancela pedido de outra pessoa');

CREATE TEMP TABLE cancel2 AS
SELECT * FROM public.cancel_lanchonete_order((SELECT sale_id FROM order2), '11111111-1111-1111-1111-111111111111', FALSE);
SELECT is((SELECT refunded_amount FROM cancel2), 4.50::NUMERIC, 'usuario cancela o proprio pedido pending');
SELECT is((SELECT balance FROM public.app_users WHERE id = '11111111-1111-1111-1111-111111111111'),
  (SELECT new_balance FROM order3) + 4.50, 'estorno devolve o saldo');
SELECT is((SELECT status FROM public.sales WHERE id = (SELECT sale_id FROM order2)), 'cancelled', 'pedido cancelado');

SELECT throws_ok(
  format($$SELECT * FROM public.cancel_lanchonete_order(%L, '33333333-3333-3333-3333-333333333333', TRUE)$$,
    (SELECT sale_id FROM order2)),
  'P0001', 'INVALID_STATUS_TRANSITION', 'pedido ja cancelado nao estorna de novo');

-- Equipe cancela pedido em 'ready': devolve saldo e estoque
CREATE TEMP TABLE balance_before AS
SELECT balance FROM public.app_users WHERE id = '11111111-1111-1111-1111-111111111111';
SELECT is(
  (SELECT refunded_amount FROM public.cancel_lanchonete_order((SELECT sale_id FROM order1),
    '33333333-3333-3333-3333-333333333333', TRUE)),
  14.50::NUMERIC, 'equipe cancela pedido ready');
SELECT is((SELECT balance FROM public.app_users WHERE id = '11111111-1111-1111-1111-111111111111'),
  (SELECT balance FROM balance_before) + 14.50, 'estorno da equipe devolve o saldo');
SELECT is((SELECT stock FROM public.products WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001'), 10,
  'estorno devolve o estoque');
SELECT is((SELECT COUNT(*)::INT FROM public.transactions
  WHERE user_id = '11111111-1111-1111-1111-111111111111' AND type = 'credit'), 2, 'estornos registrados no extrato');

-- Entregue nao pode ser cancelado
SELECT lives_ok(
  format($$SELECT * FROM public.update_lanchonete_order_status(%L, 'preparing', '33333333-3333-3333-3333-333333333333');
           SELECT * FROM public.update_lanchonete_order_status(%L, 'ready', '33333333-3333-3333-3333-333333333333');
           SELECT * FROM public.update_lanchonete_order_status(%L, 'delivered', '33333333-3333-3333-3333-333333333333')$$,
    (SELECT sale_id FROM order3), (SELECT sale_id FROM order3), (SELECT sale_id FROM order3)),
  'fluxo completo ate delivered');
SELECT isnt((SELECT delivered_at FROM public.sales WHERE id = (SELECT sale_id FROM order3)), NULL,
  'delivered_at preenchido');
SELECT throws_ok(
  format($$SELECT * FROM public.cancel_lanchonete_order(%L, '33333333-3333-3333-3333-333333333333', TRUE)$$,
    (SELECT sale_id FROM order3)),
  'P0001', 'INVALID_STATUS_TRANSITION', 'pedido entregue nao pode ser cancelado');

SELECT * FROM finish();
ROLLBACK;
