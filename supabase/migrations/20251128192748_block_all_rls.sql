-- ============================================
-- BLOQUEAR TUDO NO RLS - APENAS EDGE FUNCTIONS
-- ============================================
-- 
-- Esta migration bloqueia TODAS as operações para role 'public' (usuários autenticados).
-- Edge Functions continuam funcionando porque usam SUPABASE_SERVICE_ROLE_KEY que bypassa RLS.
--
-- Arquitetura:
-- - Frontend → Edge Functions (via api-client.ts)
-- - Edge Functions → Banco (usando service_role_key, bypassa RLS)
-- - Nenhum acesso direto ao banco pelo frontend
--
-- Data: 2025-11-28
-- ============================================

-- ============================================
-- 1. HABILITAR RLS EM TABELAS QUE NÃO TÊM
-- ============================================

ALTER TABLE sapatinho_veloz_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE sapatinho_veloz_order_items ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. REMOVER TODAS AS POLÍTICAS EXISTENTES
-- ============================================

-- app_users
DROP POLICY IF EXISTS "Users can insert own app_users row" ON app_users;
DROP POLICY IF EXISTS "Users can read own app_users row" ON app_users;
DROP POLICY IF EXISTS "Users can update own app_users row" ON app_users;
DROP POLICY IF EXISTS "auth" ON app_users;
DROP POLICY IF EXISTS "auth users" ON app_users;

-- cards
DROP POLICY IF EXISTS "Users can insert their own cards" ON cards;
DROP POLICY IF EXISTS "Users can update their own cards" ON cards;
DROP POLICY IF EXISTS "Users can view their own cards" ON cards;
DROP POLICY IF EXISTS "cards_associate" ON cards;
DROP POLICY IF EXISTS "Users can view their own card" ON cards;
DROP POLICY IF EXISTS "Admin and comunicacao can create cards" ON cards;
DROP POLICY IF EXISTS "Admin and comunicacao can update cards" ON cards;
DROP POLICY IF EXISTS "Service role can manage cards" ON cards;

-- coupons
DROP POLICY IF EXISTS "Users can manage coupons" ON coupons;
DROP POLICY IF EXISTS "Users can update coupons" ON coupons;

-- lanchonete_coupons
DROP POLICY IF EXISTS "Admins and lanchonete can manage lanchonete coupons" ON lanchonete_coupons;
DROP POLICY IF EXISTS "Everyone can view active lanchonete coupons" ON lanchonete_coupons;

-- orders
DROP POLICY IF EXISTS "Users can manage orders" ON orders;
DROP POLICY IF EXISTS "Users can view orders" ON orders;
DROP POLICY IF EXISTS "Authenticated users can view orders" ON orders;
DROP POLICY IF EXISTS "Service role can manage orders" ON orders;

-- pix_payments
DROP POLICY IF EXISTS "Users can insert pix payments" ON pix_payments;
DROP POLICY IF EXISTS "Users can update pix payments" ON pix_payments;
DROP POLICY IF EXISTS "Users can view their pix payments" ON pix_payments;

-- products
DROP POLICY IF EXISTS "Users can manage products" ON products;
DROP POLICY IF EXISTS "Users can view active products" ON products;
DROP POLICY IF EXISTS "Anyone can view active products" ON products;
DROP POLICY IF EXISTS "Service role can manage products" ON products;
DROP POLICY IF EXISTS "Service role can update products" ON products;
DROP POLICY IF EXISTS "Service role can delete products" ON products;

-- sale_items
DROP POLICY IF EXISTS "Users can insert sale items" ON sale_items;
DROP POLICY IF EXISTS "Users can view sale items" ON sale_items;
DROP POLICY IF EXISTS "Service role can manage sale items" ON sale_items;
DROP POLICY IF EXISTS "Users can view their own sale items" ON sale_items;

-- sales
DROP POLICY IF EXISTS "Users can insert sales" ON sales;
DROP POLICY IF EXISTS "Users can view sales" ON sales;
DROP POLICY IF EXISTS "Users can view their own sales" ON sales;
DROP POLICY IF EXISTS "Sellers can view their sales" ON sales;
DROP POLICY IF EXISTS "Service role can manage sales" ON sales;

-- sapatinho_products
DROP POLICY IF EXISTS "Users can manage sapatinho products" ON sapatinho_products;
DROP POLICY IF EXISTS "Users can view sapatinho products" ON sapatinho_products;

-- sapatinho_sale_items
DROP POLICY IF EXISTS "Users can insert sapatinho sale items" ON sapatinho_sale_items;
DROP POLICY IF EXISTS "Users can view sapatinho sale items" ON sapatinho_sale_items;
DROP POLICY IF EXISTS "Service role can manage sapatinho sale items" ON sapatinho_sale_items;
DROP POLICY IF EXISTS "Users can view their own sapatinho sale items" ON sapatinho_sale_items;

-- sapatinho_sales
DROP POLICY IF EXISTS "Users can insert sapatinho sales" ON sapatinho_sales;
DROP POLICY IF EXISTS "Users can view sapatinho sales" ON sapatinho_sales;
DROP POLICY IF EXISTS "Users can view their own sapatinho sales" ON sapatinho_sales;
DROP POLICY IF EXISTS "Sellers can view their sapatinho sales" ON sapatinho_sales;
DROP POLICY IF EXISTS "Service role can manage sapatinho sales" ON sapatinho_sales;

-- sapatinho_veloz_orders
DROP POLICY IF EXISTS "Authenticated users can view sapatinho orders" ON sapatinho_veloz_orders;
DROP POLICY IF EXISTS "Service role can manage sapatinho orders" ON sapatinho_veloz_orders;

