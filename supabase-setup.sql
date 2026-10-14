-- Schema inicial do EJD Card para um projeto Supabase novo.
-- Execute no SQL Editor de um projeto Supabase vazio. O Supabase Auth ja fornece
-- auth.users e os roles anon, authenticated e service_role usados abaixo.
-- As Edge Functions e o backend devem acessar as tabelas com a service role.

-- ---------------------------------------------------------------------------
-- Tipos e perfis de usuario
-- ---------------------------------------------------------------------------

CREATE TYPE public.user_role AS ENUM (
  'admin',
  'lojinha',
  'lanchonete',
  'comunicacao',
  'servico',
  'encontrista'
);

CREATE TABLE public.app_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  name TEXT,
  role public.user_role NOT NULL DEFAULT 'encontrista',
  balance NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (balance >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_app_users_role ON public.app_users(role);
CREATE INDEX idx_app_users_email ON public.app_users(LOWER(email));

CREATE OR REPLACE FUNCTION public.create_app_user_for_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.app_users AS account (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'name', NEW.raw_user_meta_data ->> 'full_name')
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      name = COALESCE(account.name, EXCLUDED.name);

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.create_app_user_for_auth_user();

-- ---------------------------------------------------------------------------
-- Produtos
-- ---------------------------------------------------------------------------

CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL CHECK (price > 0),
  category TEXT NOT NULL CHECK (category IN ('lojinha', 'lanchonete')),
  description TEXT,
  stock INTEGER CHECK (stock IS NULL OR stock >= 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_products_category ON public.products(category);
CREATE INDEX idx_products_active ON public.products(active);

CREATE TABLE public.sapatinho_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL CHECK (price > 0),
  description TEXT,
  stock INTEGER CHECK (stock IS NULL OR stock >= 0),
  image_url TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sapatinho_products_active ON public.sapatinho_products(active);
CREATE INDEX idx_sapatinho_products_name ON public.sapatinho_products(name);

-- ---------------------------------------------------------------------------
-- Vendas, itens e pedidos da lojinha/lanchonete
-- ---------------------------------------------------------------------------

CREATE SEQUENCE public.sales_lojinha_seq;
CREATE SEQUENCE public.sales_lanchonete_seq;

CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.app_users(id) ON DELETE SET NULL,
  seller_id UUID REFERENCES public.app_users(id) ON DELETE SET NULL,
  sale_number BIGINT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('lojinha', 'lanchonete')),
  total NUMERIC(10, 2) NOT NULL CHECK (total > 0),
  status TEXT NOT NULL CHECK (status IN ('completed', 'delivered')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMPTZ
);

CREATE OR REPLACE FUNCTION public.get_sale_number_for_category()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.sale_number IS NULL THEN
    IF NEW.category = 'lanchonete' THEN
      NEW.sale_number := nextval('public.sales_lanchonete_seq');
    ELSE
      NEW.sale_number := nextval('public.sales_lojinha_seq');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sales_sale_number
BEFORE INSERT ON public.sales
FOR EACH ROW
EXECUTE FUNCTION public.get_sale_number_for_category();

CREATE INDEX idx_sales_user_id ON public.sales(user_id);
CREATE INDEX idx_sales_seller_id ON public.sales(seller_id);
CREATE INDEX idx_sales_category ON public.sales(category);
CREATE INDEX idx_sales_created_at ON public.sales(created_at);

CREATE TABLE public.sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sale_items_sale_id ON public.sale_items(sale_id);
CREATE INDEX idx_sale_items_product_id ON public.sale_items(product_id);

CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.app_users(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  order_code TEXT UNIQUE,
  total NUMERIC(10, 2) NOT NULL CHECK (total > 0),
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'delivered')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMPTZ
);

