-- Script de configuração do banco de dados Supabase
-- Execute este script no SQL Editor do Supabase

-- Tabela: cards
CREATE TABLE IF NOT EXISTS cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    card_number TEXT UNIQUE NOT NULL,
    phone_number TEXT NOT NULL,
    balance NUMERIC(10,2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para cards
CREATE INDEX IF NOT EXISTS idx_cards_phone_number ON cards(phone_number);
CREATE INDEX IF NOT EXISTS idx_cards_card_number ON cards(card_number);
CREATE INDEX IF NOT EXISTS idx_cards_user_id ON cards(user_id);

-- Tabela: transactions
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    amount NUMERIC(10,2) NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
    description TEXT NOT NULL,
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para transactions
CREATE INDEX IF NOT EXISTS idx_transactions_card_id ON transactions(card_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);

-- Tabela: products
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    price NUMERIC(10,2) NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('lojinha', 'lanchonete')),
    description TEXT,
    stock INTEGER,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para products
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);

-- Tabela: sales
CREATE TABLE IF NOT EXISTS sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    seller_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    sale_number BIGSERIAL NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('lojinha', 'lanchonete')),
    total NUMERIC(10,2) NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('completed', 'delivered')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    delivered_at TIMESTAMP WITH TIME ZONE DEFAULT NULL
);

-- Criar sequências separadas por categoria
CREATE SEQUENCE IF NOT EXISTS sales_lojinha_seq;
CREATE SEQUENCE IF NOT EXISTS sales_lanchonete_seq;

-- Remover o default BIGSERIAL do PostgreSQL
ALTER TABLE public.sales
ALTER COLUMN sale_number DROP DEFAULT;

-- Função para escolher a sequência com base na categoria
CREATE OR REPLACE FUNCTION public.get_sale_number_for_category()
RETURNS trigger AS $$
BEGIN
  IF NEW.category = 'lanchonete' THEN
    NEW.sale_number := nextval('sales_lanchonete_seq');
  ELSE
    NEW.sale_number := nextval('sales_lojinha_seq');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger que aplica o próximo número automaticamente
DROP TRIGGER IF EXISTS trg_sales_sale_number ON public.sales;

CREATE TRIGGER trg_sales_sale_number
BEFORE INSERT ON public.sales
FOR EACH ROW
WHEN (NEW.sale_number IS NULL)
EXECUTE FUNCTION public.get_sale_number_for_category();

-- Índices para sales
CREATE INDEX IF NOT EXISTS idx_sales_card_id ON sales(card_id);
CREATE INDEX IF NOT EXISTS idx_sales_category ON sales(category);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);

-- Tabela: sale_items
CREATE TABLE IF NOT EXISTS sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    price NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para sale_items
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON sale_items(product_id);

-- Tabela: orders
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    customer_name TEXT NOT NULL,
    total NUMERIC(10,2) NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'delivered')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    delivered_at TIMESTAMP WITH TIME ZONE
);

-- Índices para orders
CREATE INDEX IF NOT EXISTS idx_orders_sale_id ON orders(sale_id);
CREATE INDEX IF NOT EXISTS idx_orders_card_id ON orders(card_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- Tabela: pix_payments (preparada para API real)
CREATE TABLE IF NOT EXISTS pix_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    amount NUMERIC(10,2) NOT NULL,
    pix_code TEXT NOT NULL,
    qr_code_url TEXT,
    pix_key TEXT,
    txid TEXT,
    status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'cancelled', 'expired', 'failed')),
    payment_method TEXT NOT NULL CHECK (payment_method IN ('mock', 'api')),
    external_id TEXT,
    webhook_data JSONB,
    error_message TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    confirmed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para pix_payments
