# 🚀 Deploy Completo das Edge Functions - Guia Atualizado

## ✅ Funções que PRECISAM ser Deployadas

### 1. Novas Edge Functions (Criadas Agora)

```bash
# Funções de leitura (seguras)
supabase functions deploy list-products
supabase functions deploy list-cards
supabase functions deploy list-sales
supabase functions deploy list-orders
supabase functions deploy list-transactions
supabase functions deploy get-user-profile

# Gerenciamento de usuários
supabase functions deploy manage-users
```

### 2. Funções Existentes Atualizadas (CORS Restrito)

```bash
# Funções que já existiam mas foram atualizadas
supabase functions deploy make-sale
supabase functions deploy update-balance
supabase functions deploy manage-products
supabase functions deploy sapatinho-order-
supabase functions deploy mark-sale-delivered
```

## 📋 Checklist de Deploy

### Antes de Fazer Deploy

- [ ] Supabase CLI instalado e atualizado
- [ ] Autenticado no Supabase: `supabase login`
- [ ] Projeto linkado: `supabase link --project-ref seu-project-ref`
- [ ] Variável `ALLOWED_ORIGINS` configurada no Dashboard

### Configurar Variável de Ambiente

**IMPORTANTE**: Configure antes do deploy!

1. Acesse: **Supabase Dashboard** → **Seu Projeto** → **Edge Functions** → **Settings**

2. Adicione a variável `ALLOWED_ORIGINS`:
   ```
   https://seu-dominio.com,https://www.seu-dominio.com,http://localhost:5173
   ```
   
   **Valores exemplo:**
   - Produção: `https://seu-dominio.com,https://www.seu-dominio.com`
   - Desenvolvimento: `http://localhost:5173,http://localhost:3000`
   - Ambos: `https://seu-dominio.com,https://www.seu-dominio.com,http://localhost:5173`

## 🎯 Comandos de Deploy

### Opção 1: Deploy Individual (Recomendado)

Execute um por um para verificar erros:

```bash
# Novas funções
supabase functions deploy list-products
supabase functions deploy list-cards
supabase functions deploy list-sales
supabase functions deploy list-orders
supabase functions deploy list-transactions

# Funções atualizadas
supabase functions deploy make-sale
supabase functions deploy update-balance
supabase functions deploy manage-products
supabase functions deploy sapatinho-order-
supabase functions deploy mark-sale-delivered
```

### Opção 2: Deploy de Todas

```bash
supabase functions deploy
```

⚠️ **Atenção**: Isso deploya TODAS as funções da pasta `supabase/functions/`, incluindo as novas e atualizadas.

## ✅ Verificação Pós-Deploy

Após o deploy, verifique no Dashboard:

1. **Supabase Dashboard** → **Edge Functions**
2. Confirme que todas as funções aparecem listadas
3. Teste cada função usando o botão "Invoke" (com token JWT válido)

### URLs das Funções

Após o deploy, as funções estarão disponíveis em:

```
https://seu-project-ref.supabase.co/functions/v1/list-products
https://seu-project-ref.supabase.co/functions/v1/list-cards
https://seu-project-ref.supabase.co/functions/v1/list-sales
https://seu-project-ref.supabase.co/functions/v1/list-orders
https://seu-project-ref.supabase.co/functions/v1/list-transactions
https://seu-project-ref.supabase.co/functions/v1/make-sale
https://seu-project-ref.supabase.co/functions/v1/update-balance
https://seu-project-ref.supabase.co/functions/v1/manage-products
https://seu-project-ref.supabase.co/functions/v1/sapatinho-order-
https://seu-project-ref.supabase.co/functions/v1/mark-sale-delivered
```

## 🧪 Testar Localmente (Opcional)

Antes de fazer deploy, você pode testar localmente:

```bash
# Servir funções localmente
supabase functions serve

# Testar uma função
curl -X GET http://localhost:54321/functions/v1/list-products \
  -H "Authorization: Bearer SEU_TOKEN_JWT" \
  -H "Origin: http://localhost:5173"
```

## ⚠️ Troubleshooting

### Erro: "Function not found"
- Verifique se o nome da função está correto
- Confirme que o arquivo `index.ts` existe na pasta da função

### Erro: "Missing environment variables"
- Verifique se `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` estão configuradas
- Confirme que `ALLOWED_ORIGINS` está configurada

### Erro: "Origin not allowed"
- Verifique se o domínio está na variável `ALLOWED_ORIGINS`
- Confirme que o header `Origin` está sendo enviado

### Erro: "Unauthorized"
- Verifique se está enviando o token JWT no header `Authorization: Bearer <token>`
- Confirme que o token não está expirado

## 📊 Resumo das Mudanças

### Novas Funções (7)
- ✅ `list-products` - Listar produtos com permissões
- ✅ `list-cards` - Listar cartões com permissões
- ✅ `list-sales` - Listar vendas (histórico geral ou por cartão)
- ✅ `list-orders` - Listar pedidos (apenas admin/lojinha)
- ✅ `list-transactions` - Listar transações (próprias ou todas se admin)
- ✅ `get-user-profile` - Retornar perfil do usuário autenticado
- ✅ `manage-users` - Gerenciar usuários (buscar, atualizar role) - apenas admin

### Funções Atualizadas (5)
- ✅ `make-sale` - CORS restrito
- ✅ `update-balance` - CORS restrito
- ✅ `manage-products` - CORS restrito
- ✅ `sapatinho-order-` - CORS restrito
- ✅ `mark-sale-delivered` - CORS restrito

### Permissões Implementadas

**list-sales:**
- Histórico geral: Apenas admin, lojinha, lanchonete
- Histórico próprio: Qualquer usuário pode ver seu próprio cartão

**list-orders:**
- Apenas admin e lojinha podem ver pedidos

**list-transactions:**
- Usuários normais: Apenas próprias transações
- Admin/comunicação: Todas as transações

## 🎯 Ordem Recomendada de Deploy

1. **Primeiro**: Deploy das funções atualizadas (já existentes)
   ```bash
   supabase functions deploy make-sale
   supabase functions deploy update-balance
   supabase functions deploy manage-products
   supabase functions deploy sapatinho-order-
   supabase functions deploy mark-sale-delivered
   ```

2. **Depois**: Deploy das novas funções
   ```bash
   supabase functions deploy list-products
   supabase functions deploy list-cards
   supabase functions deploy list-sales
   supabase functions deploy list-orders
   supabase functions deploy list-transactions
   supabase functions deploy get-user-profile
   supabase functions deploy manage-users
   ```

3. **Por último**: Testar no frontend para garantir que tudo funciona

---

**Status**: ✅ Pronto para deploy
**Última atualização**: 2025-01-XX

