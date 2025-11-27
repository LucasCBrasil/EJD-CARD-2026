# 🔍 Verificação de Segurança Completa - Problemas Encontrados

## ❌ Arquivos que Ainda Fazem Queries Diretas ao Supabase

### 1. **src/api/products.api.ts** ⚠️ CRÍTICO
- **Status**: Ainda existe e faz queries diretas
- **Problema**: Expõe API key e estrutura do banco
- **Solução**: Remover ou migrar para usar `api.manageProducts()` e `api.listProducts()`
- **Uso**: Verificar onde está sendo usado e migrar

### 2. **src/api/cards.api.ts** ⚠️ CRÍTICO
- **Status**: Ainda existe e faz queries diretas
- **Problema**: Métodos `getAll()`, `getByNumber()`, `getByUserId()`, `associate()`, `updateBalance()` fazem queries diretas
- **Solução**: 
  - `getAll()` → `api.listCards()`
  - `getByNumber()` → `api.getCardByNumber()`
  - `getByUserId()` → `api.getCardByUserId()`
  - `associate()` → Criar Edge Function ou usar `api.updateBalance()` com action 'associate'
  - `updateBalance()` → `api.updateBalance()`
- **Uso**: Verificar onde está sendo usado e migrar

### 3. **src/api/transactions.api.ts** ⚠️ CRÍTICO
- **Status**: Ainda existe e faz queries diretas
- **Problema**: `getByCardId()` e `getAll()` fazem queries diretas
- **Solução**: Migrar para `api.listTransactions(cardId?)`
- **Uso**: Verificar onde está sendo usado e migrar

### 4. **src/pages/admin/UserManagement.tsx** ⚠️ CRÍTICO
- **Status**: Faz queries diretas à tabela `app_users`
- **Problema**: 
  - `searchUsers()` - query direta
  - `updateUserRole()` - update direto
- **Solução**: Criar Edge Function `manage-users` para gerenciar usuários

### 5. **src/utils/orderCode.ts** ⚠️ MÉDIO
- **Status**: Faz query direta à tabela `orders`
- **Problema**: `generateOrderCode()` busca último código direto do banco
- **Solução**: Criar Edge Function `generate-order-code` ou mover para o backend

### 6. **src/pages/MyCardPage.tsx** ⚠️ CRÍTICO
- **Status**: Faz query direta à tabela `cards`
- **Problema**: `loadUserData()` busca cartão diretamente do Supabase (linha 84)
- **Solução**: Usar `api.getCardByUserId()` em vez de query direta

### 7. **src/services/productService.ts** ⚠️ VERIFICAR
- **Status**: Importa `supabase` mas precisa verificar uso
- **Ação**: Verificar se faz queries diretas

### 8. **src/api/webhooks/pix.ts** ⚠️ VERIFICAR
- **Status**: Importa `supabase` mas precisa verificar uso
- **Ação**: Verificar se faz queries diretas (webhooks geralmente são seguros)

## 📊 Resumo

### Arquivos que Precisam ser Removidos/Migrados:
1. ✅ `src/api/sales.api.ts` - **REMOVIDO** ✅
2. ✅ `src/api/orders.api.ts` - **REMOVIDO** ✅
3. ❌ `src/api/products.api.ts` - **PRECISA REMOVER/MIGRAR**
4. ❌ `src/api/cards.api.ts` - **PRECISA REMOVER/MIGRAR** (parcialmente)
5. ❌ `src/api/transactions.api.ts` - **PRECISA REMOVER/MIGRAR**

### Arquivos que Precisam ser Corrigidos:
1. ❌ `src/pages/admin/UserManagement.tsx` - Criar Edge Function
2. ❌ `src/utils/orderCode.ts` - Mover para Edge Function
3. ❌ `src/pages/MyCardPage.tsx` - Migrar para usar api-client

### Arquivos para Verificar:
1. ⚠️ `src/services/productService.ts` - Verificar uso
2. ⚠️ `src/api/webhooks/pix.ts` - Verificar uso (webhooks podem ser seguros)

## 🔧 Ações Necessárias

### Prioridade ALTA:
1. Remover/migrar `products.api.ts`, `cards.api.ts`, `transactions.api.ts`
2. Corrigir `UserManagement.tsx` - criar Edge Function para gerenciar usuários
3. Corrigir `MyCardPage.tsx` - usar api-client

### Prioridade MÉDIA:
1. Mover `orderCode.ts` para Edge Function
2. Verificar e corrigir `productService.ts`
3. Verificar `webhooks/pix.ts` (pode estar seguro se for webhook do servidor)

## 📝 Próximos Passos

1. Verificar onde cada API está sendo usada
2. Migrar usos para api-client ou Edge Functions
3. Remover arquivos inseguros
4. Criar Edge Functions faltantes
5. Atualizar documentação

---

**Status**: ⚠️ **Encontrados 8 arquivos com problemas potenciais**

