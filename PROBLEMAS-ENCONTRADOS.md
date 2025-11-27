# 🔍 Problemas de Segurança Encontrados - Verificação Completa

## ❌ Arquivos com Queries Diretas ao Supabase

### 1. **src/api/products.api.ts** ⚠️ CRÍTICO
- **Status**: Arquivo ainda existe
- **Problemas**:
  - `getAll()` - query direta
  - `create()` - insert direto
  - `update()` - update direto
  - `delete()` - update direto (desativa)
- **Onde é usado**: Verificar referências
- **Solução**: Migrar para `api.listProducts()` e `api.manageProducts()`

### 2. **src/api/cards.api.ts** ⚠️ CRÍTICO
- **Status**: Arquivo ainda existe
- **Problemas**:
  - `getAll()` - query direta
  - `getByNumber()` - query direta
  - `getByUserId()` - query direta
  - `associate()` - queries diretas (select + update)
  - `updateBalance()` - queries diretas (select + update + insert)
- **Onde é usado**: Verificar referências
- **Solução**: Migrar para `api.listCards()`, `api.getCardByNumber()`, `api.getCardByUserId()`, `api.updateBalance()`

### 3. **src/api/transactions.api.ts** ⚠️ CRÍTICO
- **Status**: Arquivo ainda existe
- **Problemas**:
  - `getByCardId()` - query direta
  - `getAll()` - query direta (expõe todas as transações!)
- **Onde é usado**: Verificar referências
- **Solução**: Migrar para `api.listTransactions(cardId?)`

### 4. **src/services/productService.ts** ⚠️ CRÍTICO
- **Status**: Faz queries diretas
- **Problemas**:
  - `getProducts()` - query direta
  - `deleteProduct()` - update direto
  - `getProductById()` - query direta
  - `saveProduct()` - insert/update direto
  - `uploadProductImage()` - storage direto (pode ser aceitável)
- **Onde é usado**: `ListProductsPage.tsx`, `CreateProductPage.tsx`, `SalesPage.tsx`
- **Solução**: Migrar para usar `api.listProducts()` e `api.manageProducts()`

### 5. **src/pages/admin/UserManagement.tsx** ⚠️ CRÍTICO
- **Status**: Faz queries diretas à `app_users`
- **Problemas**:
  - `searchUsers()` - query direta (expõe estrutura!)
  - `updateUserRole()` - update direto (sem validação de permissão no backend!)
- **Solução**: Criar Edge Function `manage-users`

### 6. **src/pages/MyCardPage.tsx** ⚠️ CRÍTICO
- **Status**: Faz query direta à `cards`
- **Problemas**:
  - `loadUserData()` - query direta (linha 84)
- **Solução**: Usar `api.getCardByUserId()` em vez de query direta

### 7. **src/utils/orderCode.ts** ⚠️ MÉDIO
- **Status**: Faz query direta à `orders`
- **Problemas**:
  - `generateOrderCode()` - query direta
- **Solução**: Criar Edge Function ou mover para backend

### 8. **src/contexts/SupabaseDataContext.tsx** ⚠️ CRÍTICO
- **Status**: Ainda tem método inseguro
- **Problemas**:
  - `addBalance()` - queries diretas (linhas 260-288)
- **Solução**: Migrar para usar `api.updateBalance()`

### 9. **src/api/webhooks/pix.ts** ⚠️ VERIFICAR
- **Status**: Faz queries diretas
- **Observação**: Webhooks geralmente rodam no servidor, então pode ser aceitável
- **Problemas**:
  - `handlePixWebhook()` - queries diretas
- **Solução**: Se rodar no servidor, OK. Se rodar no frontend, precisa migrar.

## 📊 Resumo Estatístico

- **Total de arquivos com problemas**: 9
- **Críticos**: 8
- **Para verificar**: 1 (webhook)
- **APIs que devem ser removidas**: 3 (`products.api.ts`, `cards.api.ts`, `transactions.api.ts`)

## 🎯 Ordem de Prioridade para Correção

### Prioridade 1 (Crítico - Expõe dados sensíveis):
1. `transactions.api.ts` - `getAll()` expõe TODAS as transações
2. `UserManagement.tsx` - Expõe estrutura e permite alterar roles sem validação backend
3. `cards.api.ts` - Expõe todos os cartões
4. `MyCardPage.tsx` - Query direta

### Prioridade 2 (Crítico - Expõe API key):
5. `products.api.ts` - Expõe estrutura
6. `productService.ts` - Expõe estrutura
7. `SupabaseDataContext.addBalance()` - Permite manipular saldos diretamente

### Prioridade 3 (Médio):
8. `orderCode.ts` - Expõe estrutura mas menos crítico
9. `webhooks/pix.ts` - Verificar se roda no servidor

---

**Status**: ⚠️ **9 arquivos precisam ser corrigidos**

