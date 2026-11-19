-- Testes das reservas e finalizacao dos carrinhos compartilhados da Lojinha.
-- Rodar: supabase test db (banco local com setup e migrations aplicados)
BEGIN;
SELECT no_plan();

INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('44444444-4444-4444-4444-444444444444', 'cart-customer@test.local', '{"name":"Cliente Carrinho"}'),
  ('55555555-5555-5555-5555-555555555555', 'cart-seller@test.local', '{"name":"Atendente"}');

UPDATE public.app_users
SET balance = 100.00
WHERE id = '44444444-4444-4444-4444-444444444444';

UPDATE public.app_users
SET role = 'lojinha'
WHERE id = '55555555-5555-5555-5555-555555555555';

INSERT INTO public.products (id, name, price, category, stock, active)
VALUES (
  'aaaaaaaa-1111-1111-1111-111111111111',
  'Produto carrinho teste',
  20.00,
  'lojinha',
  10,
  TRUE
);

SELECT ok(NOT has_function_privilege(
  'authenticated',
  'public.add_lojinha_cart_item(uuid,uuid,integer)',
  'EXECUTE'
), 'authenticated nao executa a RPC de reserva');
SELECT ok(has_function_privilege(
  'service_role',
  'public.checkout_lojinha_cart(uuid,uuid,uuid,bigint,text)',
  'EXECUTE'
), 'service_role executa a RPC de checkout');

CREATE TEMP TABLE test_cart_ids AS
SELECT public.get_or_create_lojinha_cart(
  '44444444-4444-4444-4444-444444444444',
  '55555555-5555-5555-5555-555555555555'
) AS cancel_cart_id, NULL::UUID AS checkout_cart_id;

SELECT public.add_lojinha_cart_item(
  (SELECT cancel_cart_id FROM test_cart_ids),
  'aaaaaaaa-1111-1111-1111-111111111111',
  2
);

SELECT is(
  (SELECT stock FROM public.products WHERE id = 'aaaaaaaa-1111-1111-1111-111111111111'),
  8,
  'adicionar dois itens reserva duas unidades'
);

SELECT public.add_lojinha_cart_item(
  (SELECT cancel_cart_id FROM test_cart_ids),
  'aaaaaaaa-1111-1111-1111-111111111111',
  1
);

SELECT is(
  (SELECT quantity FROM public.lojinha_cart_items
   WHERE cart_id = (SELECT cancel_cart_id FROM test_cart_ids)
     AND product_id = 'aaaaaaaa-1111-1111-1111-111111111111'),
  3,
  'adicionar novamente aumenta a quantidade persistida'
);

SELECT public.decrease_lojinha_cart_item(
  (SELECT cancel_cart_id FROM test_cart_ids),
  'aaaaaaaa-1111-1111-1111-111111111111'
);

SELECT is(
  (SELECT stock FROM public.products WHERE id = 'aaaaaaaa-1111-1111-1111-111111111111'),
  8,
  'diminuir item devolve uma unidade ao estoque'
);
SELECT is(
  (SELECT reserved_quantity FROM public.lojinha_cart_items
   WHERE cart_id = (SELECT cancel_cart_id FROM test_cart_ids)
     AND product_id = 'aaaaaaaa-1111-1111-1111-111111111111'),
  2,
  'quantidade reservada acompanha a quantidade efetiva'
);

SELECT public.cancel_lojinha_cart(
  (SELECT cancel_cart_id FROM test_cart_ids),
  '55555555-5555-5555-5555-555555555555'
);
SELECT public.cancel_lojinha_cart(
  (SELECT cancel_cart_id FROM test_cart_ids),
  '55555555-5555-5555-5555-555555555555'
);

SELECT is(
  (SELECT stock FROM public.products WHERE id = 'aaaaaaaa-1111-1111-1111-111111111111'),
  10,
  'cancelar devolve o estoque uma unica vez mesmo se repetido'
);

UPDATE test_cart_ids
SET checkout_cart_id = public.get_or_create_lojinha_cart(
  '44444444-4444-4444-4444-444444444444',
  '55555555-5555-5555-5555-555555555555'
);

SELECT public.add_lojinha_cart_item(
  (SELECT checkout_cart_id FROM test_cart_ids),
  'aaaaaaaa-1111-1111-1111-111111111111',
  2
);

SELECT is(
  (SELECT stock FROM public.products WHERE id = 'aaaaaaaa-1111-1111-1111-111111111111'),
  8,
  'novo carrinho reserva estoque apos cancelamento'
);

