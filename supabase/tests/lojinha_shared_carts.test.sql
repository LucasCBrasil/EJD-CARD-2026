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
SELECT ok(NOT has_function_privilege(
  'authenticated',
  'public.add_lojinha_cart_item(uuid,uuid,integer,text)',
  'EXECUTE'
), 'authenticated nao executa a RPC de reserva com tamanho');
SELECT ok(NOT has_function_privilege(
  'authenticated',
  'public.set_lojinha_cart_item_quantity(uuid,uuid,integer)',
  'EXECUTE'
), 'authenticated nao executa a RPC antiga de quantidade');
SELECT ok(NOT has_function_privilege(
  'authenticated',
  'public.set_lojinha_cart_item_quantity(uuid,uuid,text,integer)',
  'EXECUTE'
), 'authenticated nao executa a RPC de quantidade com tamanho');
SELECT ok(NOT has_function_privilege(
  'authenticated',
  'public.decrease_lojinha_cart_item(uuid,uuid)',
  'EXECUTE'
), 'authenticated nao executa a RPC antiga de diminuicao');
SELECT ok(NOT has_function_privilege(
  'authenticated',
  'public.decrease_lojinha_cart_item(uuid,uuid,text)',
  'EXECUTE'
), 'authenticated nao executa a RPC de diminuicao com tamanho');
SELECT ok(NOT has_function_privilege(
  'authenticated',
  'public.cancel_lojinha_cart(uuid,uuid)',
  'EXECUTE'
), 'authenticated nao executa a RPC de cancelamento');
SELECT ok(NOT has_function_privilege(
  'authenticated',
  'public.checkout_lojinha_cart(uuid,uuid,uuid,bigint,text)',
  'EXECUTE'
), 'authenticated nao executa a RPC de checkout');
SELECT ok(has_function_privilege(
  'service_role',
  'public.checkout_lojinha_cart(uuid,uuid,uuid,bigint,text)',
  'EXECUTE'
), 'service_role executa a RPC de checkout');
SELECT ok(EXISTS (
  SELECT 1
  FROM pg_constraint
  WHERE conrelid = 'public.orders'::REGCLASS
    AND contype = 'u'
    AND pg_get_constraintdef(oid) = 'UNIQUE (order_code)'
), 'orders.order_code possui constraint unica');
SELECT is(
  public.valid_lojinha_size_stock('{"P": 2, "M": 3}'::JSONB),
  TRUE,
  'validacao aceita estoque positivo para tamanhos conhecidos'
);
SELECT is(
  public.valid_lojinha_size_stock('{"X": 2}'::JSONB),
  FALSE,
  'validacao rejeita tamanhos desconhecidos'
);
SELECT is(
  public.valid_lojinha_size_stock('[2, 3]'::JSONB),
  FALSE,
  'validacao rejeita estoque que nao seja um objeto'
);

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
SELECT throws_ok(
  $$SELECT public.save_lojinha_product_with_sizes(
    'aaaaaaaa-1111-1111-1111-111111111111',
    'Produto carrinho teste',
    20.00,
    NULL,
    NULL,
    FALSE,
    '{"M": 8}'::JSONB,
    8,
    TRUE,
    NULL,
    8
  )$$,
  'P0001',
  'PRODUCT_SIZE_RESERVED',
  'nao permite converter produto convencional enquanto estiver em carrinho aberto'
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

UPDATE public.lojinha_cart_items
SET reserved_quantity = 1
WHERE cart_id = (SELECT cancel_cart_id FROM test_cart_ids)
  AND product_id = 'aaaaaaaa-1111-1111-1111-111111111111';
SELECT throws_ok(
  $$SELECT public.set_lojinha_cart_item_quantity(
    (SELECT cancel_cart_id FROM test_cart_ids),
    'aaaaaaaa-1111-1111-1111-111111111111',
    1
  )$$,
  'P0001',
  'CART_RESERVATION_INCONSISTENT',
  'alteracao de quantidade rejeita reserva inconsistente'
);
UPDATE public.lojinha_cart_items
SET reserved_quantity = quantity
WHERE cart_id = (SELECT cancel_cart_id FROM test_cart_ids)
  AND product_id = 'aaaaaaaa-1111-1111-1111-111111111111';

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
UPDATE public.lojinha_cart_items
SET reserved_quantity = 1
WHERE cart_id = (SELECT checkout_cart_id FROM test_cart_ids)
  AND product_id = 'aaaaaaaa-1111-1111-1111-111111111111';
SELECT throws_ok(
  $$SELECT * FROM public.checkout_lojinha_cart(
    (SELECT checkout_cart_id FROM test_cart_ids),
    '44444444-4444-4444-4444-444444444444',
    '55555555-5555-5555-5555-555555555555',
    (SELECT version FROM public.lojinha_carts WHERE id = (SELECT checkout_cart_id FROM test_cart_ids)),
    NULL
  )$$,
  'P0001',
  'PRODUCT_UNAVAILABLE',
  'checkout rejeita reserva inconsistente em produto convencional limitado'
);
UPDATE public.lojinha_cart_items
SET reserved_quantity = quantity
WHERE cart_id = (SELECT checkout_cart_id FROM test_cart_ids)
  AND product_id = 'aaaaaaaa-1111-1111-1111-111111111111';
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

CREATE TEMP TABLE test_size_product AS
SELECT saved.id AS product_id
FROM public.save_lojinha_product_with_sizes(
  NULL,
  'Camiseta tamanhos teste',
  12.00,
  'Teste de tamanhos',
  NULL,
  FALSE,
  '{"P": 2, "M": 3}'::JSONB,
  5,
  TRUE
) AS saved;

SELECT is(
  (SELECT stock FROM public.products WHERE id = (SELECT product_id FROM test_size_product)),
  5,
  'estoque total soma os estoques por tamanho'
);
SELECT throws_ok(
  $$SELECT public.save_lojinha_product_with_sizes(
    (SELECT product_id FROM test_size_product),
    'Camiseta tamanhos teste',
    12.00,
    'Teste de tamanhos',
    NULL,
    FALSE,
    '{"P": 2, "M": 3}'::JSONB,
    5,
    TRUE,
    '{"P": 2, "M": 3}'::JSONB,
    4
  )$$,
  'P0001',
  'PRODUCT_STOCK_CHANGED',
  'atualizacao rejeita estoque de referencia desatualizado'
);

CREATE TEMP TABLE test_size_cart AS
SELECT public.get_or_create_lojinha_cart(
  '44444444-4444-4444-4444-444444444444',
  '55555555-5555-5555-5555-555555555555'
) AS cart_id;

SELECT public.add_lojinha_cart_item(
  (SELECT cart_id FROM test_size_cart),
  (SELECT product_id FROM test_size_product),
  2,
  'M'
);

SELECT is(
  (SELECT size_stock ->> 'M' FROM public.products WHERE id = (SELECT product_id FROM test_size_product)),
  '1',
  'adicionar unidades reserva o estoque do tamanho selecionado'
);
SELECT is(
  (SELECT stock FROM public.products WHERE id = (SELECT product_id FROM test_size_product)),
  3,
  'reserva por tamanho atualiza o estoque total'
);

UPDATE public.lojinha_cart_items
SET variant_size = ''
WHERE cart_id = (SELECT cart_id FROM test_size_cart)
  AND product_id = (SELECT product_id FROM test_size_product);
SELECT throws_ok(
  $$SELECT public.cancel_lojinha_cart(
    (SELECT cart_id FROM test_size_cart),
    '55555555-5555-5555-5555-555555555555'
  )$$,
  'P0001',
  'CART_RESERVATION_INCONSISTENT',
  'cancelamento rejeita item com tamanho vazio em produto com tamanhos'
);
UPDATE public.lojinha_cart_items
SET variant_size = 'M'
WHERE cart_id = (SELECT cart_id FROM test_size_cart)
  AND product_id = (SELECT product_id FROM test_size_product);

UPDATE public.products
SET size_stock = '{"P": 2}'::JSONB
WHERE id = (SELECT product_id FROM test_size_product);
SELECT throws_ok(
  $$SELECT public.cancel_lojinha_cart(
    (SELECT cart_id FROM test_size_cart),
    '55555555-5555-5555-5555-555555555555'
  )$$,
  'P0001',
  'CART_RESERVATION_INCONSISTENT',
  'cancelamento rejeita tamanho ausente do estoque do produto'
);
UPDATE public.products
SET size_stock = '{"P": 2, "M": 1}'::JSONB
WHERE id = (SELECT product_id FROM test_size_product);

SELECT throws_ok(
  $$SELECT public.save_lojinha_product_with_sizes(
    (SELECT product_id FROM test_size_product),
    'Camiseta tamanhos teste',
    12.00,
    'Teste de tamanhos',
    NULL,
    FALSE,
    '{"P": 2, "M": 3}'::JSONB,
    5,
    TRUE,
    '{"P": 2, "M": 1}'::JSONB,
    3
  )$$,
  'P0001',
  'PRODUCT_SIZE_RESERVED',
  'alteracao de estoque e rejeitada enquanto ha tamanho reservado'
);

SELECT public.cancel_lojinha_cart(
  (SELECT cart_id FROM test_size_cart),
  '55555555-5555-5555-5555-555555555555'
);
SELECT is(
  (SELECT size_stock ->> 'M' FROM public.products WHERE id = (SELECT product_id FROM test_size_product)),
  '3',
  'cancelar o carrinho devolve o estoque ao tamanho reservado'
);
SELECT is(
  (SELECT stock FROM public.products WHERE id = (SELECT product_id FROM test_size_product)),
  5,
  'cancelamento restaura tambem o estoque total'
);

CREATE TEMP TABLE test_size_checkout_cart AS
SELECT public.get_or_create_lojinha_cart(
  '44444444-4444-4444-4444-444444444444',
  '55555555-5555-5555-5555-555555555555'
) AS cart_id;

SELECT public.add_lojinha_cart_item(
  (SELECT cart_id FROM test_size_checkout_cart),
  (SELECT product_id FROM test_size_product),
  1,
  'P'
);
CREATE TEMP TABLE test_size_checkout AS
SELECT *
FROM public.checkout_lojinha_cart(
  (SELECT cart_id FROM test_size_checkout_cart),
  '44444444-4444-4444-4444-444444444444',
  '55555555-5555-5555-5555-555555555555',
  (SELECT version FROM public.lojinha_carts WHERE id = (SELECT cart_id FROM test_size_checkout_cart)),
  NULL
);

SELECT is(
  (SELECT variant_size FROM public.sale_items WHERE sale_id = (SELECT sale_id FROM test_size_checkout)),
  'P',
  'checkout persiste o tamanho comprado no item da venda'
);
SELECT is(
  (SELECT product_name FROM public.sale_items WHERE sale_id = (SELECT sale_id FROM test_size_checkout)),
  'Camiseta tamanhos teste (P)',
  'descricao da venda inclui o tamanho para historicos legados'
);
SELECT is(
  (SELECT size_stock ->> 'P' FROM public.products WHERE id = (SELECT product_id FROM test_size_product)),
  '1',
  'checkout mantem descontado o estoque do tamanho comprado'
);

SELECT * FROM finish();
ROLLBACK;