CREATE INDEX IF NOT EXISTS idx_pix_payments_card_id ON pix_payments(card_id);
CREATE INDEX IF NOT EXISTS idx_pix_payments_status ON pix_payments(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_pix_payments_txid ON pix_payments(txid) WHERE txid IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_pix_payments_external_id ON pix_payments(external_id) WHERE external_id IS NOT NULL;

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para updated_at
CREATE TRIGGER update_cards_updated_at BEFORE UPDATE ON cards
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pix_payments_updated_at BEFORE UPDATE ON pix_payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS (Row Level Security) - políticas básicas
-- Habilitar RLS em todas as tabelas
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE pix_payments ENABLE ROW LEVEL SECURITY;

-- Políticas básicas (permitir tudo para usuários autenticados)
-- Em produção, refinar essas políticas conforme necessário

-- Cards: usuários podem ver seus próprios cartões
CREATE POLICY "Users can view their own cards" ON cards
    FOR SELECT USING (true);

CREATE POLICY "Users can insert their own cards" ON cards
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own cards" ON cards
    FOR UPDATE USING (true);

-- Transactions: usuários podem ver transações de seus cartões
CREATE POLICY "Users can view card transactions" ON transactions
    FOR SELECT USING (true);

CREATE POLICY "Users can insert transactions" ON transactions
    FOR INSERT WITH CHECK (true);

-- Products: todos podem ver produtos ativos
CREATE POLICY "Users can view active products" ON products
    FOR SELECT USING (active = true);

CREATE POLICY "Users can manage products" ON products
    FOR ALL USING (true);

-- Sales: todos podem ver vendas
CREATE POLICY "Users can view sales" ON sales
    FOR SELECT USING (true);

CREATE POLICY "Users can insert sales" ON sales
    FOR INSERT WITH CHECK (true);

-- Sale items: todos podem ver itens de venda
CREATE POLICY "Users can view sale items" ON sale_items
    FOR SELECT USING (true);

CREATE POLICY "Users can insert sale items" ON sale_items
    FOR INSERT WITH CHECK (true);

-- Orders: todos podem ver pedidos
CREATE POLICY "Users can view orders" ON orders
    FOR SELECT USING (true);

CREATE POLICY "Users can manage orders" ON orders
    FOR ALL USING (true);

-- PIX payments: usuários podem ver seus pagamentos
CREATE POLICY "Users can view their pix payments" ON pix_payments
    FOR SELECT USING (true);

CREATE POLICY "Users can insert pix payments" ON pix_payments
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update pix payments" ON pix_payments
    FOR UPDATE USING (true);

-- Tabela: sapatinho_veloz_orders
CREATE TABLE IF NOT EXISTS sapatinho_veloz_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    sender_user_id TEXT NOT NULL,
    sender_name TEXT,
    sender_team TEXT NOT NULL,
    recipient_name TEXT NOT NULL,
    recipient_address TEXT NOT NULL,
    message TEXT,
    total NUMERIC(10,2) NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'delivered')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    delivered_at TIMESTAMP WITH TIME ZONE
);

-- Índices para sapatinho_veloz_orders
CREATE INDEX IF NOT EXISTS idx_sapatinho_veloz_orders_sale_id ON sapatinho_veloz_orders(sale_id);
CREATE INDEX IF NOT EXISTS idx_sapatinho_veloz_orders_sender_user_id ON sapatinho_veloz_orders(sender_user_id);
CREATE INDEX IF NOT EXISTS idx_sapatinho_veloz_orders_status ON sapatinho_veloz_orders(status);
CREATE INDEX IF NOT EXISTS idx_sapatinho_veloz_orders_created_at ON sapatinho_veloz_orders(created_at);

-- Tabela: sapatinho_veloz_order_items
CREATE TABLE IF NOT EXISTS sapatinho_veloz_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES sapatinho_veloz_orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    price NUMERIC(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para sapatinho_veloz_order_items
CREATE INDEX IF NOT EXISTS idx_sapatinho_veloz_order_items_order_id ON sapatinho_veloz_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_sapatinho_veloz_order_items_product_id ON sapatinho_veloz_order_items(product_id);

-- Habilitar RLS em sapatinho_veloz_orders
ALTER TABLE sapatinho_veloz_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE sapatinho_veloz_order_items ENABLE ROW LEVEL SECURITY;

-- Políticas para sapatinho_veloz_orders
CREATE POLICY "Users can view sapatinho veloz orders" ON sapatinho_veloz_orders
    FOR SELECT USING (true);

CREATE POLICY "Users can insert sapatinho veloz orders" ON sapatinho_veloz_orders
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can manage sapatinho veloz orders" ON sapatinho_veloz_orders
    FOR ALL USING (true);

-- Políticas para sapatinho_veloz_order_items
CREATE POLICY "Users can view sapatinho veloz order items" ON sapatinho_veloz_order_items
    FOR SELECT USING (true);

CREATE POLICY "Users can insert sapatinho veloz order items" ON sapatinho_veloz_order_items
    FOR INSERT WITH CHECK (true);
