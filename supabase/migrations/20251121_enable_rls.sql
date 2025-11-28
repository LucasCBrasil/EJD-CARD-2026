-- ============================================
-- ATIVAR ROW LEVEL SECURITY (RLS)
-- Protege tabelas críticas contra acesso não autorizado
-- ============================================

-- 1. ATIVAR RLS EM TODAS AS TABELAS CRÍTICAS
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sapatinho_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sapatinho_sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE sapatinho_veloz_orders ENABLE ROW LEVEL SECURITY;

-- ============================================
-- POLÍTICAS PARA CARDS
-- ============================================

-- Usuários podem ver apenas seu próprio cartão
-- Usuários veem próprio cartão OU admin/lojinha/lanchonete/comunicacao veem TODOS
CREATE POLICY "Users can view their own card"
ON cards FOR SELECT
USING (
  auth.uid()::text = user_id 
  OR 
  EXISTS (
    SELECT 1 FROM app_users 
    WHERE app_users.id = auth.uid() 
    AND app_users.role IN ('admin', 'lojinha', 'lanchonete', 'comunicacao')
  )
);

-- Admin e comunicacao podem criar cards
CREATE POLICY "Admin and comunicacao can create cards"
ON cards FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM app_users 
    WHERE app_users.id = auth.uid() 
    AND app_users.role IN ('admin', 'comunicacao')
  )
);

-- Admin e comunicacao podem editar cards
CREATE POLICY "Admin and comunicacao can update cards"
ON cards FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM app_users 
    WHERE app_users.id = auth.uid() 
    AND app_users.role IN ('admin', 'comunicacao')
  )
);

-- Apenas service_role pode deletar cards (na verdade, ninguém deleta)
-- (Edge Functions usam service_role)
CREATE POLICY "Service role can manage cards"
ON cards FOR ALL
USING (auth.role() = 'service_role');

-- ============================================
-- POLÍTICAS PARA SALES (lojinha/lanchonete)
-- ============================================

-- Usuários podem ver suas próprias vendas
CREATE POLICY "Users can view their own sales"
ON sales FOR SELECT
USING (auth.uid()::text = (SELECT user_id FROM cards WHERE id = sales.card_id));

-- Vendedores podem ver vendas que criaram
CREATE POLICY "Sellers can view their sales"
ON sales FOR SELECT
USING (auth.uid()::text = seller_id::text);

-- Apenas service_role pode criar/atualizar vendas
CREATE POLICY "Service role can manage sales"
ON sales FOR ALL
USING (auth.role() = 'service_role');

-- ============================================
-- POLÍTICAS PARA SALE_ITEMS
-- ============================================

-- Seguir mesmas regras da tabela sales
CREATE POLICY "Service role can manage sale items"
ON sale_items FOR ALL
USING (auth.role() = 'service_role');

CREATE POLICY "Users can view their own sale items"
ON sale_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM sales 
    WHERE sales.id = sale_items.sale_id 
    AND auth.uid()::text = (SELECT user_id FROM cards WHERE id = sales.card_id)
  )
);

-- ============================================
-- POLÍTICAS PARA SAPATINHO_SALES
-- ============================================

-- Usuários podem ver suas próprias vendas do sapatinho
CREATE POLICY "Users can view their own sapatinho sales"
ON sapatinho_sales FOR SELECT
USING (auth.uid()::text = (SELECT user_id FROM cards WHERE id = sapatinho_sales.card_id));

-- Vendedores podem ver vendas que criaram
CREATE POLICY "Sellers can view their sapatinho sales"
ON sapatinho_sales FOR SELECT
USING (auth.uid()::text = seller_id);

-- Apenas service_role pode criar/atualizar
CREATE POLICY "Service role can manage sapatinho sales"
ON sapatinho_sales FOR ALL
USING (auth.role() = 'service_role');

-- ============================================
-- POLÍTICAS PARA SAPATINHO_SALE_ITEMS
-- ============================================

CREATE POLICY "Service role can manage sapatinho sale items"
ON sapatinho_sale_items FOR ALL
USING (auth.role() = 'service_role');

CREATE POLICY "Users can view their own sapatinho sale items"
ON sapatinho_sale_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM sapatinho_sales 
    WHERE sapatinho_sales.id = sapatinho_sale_items.sale_id 
    AND auth.uid()::text = (SELECT user_id FROM cards WHERE id = sapatinho_sales.card_id)
  )
);

-- ============================================
-- POLÍTICAS PARA TRANSACTIONS
-- ============================================

-- Usuários podem ver apenas transações do seu cartão
CREATE POLICY "Users can view their own transactions"
ON transactions FOR SELECT
USING (auth.uid()::text = (SELECT user_id FROM cards WHERE id = transactions.card_id));

-- Apenas service_role pode criar transações
CREATE POLICY "Service role can manage transactions"
ON transactions FOR ALL
USING (auth.role() = 'service_role');

-- ============================================
-- POLÍTICAS PARA PRODUCTS
-- ============================================

-- Todos podem ver produtos ativos (leitura pública)
CREATE POLICY "Anyone can view active products"
ON products FOR SELECT
USING (active = true);

-- Apenas service_role pode criar/atualizar/deletar produtos
CREATE POLICY "Service role can manage products"
ON products FOR INSERT
USING (auth.role() = 'service_role');

CREATE POLICY "Service role can update products"
ON products FOR UPDATE
USING (auth.role() = 'service_role');

CREATE POLICY "Service role can delete products"
ON products FOR DELETE
USING (auth.role() = 'service_role');

-- ============================================
-- POLÍTICAS PARA ORDERS
-- ============================================

-- Vendedores podem ver pedidos
CREATE POLICY "Authenticated users can view orders"
ON orders FOR SELECT
USING (auth.role() IS NOT NULL);

-- Apenas service_role pode gerenciar pedidos
CREATE POLICY "Service role can manage orders"
ON orders FOR ALL
USING (auth.role() = 'service_role');

-- ============================================
-- POLÍTICAS PARA SAPATINHO_VELOZ_ORDERS
-- ============================================

-- Vendedores podem ver pedidos do sapatinho
CREATE POLICY "Authenticated users can view sapatinho orders"
ON sapatinho_veloz_orders FOR SELECT
USING (auth.role() IS NOT NULL);

-- Apenas service_role pode gerenciar pedidos
CREATE POLICY "Service role can manage sapatinho orders"
ON sapatinho_veloz_orders FOR ALL
USING (auth.role() = 'service_role');

-- ============================================
-- COMENTÁRIOS E NOTAS
-- ============================================

COMMENT ON POLICY "Users can view their own card" ON cards IS 
'Usuários autenticados só podem ver seu próprio cartão (vinculado por user_id)';

COMMENT ON POLICY "Service role can manage cards" ON cards IS 
'Edge Functions (usando service_role key) têm controle total sobre cards';

COMMENT ON POLICY "Anyone can view active products" ON products IS 
'Produtos ativos são públicos para todos verem (necessário para lojinha/lanchonete)';

