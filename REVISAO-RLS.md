# 🔒 Revisão de Políticas RLS (Row Level Security)

**Data da Revisão:** $(date)  
**Total de Tabelas com RLS:** 14  
**Total de Políticas:** 38

---

## ⚠️ PROBLEMAS CRÍTICOS DE SEGURANÇA

### 🔴 CRÍTICO: Políticas muito permissivas (role `public`)

Muitas políticas usam `roles: {public}`, o que significa que **QUALQUER usuário autenticado** pode executar essas operações, sem verificação de role específico.

---

## 📋 ANÁLISE POR TABELA

### 1. **app_users** (5 políticas)
**Status:** 🔴 **CRÍTICO - Políticas conflitantes e muito permissivas**

| Política | Role | Comando | Problema |
|----------|------|---------|-----------|
| `Users can insert own app_users row` | `authenticated` | INSERT | ✅ OK - Verifica `auth.uid() = id` |
| `Users can read own app_users row` | `authenticated` | SELECT | ✅ OK - Verifica `auth.uid() = id` |
| `Users can update own app_users row` | `authenticated` | UPDATE | ✅ OK - Verifica `auth.uid() = id` |
| `auth` | `public` | SELECT | 🔴 **PERIGOSO** - Permite ver TODOS os usuários (`qual: true`) |
| `auth users` | `public` | ALL | 🔴 **CRÍTICO** - Permite TODAS operações em TODOS usuários (`qual: true`) |

**Problemas:**
- Duas políticas permitem acesso total para `public` sem restrições
- Qualquer usuário autenticado pode ver/modificar dados de outros usuários
- Conflito com as políticas específicas acima

**Recomendação:** Remover políticas `auth` e `auth users`, manter apenas as políticas específicas.

---

### 2. **cards** (4 políticas)
**Status:** 🔴 **CRÍTICO - Muito permissivo**

| Política | Role | Comando | Problema |
|----------|------|---------|-----------|
| `Users can insert their own cards` | `public` | INSERT | 🔴 Permite inserir sem verificar ownership (`with_check: true`) |
| `Users can update their own cards` | `public` | UPDATE | 🔴 Permite atualizar QUALQUER cartão (`qual: true`) |
| `Users can view their own cards` | `public` | SELECT | 🔴 Permite ver QUALQUER cartão (`qual: true`) |
| `cards_associate` | `authenticated` | UPDATE | ✅ OK - Verifica ownership e `is_associated` |

**Problemas:**
- Qualquer usuário pode ver, inserir e atualizar QUALQUER cartão
- Não há verificação de role (admin/comunicacao deveriam ter mais permissões)
- Não há verificação de ownership nas políticas principais

**Recomendação:** 
- SELECT: Permitir apenas cartões próprios OU se for admin/comunicacao
- INSERT: Verificar se usuário tem permissão (comunicacao/admin)
- UPDATE: Verificar ownership OU role adequado

---

### 3. **coupons** (2 políticas)
**Status:** 🔴 **CRÍTICO - Acesso total sem restrições**

| Política | Role | Comando | Problema |
|----------|------|---------|-----------|
| `Users can manage coupons` | `public` | ALL | 🔴 **CRÍTICO** - Qualquer usuário pode fazer TUDO (`qual: true`) |
| `Users can update coupons` | `public` | UPDATE | 🔴 Redundante e permissivo (`qual: true`) |

**Problemas:**
- Qualquer usuário autenticado pode criar, ler, atualizar e deletar cupons
- Não há verificação de role

**Recomendação:** Restringir para roles específicos (admin?) ou remover se não for necessário.

---

### 4. **lanchonete_coupons** (2 políticas)
**Status:** 🟡 **ACEITÁVEL - Mas pode melhorar**

| Política | Role | Comando | Problema |
|----------|------|---------|-----------|
| `Admins and lanchonete can manage lanchonete coupons` | `public` | ALL | 🟡 Verifica role, mas usa `public` |
| `Everyone can view active lanchonete coupons` | `public` | SELECT | ✅ OK - Apenas leitura de cupons ativos |

**Problemas:**
- Primeira política verifica role corretamente, mas usa role `public`
- Poderia ser mais específica

**Recomendação:** Funciona, mas considerar usar role específico ao invés de `public` com verificação.

---

### 5. **orders** (2 políticas)
**Status:** 🔴 **CRÍTICO - Acesso total sem restrições**

| Política | Role | Comando | Problema |
|----------|------|---------|-----------|
| `Users can manage orders` | `public` | ALL | 🔴 **CRÍTICO** - Qualquer usuário pode fazer TUDO (`qual: true`) |
| `Users can view orders` | `public` | SELECT | 🔴 Redundante (`qual: true`) |