CREATE INDEX idx_orders_sale_id ON public.orders(sale_id);
CREATE INDEX idx_orders_user_id ON public.orders(user_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_created_at ON public.orders(created_at);

-- ---------------------------------------------------------------------------
-- Vendas e pedidos do Sapatinho
-- ---------------------------------------------------------------------------

CREATE TABLE public.sapatinho_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.app_users(id) ON DELETE SET NULL,
  seller_id UUID REFERENCES public.app_users(id) ON DELETE SET NULL,
  total NUMERIC(10, 2) NOT NULL CHECK (total > 0),
  status TEXT NOT NULL CHECK (status IN ('completed', 'delivered')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sapatinho_sales_user_id ON public.sapatinho_sales(user_id);
CREATE INDEX idx_sapatinho_sales_seller_id ON public.sapatinho_sales(seller_id);
CREATE INDEX idx_sapatinho_sales_created_at ON public.sapatinho_sales(created_at);

CREATE TABLE public.sapatinho_sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sapatinho_sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.sapatinho_products(id),
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sapatinho_sale_items_sale_id ON public.sapatinho_sale_items(sale_id);
CREATE INDEX idx_sapatinho_sale_items_product_id ON public.sapatinho_sale_items(product_id);

CREATE TABLE public.sapatinho_veloz_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sapatinho_sales(id) ON DELETE CASCADE,
  sender_user_id UUID REFERENCES public.app_users(id) ON DELETE SET NULL,
  sender_name TEXT,
  sender_team TEXT,
  recipient_name TEXT NOT NULL,
  recipient_address TEXT NOT NULL,
  message TEXT,
  total NUMERIC(10, 2) NOT NULL CHECK (total > 0),
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'delivered')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMPTZ
);

CREATE INDEX idx_sapatinho_veloz_orders_sale_id ON public.sapatinho_veloz_orders(sale_id);
CREATE INDEX idx_sapatinho_veloz_orders_sender_user_id ON public.sapatinho_veloz_orders(sender_user_id);
CREATE INDEX idx_sapatinho_veloz_orders_status ON public.sapatinho_veloz_orders(status);
CREATE INDEX idx_sapatinho_veloz_orders_created_at ON public.sapatinho_veloz_orders(created_at);

CREATE TABLE public.sapatinho_veloz_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.sapatinho_veloz_orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.sapatinho_products(id),
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sapatinho_veloz_order_items_order_id
  ON public.sapatinho_veloz_order_items(order_id);
CREATE INDEX idx_sapatinho_veloz_order_items_product_id
  ON public.sapatinho_veloz_order_items(product_id);

-- ---------------------------------------------------------------------------
-- Movimentacoes de saldo, pagamentos PIX, cupons e configuracoes
-- ---------------------------------------------------------------------------

CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.app_users(id) ON DELETE SET NULL,
  amount NUMERIC(10, 2) NOT NULL CHECK (amount <> 0),
  type TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
  description TEXT NOT NULL,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT transactions_amount_matches_type CHECK (
    (type = 'credit' AND amount > 0)
    OR (type = 'debit' AND amount < 0)
  )
);

CREATE INDEX idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX idx_transactions_created_at ON public.transactions(created_at);

CREATE TABLE public.pix_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.app_users(id) ON DELETE SET NULL,
  amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
  pix_code TEXT NOT NULL,
  qr_code_url TEXT,
  pix_key TEXT,
  txid TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'cancelled', 'expired', 'failed')),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('mock', 'api')),
  external_id TEXT,
  webhook_data JSONB,
  error_message TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pix_payments_user_id ON public.pix_payments(user_id);
CREATE INDEX idx_pix_payments_status ON public.pix_payments(status);
CREATE UNIQUE INDEX idx_pix_payments_txid
  ON public.pix_payments(txid) WHERE txid IS NOT NULL;
CREATE UNIQUE INDEX idx_pix_payments_external_id
  ON public.pix_payments(external_id) WHERE external_id IS NOT NULL;

