# ✅ Migração de APIs Antigas - Completa

## Resumo

Todas as APIs antigas que faziam queries diretas ao Supabase foram **removidas** ou **migradas** para usar Edge Functions via `api-client.ts`.

## Arquivos Removidos

1. ✅ **`src/api/sales.api.ts`** - **REMOVIDO COMPLETAMENTE**
   - `getAll()` → Use `api.listSales(category)` 
   - `create()` → Use `api.createSale(data)`

2. ✅ **`src/api/orders.api.ts`** - **REMOVIDO COMPLETAMENTE**
   - `getAll()` → Use `api.listOrders(category)`
   - `getOpenOrders()` → Use `api.getOpenOrders()` ou `api.listOrders('lojinha')`
   - `markAsDelivered()` → Use `api.markOrderAsDelivered(orderId)`

3. ⚠️ **`src/api/sapatinho-veloz.api.ts`** - **PARCIALMENTE REMOVIDO**
   - `getAll()` → **REMOVIDO** → Use `api.listOrders('sapatinho')`
   - `getOpenOrders()` → **REMOVIDO** → Use `api.listOrders('sapatinho')` e filtrar por status
   - `markAsDelivered()` → **REMOVIDO** → Use `api.markOrderAsDelivered(orderId)`
   - `create()` → **MANTIDO** (já usa Edge Function `sapatinho-order-`)

## Arquivos Migrados

### Páginas Migradas:

1. ✅ **`src/pages/sapatinho-veloz/SapatinhoSalesHistoryPage.tsx`**
   - Antes: `sapatinhoVelozApi.getAll()`
   - Agora: `api.listOrders('sapatinho')`

2. ✅ **`src/pages/sapatinho-veloz/SapatinhoVelozOrdersPage.tsx`**
   - Antes: `sapatinhoVelozApi.getOpenOrders()` e `sapatinhoVelozApi.markAsDelivered()`
   - Agora: `api.listOrders('sapatinho')` e `api.markOrderAsDelivered(orderId)`

### Context Migrado:

3. ✅ **`src/contexts/SupabaseDataContext.tsx`**
   - `getSales()` → Agora usa `api.listSales()` internamente (com warning de deprecated)
   - `getSalesByCardId()` → Agora usa `api.listSales(undefined, cardId)` internamente
   - `getOpenOrders()` → Agora usa `api.listOrders('lojinha')` internamente
   - Mantidos para compatibilidade com código legado, mas geram warnings

## Métodos Adicionados ao api-client.ts

```typescript
// Novos métodos adicionados:
api.getOpenOrders()  // Lista pedidos abertos
api.markOrderAsDelivered(orderId)  // Marca pedido como entregue
```

## Benefícios da Migração

1. ✅ **Segurança**: Todas as operações passam por Edge Functions autenticadas
2. ✅ **Validação de Permissões**: Edge Functions validam quem pode acessar o quê
3. ✅ **Sem Exposição de API Keys**: API keys não estão mais no bundle do frontend
4. ✅ **CORS Restrito**: Apenas origens autorizadas podem fazer requisições
5. ✅ **Estrutura Ocultada**: Nomes de rotas e estrutura da API não ficam expostos

## Próximos Passos (Opcional)

Se quiser remover completamente os warnings:

1. Migrar todas as páginas que ainda usam `SupabaseDataContext.getSales()`, `getSalesByCardId()`, `getOpenOrders()` para usar `api.listSales()`, etc. diretamente
2. Depois disso, remover esses métodos deprecated do `SupabaseDataContext`

## Status Final

✅ **100% Completo**: Todas as APIs inseguras foram removidas ou migradas.

**Não há mais queries diretas ao Supabase no frontend para operações de leitura/escrita críticas!**

---

**Data da migração**: 2025-01-XX
**Status**: ✅ Completo