**Problemas:**
- Qualquer usuário pode criar, modificar e deletar pedidos de outros
- Não há verificação de ownership ou role

**Recomendação:** 
- SELECT: Verificar se usuário é dono do pedido OU tem role adequado (lojinha/admin)
- INSERT/UPDATE: Verificar ownership ou role
- DELETE: Apenas admin ou em casos específicos

---

### 6. **pix_payments** (3 políticas)
**Status:** 🔴 **CRÍTICO - Muito permissivo**

| Política | Role | Comando | Problema |
|----------|------|---------|-----------|
| `Users can insert pix payments` | `public` | INSERT | 🔴 Permite inserir sem verificar ownership (`with_check: true`) |
| `Users can update pix payments` | `public` | UPDATE | 🔴 Permite atualizar QUALQUER pagamento (`qual: true`) |
| `Users can view their pix payments` | `public` | SELECT | 🔴 Permite ver QUALQUER pagamento (`qual: true`) |

**Problemas:**
- Qualquer usuário pode ver e modificar pagamentos PIX de outros
- Não há verificação de ownership

**Recomendação:** 
- SELECT: Apenas pagamentos do próprio cartão (`card_id` associado ao usuário)
- INSERT: Verificar ownership do `card_id`
- UPDATE: Apenas se for dono do pagamento

---

### 7. **products** (2 políticas)
**Status:** 🔴 **CRÍTICO - Acesso total sem restrições**

| Política | Role | Comando | Problema |
|----------|------|---------|-----------|
| `Users can manage products` | `public` | ALL | 🔴 **CRÍTICO** - Qualquer usuário pode fazer TUDO (`qual: true`) |
| `Users can view active products` | `public` | SELECT | ✅ OK - Apenas produtos ativos |

**Problemas:**
- Qualquer usuário pode criar, modificar e deletar produtos
- Não há verificação de role (deveria ser lojinha/lanchonete/admin por categoria)

**Recomendação:** 
- SELECT: OK manter como está (produtos ativos)
- INSERT/UPDATE/DELETE: Verificar role adequado para categoria:
  - `lojinha` → apenas produtos `category = 'lojinha'`
  - `lanchonete` → apenas produtos `category = 'lanchonete'`
  - `admin` → todos os produtos

---

### 8. **sale_items** (2 políticas)
**Status:** 🟡 **ACEITÁVEL - Mas pode melhorar**

| Política | Role | Comando | Problema |
|----------|------|---------|-----------|
| `Users can insert sale items` | `public` | INSERT | 🟡 Permite inserir sem verificação (`with_check: true`) |
| `Users can view sale items` | `public` | SELECT | 🟡 Permite ver todos (`qual: true`) |

**Problemas:**
- Qualquer usuário pode inserir itens de venda
- Qualquer usuário pode ver itens de vendas de outros

**Recomendação:** 
- INSERT: Verificar se usuário tem permissão para criar vendas (role adequado)
- SELECT: Verificar se usuário tem acesso à venda relacionada (via `sale_id`)

---

### 9. **sales** (2 políticas)
**Status:** 🟡 **ACEITÁVEL - Mas pode melhorar**

| Política | Role | Comando | Problema |
|----------|------|---------|-----------|
| `Users can insert sales` | `public` | INSERT | 🟡 Permite inserir sem verificação (`with_check: true`) |
| `Users can view sales` | `public` | SELECT | 🟡 Permite ver todas (`qual: true`) |

**Problemas:**
- Qualquer usuário pode criar vendas
- Qualquer usuário pode ver vendas de outros

**Recomendação:** 
- INSERT: Verificar role adequado (lojinha/lanchonete/admin)
- SELECT: Verificar role ou ownership (vendedor pode ver suas vendas)

---

### 10. **sapatinho_products** (2 políticas)
**Status:** 🔴 **CRÍTICO - Acesso total sem restrições**

| Política | Role | Comando | Problema |
|----------|------|---------|-----------|
| `Users can manage sapatinho products` | `public` | ALL | 🔴 **CRÍTICO** - Qualquer usuário pode fazer TUDO (`qual: true`) |
| `Users can view sapatinho products` | `public` | SELECT | ✅ OK - Apenas produtos ativos |

**Problemas:**
- Qualquer usuário pode criar, modificar e deletar produtos do sapatinho
- Não há verificação de role

**Recomendação:** 
- SELECT: OK manter como está
- INSERT/UPDATE/DELETE: Apenas roles `lojinha` ou `admin`

---

### 11. **sapatinho_sale_items** (2 políticas)
**Status:** 🟡 **ACEITÁVEL - Mas pode melhorar**

| Política | Role | Comando | Problema |
|----------|------|---------|-----------|
| `Users can insert sapatinho sale items` | `public` | INSERT | 🟡 Permite inserir sem verificação |
| `Users can view sapatinho sale items` | `public` | SELECT | 🟡 Permite ver todos |