CREATE TEMP TABLE test_stale_cart_version AS
SELECT version
FROM public.lojinha_carts
WHERE id = (SELECT checkout_cart_id FROM test_cart_ids);

SELECT public.add_lojinha_cart_item(
  (SELECT checkout_cart_id FROM test_cart_ids),
  'aaaaaaaa-1111-1111-1111-111111111111',
  1
);
SELECT public.decrease_lojinha_cart_item(
  (SELECT checkout_cart_id FROM test_cart_ids),
  'aaaaaaaa-1111-1111-1111-111111111111'
);

SELECT throws_ok(
  $$SELECT * FROM public.checkout_lojinha_cart(
    (SELECT checkout_cart_id FROM test_cart_ids),
    '44444444-4444-4444-4444-444444444444',
    '55555555-5555-5555-5555-555555555555',
    (SELECT version FROM test_stale_cart_version),
    NULL
  )$$,
  'P0001',
  'CART_CHANGED',
  'checkout rejeita uma versao desatualizada do carrinho'
);

UPDATE public.app_users
SET balance = 10.00
WHERE id = '44444444-4444-4444-4444-444444444444';

SELECT throws_ok(
  $$SELECT * FROM public.checkout_lojinha_cart(
    (SELECT checkout_cart_id FROM test_cart_ids),
    '44444444-4444-4444-4444-444444444444',
    '55555555-5555-5555-5555-555555555555',
    (SELECT version FROM public.lojinha_carts WHERE id = (SELECT checkout_cart_id FROM test_cart_ids)),
    NULL
  )$$,
  'P0001',
  'INSUFFICIENT_BALANCE',
  'checkout com saldo insuficiente e rejeitado'
);
SELECT is(
  (SELECT status FROM public.lojinha_carts WHERE id = (SELECT checkout_cart_id FROM test_cart_ids)),
  'open',
  'falha no checkout mantem carrinho aberto'
);
SELECT is(
  (SELECT stock FROM public.products WHERE id = 'aaaaaaaa-1111-1111-1111-111111111111'),
  8,
  'falha no checkout mantem reserva sem descontar novamente'
);

UPDATE public.app_users
SET balance = 100.00
WHERE id = '44444444-4444-4444-4444-444444444444';

CREATE TEMP TABLE test_checkout AS
SELECT *
FROM public.checkout_lojinha_cart(
  (SELECT checkout_cart_id FROM test_cart_ids),
  '44444444-4444-4444-4444-444444444444',
  '55555555-5555-5555-5555-555555555555',
  (SELECT version FROM public.lojinha_carts WHERE id = (SELECT checkout_cart_id FROM test_cart_ids)),
  NULL
);

SELECT is((SELECT total FROM test_checkout), 40.00::NUMERIC, 'checkout cobra o total dos itens reservados');
SELECT is(
  (SELECT balance FROM public.app_users WHERE id = '44444444-4444-4444-4444-444444444444'),
  60.00::NUMERIC,
  'checkout debita o saldo uma unica vez'
);
SELECT is(
  (SELECT status FROM public.lojinha_carts WHERE id = (SELECT checkout_cart_id FROM test_cart_ids)),
  'completed',
  'carrinho e convertido em venda'
);

CREATE TEMP TABLE test_checkout_retry AS
SELECT * FROM public.checkout_lojinha_cart(
  (SELECT checkout_cart_id FROM test_cart_ids),
  '44444444-4444-4444-4444-444444444444',
  '55555555-5555-5555-5555-555555555555',
  (SELECT version FROM public.lojinha_carts WHERE id = (SELECT checkout_cart_id FROM test_cart_ids)),
  NULL
);

SELECT is((SELECT already_completed FROM test_checkout_retry), TRUE, 'checkout repetido e reconhecido como idempotente');
SELECT is(
  (SELECT balance FROM public.app_users WHERE id = '44444444-4444-4444-4444-444444444444'),
  60.00::NUMERIC,
  'repetir checkout nao debita o saldo novamente'
);

SELECT is(
  (SELECT stock FROM public.products WHERE id = 'aaaaaaaa-1111-1111-1111-111111111111'),
  8,
  'checkout nao desconta novamente o estoque ja reservado'
);
SELECT is(
  (SELECT COUNT(*) FROM public.orders WHERE sale_id = (SELECT sale_id FROM test_checkout)),
  1::BIGINT,
  'checkout cria o pedido da lojinha'
);
SELECT * FROM finish();
ROLLBACK;
