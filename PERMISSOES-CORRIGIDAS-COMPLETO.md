# ✅ Permissões Corrigidas - Resumo Completo

## Problema Identificado

As funções permitiam que **qualquer usuário logado** visse históricos gerais de vendas e pedidos, quando na verdade:

- ✅ **Apenas `admin`, `lojinha` e `lanchonete`** podem ver históricos gerais
- ✅ **Usuários normais** (`servico`, `encontrista`) só podem ver histórico do **SEU PRÓPRIO cartão**

## Correções Implementadas

### 1. Edge Function: `list-sales` ✅

**Regras Implementadas:**

**Se `cardId` é passado:**
- Usuário normal (`servico`, `encontrista`): Só vê vendas do SEU cartão (verificado se `card.user_id === user.id`)
- Admin/Lojinha/Lanchonete: Podem ver vendas de qualquer cartão

**Se `cardId` NÃO é passado (histórico geral):**
- Apenas `admin`, `lojinha` ou `lanchonete` podem ver
- Usuários normais recebem: "Acesso negado: apenas administradores, lojinha e lanchonete podem ver histórico geral"

**Categorias específicas (quando sem cardId):**
- `lojinha`: Apenas `admin` ou `lojinha`
- `lanchonete`: Apenas `admin` ou `lanchonete`
- `sapatinho`: Apenas `admin` ou `lojinha`

### 2. Edge Function: `list-orders` ✅

**Regras Implementadas:**

- **Apenas `admin` e `lojinha`** podem ver pedidos
- A validação acontece **no início**, antes de processar qualquer categoria
- Usuários normais recebem: "Acesso negado: apenas administradores e lojinha podem ver pedidos"
- Válido para **todos os tipos de pedidos** (lojinha e sapatinho)

### 3. tRPC Router: `src/server/routers/sales.ts` ✅

**Regras Implementadas:**

- Se `cardId` é passado: Usuário normal só vê vendas do próprio cartão
- Se `cardId` NÃO é passado: Apenas admin/lojinha/lanchonete podem ver histórico geral
- Validação por categoria: lojinha → admin/lojinha, lanchonete → admin/lanchonete, sapatinho → admin/lojinha

### 4. Edge Function: `list-transactions` ✅

**Já estava correto:**
- Usuários normais só veem transações do próprio cartão
- Admin e comunicação veem todas

## Resumo das Permissões por Função

| Função | Usuário Normal | Lojinha | Lanchonete | Admin |
|--------|---------------|---------|------------|-------|
| **list-sales** (sem cardId) | ❌ Bloqueado | ✅ Pode (lojinha) | ✅ Pode (lanchonete) | ✅ Pode (todos) |
| **list-sales** (com cardId próprio) | ✅ Pode | ✅ Pode | ✅ Pode | ✅ Pode |
| **list-sales** (com cardId de outro) | ❌ Bloqueado | ✅ Pode | ✅ Pode | ✅ Pode |
| **list-orders** (qualquer tipo) | ❌ Bloqueado | ✅ Pode | ❌ Bloqueado | ✅ Pode |
| **list-transactions** (próprio) | ✅ Pode | ✅ Pode | ✅ Pode | ✅ Pode |
| **list-transactions** (de outros) | ❌ Bloqueado | ❌ Bloqueado | ❌ Bloqueado | ✅ Pode |

## Arquivos Modificados

1. ✅ `supabase/functions/list-sales/index.ts` - Adicionada validação de cardId e permissões
2. ✅ `supabase/functions/list-orders/index.ts` - Validação centralizada no início
3. ✅ `src/server/routers/sales.ts` - Adicionado suporte a cardId e validações

## APIs Antigas (Ainda Expostas)

⚠️ **ATENÇÃO**: As seguintes APIs ainda fazem queries diretas ao Supabase e NÃO têm validação de permissões:

- `src/api/sales.api.ts` - `getAll()` e `create()`
- `src/api/orders.api.ts` - `getAll()` e `getOpenOrders()`
- `src/api/sapatinho-veloz.api.ts` - `getAll()` e `getOpenOrders()`
- `src/contexts/SupabaseDataContext.tsx` - `getSales()` e `getSalesByCardId()`

**Recomendação**: Essas APIs devem ser migradas para usar Edge Functions ou marcadas como deprecated. O frontend deve usar `api-client.ts` que já usa Edge Functions.

## Como Testar

### Teste 1: Usuário Normal Tentando Ver Histórico Geral de Vendas
```bash
curl -X GET "https://seu-projeto.supabase.co/functions/v1/list-sales" \
  -H "Authorization: Bearer TOKEN_USUARIO_NORMAL"
# Resultado esperado: ❌ 403 - Acesso negado
```

### Teste 2: Usuário Normal Vendo Próprio Cartão
```bash
curl -X GET "https://seu-projeto.supabase.co/functions/v1/list-sales?cardId=SEU_CARD_ID" \
  -H "Authorization: Bearer TOKEN_USUARIO_NORMAL"
# Resultado esperado: ✅ 200 - Apenas vendas do seu cartão
```

### Teste 3: Usuário Normal Tentando Ver Pedidos
```bash
curl -X GET "https://seu-projeto.supabase.co/functions/v1/list-orders" \
  -H "Authorization: Bearer TOKEN_USUARIO_NORMAL"
# Resultado esperado: ❌ 403 - Acesso negado
```

### Teste 4: Lojinha Vendo Histórico Geral
```bash
curl -X GET "https://seu-projeto.supabase.co/functions/v1/list-sales?category=lojinha" \
  -H "Authorization: Bearer TOKEN_LOJINHA"
# Resultado esperado: ✅ 200 - Todas as vendas da lojinha
```

## Próximos Passos

1. ✅ Fazer redeploy das Edge Functions corrigidas:
   ```bash
   supabase functions deploy list-sales
   supabase functions deploy list-orders
   ```

2. ⚠️ Migrar ou desabilitar APIs antigas em `src/api/*` que ainda fazem queries diretas

3. ✅ Atualizar frontend para sempre passar `cardId` quando usuário normal quiser ver próprio histórico

4. ✅ Verificar que o `api-client.ts` está sendo usado em vez das APIs antigas

---

**Status**: ✅ Edge Functions corrigidas
**Próximo**: Redeploy necessário + Migração de APIs antigas

