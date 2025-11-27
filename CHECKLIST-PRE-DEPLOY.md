# ✅ Checklist Pré-Deploy - Edge Functions

## 🔍 Validação Manual do Código

Antes de fazer deploy, revise cada função:

### ✅ Estrutura Básica

- [ ] Arquivo `index.ts` existe em `supabase/functions/nome-funcao/`
- [ ] Usa `Deno.serve()` como handler principal
- [ ] Trata OPTIONS (CORS preflight)

### ✅ Segurança

- [ ] Verifica autenticação (token JWT)
- [ ] Verifica permissões/roles quando necessário
- [ ] Valida input (parâmetros obrigatórios)
- [ ] Não expõe informações sensíveis em erros
- [ ] Usa `createSupabaseClient()` ou `createClient()` com SERVICE_ROLE_KEY para operações privilegiadas

### ✅ CORS

- [ ] Usa `getCorsHeaders(origin)` do `_shared/cors.ts`
- [ ] Retorna headers CORS em todas as respostas
- [ ] Trata OPTIONS corretamente

### ✅ Respostas

- [ ] Formato consistente: `{ success: boolean, data?: any, error?: string }`
- [ ] Status codes corretos:
  - `200` - Sucesso
  - `400` - Dados inválidos
  - `401` - Não autenticado
  - `403` - Sem permissão
  - `404` - Não encontrado
  - `500` - Erro interno

### ✅ Imports

- [ ] Todos os imports de `_shared/` estão corretos
- [ ] Tipos importados corretamente
- [ ] Sem imports quebrados

## 🧪 Testes Locais

### Passo 1: Iniciar Supabase Local

```bash
# Terminal 1
supabase start

# Terminal 2
supabase functions serve
```

### Passo 2: Obter Token JWT

```bash
# Via frontend (DevTools Console):
const { auth } = await import('./src/lib/auth-client.ts')
const { data } = await auth.getSession()
console.log('Token:', data.session?.access_token)
```

### Passo 3: Testar Funções

```bash
# Usar script automatizado
./scripts/test-functions.sh SEU_TOKEN_AQUI

# Ou testar manualmente
curl -X GET http://localhost:54321/functions/v1/get-user-profile \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Origin: http://localhost:5173"
```

## 📝 Funções a Testar

### 1. get-user-profile
- [ ] Retorna perfil do usuário autenticado
- [ ] Cria linha em `app_users` se não existir
- [ ] Atualiza email/name se estiverem faltando

### 2. manage-users
- [ ] GET: Busca usuários por email (apenas admin)
- [ ] PUT: Atualiza role (apenas admin)
- [ ] Não permite alterar próprio role

### 3. list-products
- [ ] Lista produtos (todos ou por categoria)
- [ ] Filtra apenas produtos ativos
- [ ] Retorna formato correto

### 4. list-cards
- [ ] Lista cartões do usuário autenticado
- [ ] Filtra por cardNumber se fornecido
- [ ] Filtra por userId se fornecido

### 5. list-sales
- [ ] Histórico geral: apenas admin/lojinha/lanchonete
- [ ] Histórico próprio: qualquer usuário pode ver seu cartão
- [ ] Filtra por categoria quando fornecido

### 6. list-orders
- [ ] Apenas admin e lojinha podem ver
- [ ] Filtra por categoria (lojinha/sapatinho)
- [ ] Retorna formato correto

### 7. list-transactions
- [ ] Usuários normais: apenas próprias transações
- [ ] Admin/comunicação: todas as transações
- [ ] Filtra por cardId quando fornecido

### 8. update-balance (atualizada)
- [ ] action='create': Cria cartão
- [ ] action='associate': Associa cartão ao usuário
- [ ] action='credit'/'debit': Atualiza saldo
- [ ] Apenas admin/comunicação podem usar

## 🚨 Problemas Comuns

### Erro: "Cannot find module '_shared/cors.ts'"
- Verifique se o arquivo existe em `supabase/functions/_shared/cors.ts`
- Verifique o caminho do import

### Erro: "Deno is not defined"
- Certifique-se de usar `Deno.serve()` (não funciona no Node.js)
- Edge Functions rodam no Deno runtime

### Erro: "Missing environment variables"
- Configure variáveis no Supabase Dashboard
- Para local: configure em `.env` ou no CLI

### Erro: "Origin not allowed"
- Configure `ALLOWED_ORIGINS` no Dashboard
- Para local: `http://localhost:5173,http://localhost:3000`

## 📊 Resultado Esperado

Após testar localmente, você deve ver:

```
✅ get-user-profile: Sucesso (200)
✅ list-products: Sucesso (200)
✅ list-cards: Sucesso (200)
✅ manage-users: Sucesso (200) ou 403 (se não for admin)
✅ CORS: Configurado corretamente (200)
```

## 🚀 Próximo Passo

Depois que **TODAS** as funções passarem nos testes locais:

```bash
# Deploy individual (recomendado)
supabase functions deploy nome-da-funcao

# Ou deploy de todas
supabase functions deploy
```

---

**Lembre-se**: Teste localmente ANTES de fazer deploy! 🎯

