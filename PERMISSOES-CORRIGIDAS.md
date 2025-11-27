# ✅ Permissões Corrigidas nas Edge Functions

## Problema Identificado

As Edge Functions estavam permitindo que **qualquer usuário logado** visse históricos gerais, quando na verdade:

- ✅ **Apenas `admin`, `lojinha` e `lanchonete`** podem ver históricos gerais
- ✅ **Usuários normais** só podem ver histórico do **SEU PRÓPRIO cartão**

## Correções Implementadas

### 1. `list-sales` (Histórico de Vendas)

#### Regras Implementadas:

**Se `cardId` é passado:**
- Usuário normal (`servico`, `encontrista`): Só vê vendas do SEU cartão (verificado se `card.user_id === user.id`)
- Admin/Lojinha/Lanchonete: Podem ver vendas de qualquer cartão

**Se `cardId` NÃO é passado (histórico geral):**
- Apenas `admin`, `lojinha` ou `lanchonete` podem ver
- Usuários normais recebem erro: "Acesso negado: apenas administradores, lojinha e lanchonete podem ver histórico geral"

**Categorias específicas (quando sem cardId):**
- `lojinha`: Apenas `admin` ou `lojinha` podem ver
- `lanchonete`: Apenas `admin` ou `lanchonete` podem ver
- `sapatinho`: Apenas `admin` ou `lojinha` podem ver

### 2. `list-orders` (Pedidos)

✅ **Já estava correto:**
- Apenas `admin` e `lojinha` podem ver pedidos
- Usuários normais não têm acesso

### 3. `list-transactions` (Transações)

✅ **Já estava correto:**
- Usuários normais só veem transações do próprio cartão
- Admin e comunicação veem todas

## Resumo das Permissões

| Função | Usuário Normal | Lojinha | Lanchonete | Admin |
|--------|---------------|---------|------------|-------|
| **Histórico geral de vendas** | ❌ Não pode | ✅ Pode (lojinha) | ✅ Pode (lanchonete) | ✅ Pode (todos) |
| **Histórico do próprio cartão** | ✅ Pode | ✅ Pode | ✅ Pode | ✅ Pode |
| **Histórico de outro cartão** | ❌ Não pode | ✅ Pode | ✅ Pode | ✅ Pode |
| **Pedidos** | ❌ Não pode | ✅ Pode | ❌ Não pode | ✅ Pode |
| **Transações próprias** | ✅ Pode | ✅ Pode | ✅ Pode | ✅ Pode |
| **Transações de outros** | ❌ Não pode | ❌ Não pode | ❌ Não pode | ✅ Pode |

## Como Testar

### Teste 1: Usuário Normal Tentando Ver Histórico Geral
```bash
# Usuário servico/encontrista tentando ver todas as vendas
curl -X GET "https://seu-projeto.supabase.co/functions/v1/list-sales" \
  -H "Authorization: Bearer TOKEN_USUARIO_NORMAL"
# Resultado esperado: ❌ 403 - Acesso negado
```

### Teste 2: Usuário Normal Vendo Próprio Cartão
```bash
# Usuário servico vendo vendas do próprio cartão
curl -X GET "https://seu-projeto.supabase.co/functions/v1/list-sales?cardId=SEU_CARD_ID" \
  -H "Authorization: Bearer TOKEN_USUARIO_NORMAL"
# Resultado esperado: ✅ 200 - Apenas vendas do seu cartão
```

### Teste 3: Lojinha Vendo Histórico Geral
```bash
# Lojinha vendo histórico geral da lojinha
curl -X GET "https://seu-projeto.supabase.co/functions/v1/list-sales?category=lojinha" \
  -H "Authorization: Bearer TOKEN_LOJINHA"
# Resultado esperado: ✅ 200 - Todas as vendas da lojinha
```

## Próximos Passos

1. ✅ Fazer redeploy de `list-sales` com as correções
2. ✅ Testar com diferentes usuários e roles
3. ✅ Verificar que usuários normais só veem próprio histórico
4. ✅ Verificar que apenas lojinha/lanchonete/admin veem históricos gerais

---

**Status**: ✅ Correções implementadas
**Próximo**: Redeploy necessário