CREATE TABLE public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.lanchonete_coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  discount_amount NUMERIC(10, 2) NOT NULL CHECK (discount_amount > 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.feature_flags (
  key TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  description TEXT,
  updated_by UUID REFERENCES public.app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.feature_flags (key, enabled, description)
VALUES ('pix_enabled', TRUE, 'Habilita abastecimento de saldo via PIX');

-- ---------------------------------------------------------------------------
-- Triggers de atualizacao
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_app_users_updated_at
BEFORE UPDATE ON public.app_users
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sapatinho_products_updated_at
BEFORE UPDATE ON public.sapatinho_products
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pix_payments_updated_at
BEFORE UPDATE ON public.pix_payments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_lanchonete_coupons_updated_at
BEFORE UPDATE ON public.lanchonete_coupons
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_feature_flags_updated_at
BEFORE UPDATE ON public.feature_flags
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Operacoes atomicas de saldo e confirmacao PIX
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.adjust_account_balance(
  p_user_id UUID,
  p_amount NUMERIC,
  p_type TEXT,
  p_description TEXT,
  p_created_by TEXT
)
RETURNS TABLE(previous_balance NUMERIC, new_balance NUMERIC, transaction_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_balance NUMERIC(10, 2);
  updated_balance NUMERIC(10, 2);
  adjustment_amount NUMERIC(10, 2);
  new_transaction_id UUID;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0
     OR p_type IS NULL OR p_type NOT IN ('credit', 'debit') THEN
    RAISE EXCEPTION 'Invalid account balance adjustment' USING ERRCODE = '22023';
  END IF;

  adjustment_amount := ROUND(p_amount, 2);
  IF adjustment_amount <= 0 THEN
    RAISE EXCEPTION 'Adjustment amount must be at least one cent' USING ERRCODE = '22023';
  END IF;

  SELECT account.balance
  INTO current_balance
  FROM public.app_users AS account
  WHERE account.id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account not found' USING ERRCODE = 'P0002';
  END IF;

  IF p_type = 'debit' AND current_balance < adjustment_amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE' USING ERRCODE = 'P0001';
  END IF;

  updated_balance := CASE
    WHEN p_type = 'credit' THEN current_balance + adjustment_amount
    ELSE current_balance - adjustment_amount
  END;

  UPDATE public.app_users
  SET balance = updated_balance
  WHERE id = p_user_id;

  INSERT INTO public.transactions (user_id, amount, type, description, created_by)
  VALUES (
    p_user_id,
    CASE WHEN p_type = 'credit' THEN adjustment_amount ELSE -adjustment_amount END,
    p_type,
    COALESCE(NULLIF(BTRIM(p_description), ''), CASE WHEN p_type = 'credit' THEN 'Credito' ELSE 'Debito' END),
    p_created_by
  )
  RETURNING id INTO new_transaction_id;

  RETURN QUERY SELECT current_balance, updated_balance, new_transaction_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_account_pix_payment(
  p_external_id TEXT,
  p_webhook_data JSONB
)
RETURNS TABLE(updated BOOLEAN, user_id UUID, amount NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  payment_record public.pix_payments%ROWTYPE;
BEGIN
  SELECT *
  INTO payment_record
  FROM public.pix_payments
  WHERE external_id = p_external_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::NUMERIC;
    RETURN;
  END IF;

  IF payment_record.status <> 'pending' THEN
    RETURN QUERY SELECT FALSE, payment_record.user_id, payment_record.amount;
    RETURN;
  END IF;

  IF payment_record.user_id IS NULL THEN
    RAISE EXCEPTION 'PIX payment has no associated account' USING ERRCODE = '23502';
  END IF;

  UPDATE public.pix_payments
  SET status = 'confirmed',
      webhook_data = p_webhook_data,
      confirmed_at = COALESCE(confirmed_at, NOW()),
      updated_at = NOW()
  WHERE id = payment_record.id;

  PERFORM *
  FROM public.adjust_account_balance(
    payment_record.user_id,
    payment_record.amount,
    'credit',
    'Abastecimento via PIX (Asaas)',
    'asaas_webhook'
  );

  RETURN QUERY SELECT TRUE, payment_record.user_id, payment_record.amount;
END;
$$;

-- ---------------------------------------------------------------------------
-- Acesso: somente service_role para as tabelas da aplicacao
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  table_name TEXT;
  app_tables TEXT[] := ARRAY[
    'app_users',
    'products',
    'sapatinho_products',
    'sales',
    'sale_items',
    'orders',
    'sapatinho_sales',
    'sapatinho_sale_items',
    'sapatinho_veloz_orders',
    'sapatinho_veloz_order_items',
    'transactions',
    'pix_payments',
    'coupons',
    'lanchonete_coupons',
    'feature_flags'
  ];
BEGIN
  FOREACH table_name IN ARRAY app_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', table_name);
    EXECUTE format('GRANT ALL PRIVILEGES ON TABLE public.%I TO service_role', table_name);
    EXECUTE format(
      'CREATE POLICY block_direct_api_access ON public.%I FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)',
      table_name
    );
  END LOOP;
END;
$$;

GRANT USAGE ON SCHEMA public TO service_role;
GRANT USAGE, SELECT ON SEQUENCE
  public.sales_lojinha_seq,
  public.sales_lanchonete_seq
TO service_role;

REVOKE ALL ON FUNCTION public.adjust_account_balance(UUID, NUMERIC, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.confirm_account_pix_payment(TEXT, JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_account_balance(UUID, NUMERIC, TEXT, TEXT, TEXT)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.confirm_account_pix_payment(TEXT, JSONB)
  TO service_role;