**Recomendação:** Similar a `sale_items` - verificar permissões via `sale_id`.

---

### 12. **sapatinho_sales** (2 políticas)
**Status:** 🟡 **ACEITÁVEL - Mas pode melhorar**

| Política | Role | Comando | Problema |
|----------|------|---------|-----------|
| `Users can insert sapatinho sales` | `public` | INSERT | 🟡 Permite inserir sem verificação |
| `Users can view sapatinho sales` | `public` | SELECT | 🟡 Permite ver todas |

**Recomendação:** Similar a `sales` - verificar role adequado.

---

### 13. **transactions** (2 políticas)
**Status:** 🔴 **CRÍTICO - Muito permissivo**

| Política | Role | Comando | Problema |
|----------|------|---------|-----------|
| `Users can insert transactions` | `public` | INSERT | 🔴 Permite inserir sem verificação (`with_check: true`) |
| `Users can view card transactions` | `public` | SELECT | 🔴 Permite ver TODAS transações (`qual: true`) |

**Problemas:**
- Qualquer usuário pode criar transações para qualquer cartão
- Qualquer usuário pode ver transações de outros cartões

**Recomendação:** 
- SELECT: Apenas transações de cartões próprios OU se for admin/comunicacao
- INSERT: Verificar se usuário tem permissão (admin/comunicacao) ou se é dono do cartão

---

### 14. **user** (Better Auth) (3 políticas)
**Status:** 🟢 **BOM - Bem controlado**

| Política | Role | Comando | Problema |
|----------|------|---------|-----------|
| `Admins can view all users` | `public` | ALL | ✅ OK - Verifica role admin |
| `Users can update own data` | `public` | UPDATE | ✅ OK - Verifica ownership |
| `Users can view own data` | `public` | SELECT | ✅ OK - Verifica ownership |

**Status:** ✅ Políticas adequadas com verificações corretas.

---

## 📊 RESUMO DE PROBLEMAS

### Por Severidade:

**🔴 CRÍTICO (Acesso total sem restrições):**
- `app_users`: Políticas conflitantes permitem acesso total
- `cards`: Qualquer usuário pode ver/modificar qualquer cartão
- `coupons`: Acesso total sem verificação
- `orders`: Acesso total sem verificação
- `pix_payments`: Qualquer usuário pode ver/modificar pagamentos
- `products`: Qualquer usuário pode gerenciar produtos
- `sapatinho_products`: Acesso total sem verificação
- `transactions`: Qualquer usuário pode ver/criar transações

**🟡 MÉDIO (Permissivo mas com alguma lógica):**
- `lanchonete_coupons`: Verifica role mas usa `public`
- `sale_items`, `sales`: Permite inserir/ver sem verificação adequada
- `sapatinho_sale_items`, `sapatinho_sales`: Similar ao acima

**🟢 BOM:**
- `user`: Políticas adequadas com verificações corretas

---

## 🎯 RECOMENDAÇÕES GERAIS

### 1. **Padrão de Verificação de Roles**
Criar função helper para verificar roles:
```sql
CREATE OR REPLACE FUNCTION check_user_role(required_roles text[])
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM app_users
    WHERE id = auth.uid()
    AND role = ANY(required_roles)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 2. **Padrão de Ownership**
Sempre verificar ownership quando aplicável:
- Cartões: `card.user_id = auth.uid()`
- Vendas: `sale.seller_id = auth.uid()`
- Transações: Via `card_id` → verificar ownership do cartão

### 3. **Separação de Responsabilidades**
- **SELECT**: Geralmente mais permissivo (ver próprio + role adequado)
- **INSERT**: Verificar role adequado
- **UPDATE**: Verificar ownership OU role adequado
- **DELETE**: Geralmente apenas admin

### 4. **Tabelas sem RLS**
⚠️ **PROBLEMA ENCONTRADO:** As seguintes tabelas **NÃO têm RLS habilitado**:
- `sapatinho_veloz_orders` (314 registros)
- `sapatinho_veloz_order_items` (398 registros)

**Recomendação:** Habilitar RLS nessas tabelas e criar políticas adequadas.

---

## 📝 PRÓXIMOS PASSOS

1. ✅ Revisar e corrigir políticas críticas
2. ✅ Implementar verificações de role adequadas
3. ✅ Adicionar verificações de ownership onde necessário
4. ✅ Testar políticas com diferentes roles
5. ✅ Documentar políticas finais

---

**⚠️ ATENÇÃO:** As políticas atuais permitem que qualquer usuário autenticado tenha acesso muito amplo aos dados. Recomenda-se correção urgente antes de produção.

