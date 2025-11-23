-- ============================================
-- ATUALIZAR SISTEMA DE ROLES
-- Usar roles existentes do sistema (não criar novos)
-- ============================================

-- 1. Criar tipo ENUM com os roles existentes
DROP TYPE IF EXISTS user_role CASCADE;

CREATE TYPE user_role AS ENUM (
  'admin',
  'lojinha',
  'lanchonete',
  'comunicacao',
  'servico',
  'encontrista'
);

-- 2. Adicionar coluna role na tabela app_users (se não existir)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'app_users' AND column_name = 'role'
  ) THEN
    ALTER TABLE app_users ADD COLUMN role user_role DEFAULT 'encontrista';
  ELSE
    -- Se já existe, apenas alterar o tipo
    ALTER TABLE app_users ALTER COLUMN role TYPE user_role USING role::user_role;
  END IF;
END $$;

-- 3. Criar índice para busca rápida por role
CREATE INDEX IF NOT EXISTS idx_app_users_role ON app_users(role);

-- 4. Comentário sobre roles
COMMENT ON COLUMN app_users.role IS 
'Papel do usuário no sistema:
- admin: Acesso total (tudo)
- lojinha: Acesso total à lojinha + sapatinho (produtos + vendas + histórico + pedidos + entregas)
- lanchonete: Acesso total à lanchonete + pode vender no sapatinho (produtos + vendas + histórico)
- comunicacao: CRUD de cartões + adicionar saldo + pode vender no sapatinho
- servico: Ver próprio cartão + pode fazer pedidos no Sapatinho Mágico
- encontrista: Ver próprio cartão e histórico';

-- ============================================
-- PERMISSÕES POR ROLE (para referência)
-- ============================================

/*
RESUMO DE PERMISSÕES:

✅ CRIAR CARTÕES:
  - admin
  - comunicacao

✅ EDITAR CARTÕES:
  - admin
  - comunicacao

✅ ADICIONAR SALDO:
  - admin
  - comunicacao

✅ GERENCIAR PRODUTOS LOJINHA:
  - admin
  - lojinha

✅ GERENCIAR PRODUTOS LANCHONETE:
  - admin
  - lanchonete

✅ REALIZAR VENDAS LOJINHA:
  - admin
  - lojinha

✅ REALIZAR VENDAS LANCHONETE:
  - admin
  - lanchonete

✅ VER HISTÓRICO LOJINHA:
  - admin
  - lojinha

✅ VER HISTÓRICO LANCHONETE:
  - admin
  - lanchonete

✅ VER TODOS OS CARTÕES:
  - admin
  - lojinha
  - lanchonete
  - comunicacao
*/

