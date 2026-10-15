# ⚠️ DEPRECATED - APIs Diretas ao Supabase

**Estes arquivos estão DEPRECADOS e foram REMOVIDOS!**

Eles faziam chamadas diretas ao Supabase usando a API key exposta no frontend, o que era um **risco crítico de segurança**.

## ✅ Use em vez disso:

- **api-client.ts** - Wrapper REST seguro que chama Edge Functions
- **Edge Functions** - Todas as operações passam por Edge Functions autenticadas

## Arquivos Removidos:

- ✅ `sales.api.ts` - **REMOVIDO** → Use `api.listSales()` do `api-client.ts`
- ✅ `orders.api.ts` - **REMOVIDO** → Use `api.listOrders()`, `api.getOpenOrders()` do `api-client.ts`
- ✅ `sapatinho-veloz.api.ts` - **REMOVIDO** junto com a funcionalidade

## Por que foram removidos?

1. **API Key exposta no bundle** - Qualquer pessoa podia ver e usar a chave
2. **Documentação da estrutura exposta** - Schemas, tipos e estrutura do banco ficavam visíveis
3. **Contornava proteções de segurança** - Permitia acesso direto ao banco
4. **Sem validação de permissões** - Qualquer usuário logado podia acessar qualquer dado

## Status da Migração

✅ **Completo**: Todos os hooks e páginas foram migrados para usar `api-client.ts` ou `SupabaseDataContext` (que agora usa Edge Functions internamente).

## Métodos Disponíveis em api-client.ts

```typescript
// Products
api.listProducts(category?)

// Cards
api.listCards()
api.getCardByNumber(cardNumber)
api.getCardByUserId(userId)
api.updateBalance(data)

// Sales
api.listSales(category?, cardId?)
api.createSale(data)

// Orders
api.listOrders(category?)
api.getOpenOrders()
api.markOrderAsDelivered(orderId)

// Transactions
api.listTransactions(cardId?)

// Products (admin)
api.manageProducts(data, method)
```
