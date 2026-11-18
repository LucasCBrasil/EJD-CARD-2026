-- =============================================================================
-- Cardapios dos food trucks parceiros
--
-- Somente leitura para os usuarios: o site mostra os cardapios, mas a compra e
-- feita direto no food truck. O admin cadastra food trucks e itens pelo painel.
--
-- Acesso as tabelas apenas via Edge Functions (service_role), no mesmo padrao
-- de supabase-setup.sql. Imagens ficam no bucket publico 'food-trucks'; a
-- escrita so acontece por URL assinada gerada pela Edge Function
-- manage-food-trucks (que confere se o usuario e admin).
--
-- Rollback: supabase/rollbacks/20261116120000_food_trucks_down.sql
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------
CREATE TABLE public.food_trucks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (length(btrim(name)) > 0),
  description TEXT,
  logo_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_food_trucks_active_order
  ON public.food_trucks (active, sort_order, name);

CREATE TABLE public.food_truck_menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  food_truck_id UUID NOT NULL REFERENCES public.food_trucks(id) ON DELETE CASCADE,
  section TEXT NOT NULL DEFAULT 'Cardápio' CHECK (length(btrim(section)) > 0),
  name TEXT NOT NULL CHECK (length(btrim(name)) > 0),
  description TEXT,
  price NUMERIC(10, 2) NOT NULL CHECK (price > 0),
  image_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_food_truck_menu_items_truck
  ON public.food_truck_menu_items (food_truck_id, section, sort_order);

-- ---------------------------------------------------------------------------
-- Triggers de updated_at (funcao definida em supabase-setup.sql)
-- ---------------------------------------------------------------------------
CREATE TRIGGER update_food_trucks_updated_at
BEFORE UPDATE ON public.food_trucks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_food_truck_menu_items_updated_at
BEFORE UPDATE ON public.food_truck_menu_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Acesso: somente service_role (Edge Functions)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  table_name TEXT;
  app_tables TEXT[] := ARRAY['food_trucks', 'food_truck_menu_items'];
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

-- ---------------------------------------------------------------------------
-- Storage: bucket publico para leitura das imagens
-- Nenhuma policy de escrita para anon/authenticated: upload so via URL
-- assinada (createSignedUploadUrl) emitida pela Edge Function.
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'food-trucks',
  'food-trucks',
  TRUE,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;