-- sapatinho_veloz_order_items
-- (não tinha políticas antes)

-- transactions
DROP POLICY IF EXISTS "Users can insert transactions" ON transactions;
DROP POLICY IF EXISTS "Users can view card transactions" ON transactions;
DROP POLICY IF EXISTS "Users can view their own transactions" ON transactions;
DROP POLICY IF EXISTS "Service role can manage transactions" ON transactions;

-- user (Better Auth)
DROP POLICY IF EXISTS "Admins can view all users" ON "user";
DROP POLICY IF EXISTS "Users can update own data" ON "user";
DROP POLICY IF EXISTS "Users can view own data" ON "user";

-- ============================================
-- 3. CRIAR POLÍTICAS QUE BLOQUEIAM TUDO PARA 'public'
--    (Edge Functions continuam funcionando via service_role)
-- ============================================

-- app_users: Bloquear tudo para public
CREATE POLICY "block_public_app_users" ON app_users
  FOR ALL
  TO public
  USING (false)
  WITH CHECK (false);

-- cards: Bloquear tudo para public
CREATE POLICY "block_public_cards" ON cards
  FOR ALL
  TO public
  USING (false)
  WITH CHECK (false);

-- coupons: Bloquear tudo para public
CREATE POLICY "block_public_coupons" ON coupons
  FOR ALL
  TO public
  USING (false)
  WITH CHECK (false);

-- lanchonete_coupons: Bloquear tudo para public
CREATE POLICY "block_public_lanchonete_coupons" ON lanchonete_coupons
  FOR ALL
  TO public
  USING (false)
  WITH CHECK (false);

-- orders: Bloquear tudo para public
CREATE POLICY "block_public_orders" ON orders
  FOR ALL
  TO public
  USING (false)
  WITH CHECK (false);

-- pix_payments: Bloquear tudo para public
CREATE POLICY "block_public_pix_payments" ON pix_payments
  FOR ALL
  TO public
  USING (false)
  WITH CHECK (false);

-- products: Bloquear tudo para public
CREATE POLICY "block_public_products" ON products
  FOR ALL
  TO public
  USING (false)
  WITH CHECK (false);

-- sale_items: Bloquear tudo para public
CREATE POLICY "block_public_sale_items" ON sale_items
  FOR ALL
  TO public
  USING (false)
  WITH CHECK (false);

-- sales: Bloquear tudo para public
CREATE POLICY "block_public_sales" ON sales
  FOR ALL
  TO public
  USING (false)
  WITH CHECK (false);

-- sapatinho_products: Bloquear tudo para public
CREATE POLICY "block_public_sapatinho_products" ON sapatinho_products
  FOR ALL
  TO public
  USING (false)
  WITH CHECK (false);

-- sapatinho_sale_items: Bloquear tudo para public
CREATE POLICY "block_public_sapatinho_sale_items" ON sapatinho_sale_items
  FOR ALL
  TO public
  USING (false)
  WITH CHECK (false);

-- sapatinho_sales: Bloquear tudo para public
CREATE POLICY "block_public_sapatinho_sales" ON sapatinho_sales
  FOR ALL
  TO public
  USING (false)
  WITH CHECK (false);

-- sapatinho_veloz_orders: Bloquear tudo para public
CREATE POLICY "block_public_sapatinho_veloz_orders" ON sapatinho_veloz_orders
  FOR ALL
  TO public
  USING (false)
  WITH CHECK (false);

-- sapatinho_veloz_order_items: Bloquear tudo para public
CREATE POLICY "block_public_sapatinho_veloz_order_items" ON sapatinho_veloz_order_items
  FOR ALL
  TO public
  USING (false)
  WITH CHECK (false);

-- transactions: Bloquear tudo para public
CREATE POLICY "block_public_transactions" ON transactions
  FOR ALL
  TO public
  USING (false)
  WITH CHECK (false);

-- user (Better Auth): Bloquear tudo para public
CREATE POLICY "block_public_user" ON "user"
  FOR ALL
  TO public
  USING (false)
  WITH CHECK (false);

-- ============================================
-- 4. COMENTÁRIOS EXPLICATIVOS
-- ============================================

COMMENT ON POLICY "block_public_app_users" ON app_users IS 
'Bloqueia todo acesso direto ao banco. Edge Functions (service_role) continuam funcionando.';

COMMENT ON POLICY "block_public_cards" ON cards IS 
'Bloqueia todo acesso direto ao banco. Edge Functions (service_role) continuam funcionando.';

COMMENT ON POLICY "block_public_products" ON products IS 
'Bloqueia todo acesso direto ao banco. Edge Functions (service_role) continuam funcionando.';

COMMENT ON POLICY "block_public_sales" ON sales IS 
'Bloqueia todo acesso direto ao banco. Edge Functions (service_role) continuam funcionando.';

-- ============================================
-- NOTA FINAL
-- ============================================
-- 
-- ✅ Todas as tabelas agora bloqueiam acesso para role 'public'
-- ✅ Edge Functions continuam funcionando (usam service_role_key que bypassa RLS)
-- ✅ Frontend não pode mais acessar banco diretamente (já estava bloqueado no código)
-- ✅ Arquitetura segura: Frontend → Edge Functions → Banco
--
-- Para testar:
-- 1. Verificar que Edge Functions continuam funcionando
-- 2. Tentar acesso direto deve falhar (esperado)
-- 3. Frontend deve continuar funcionando normalmente
--
-- ============================================

