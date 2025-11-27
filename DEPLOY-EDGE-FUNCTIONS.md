# 🚀 Guia de Deploy das Edge Functions

## Edge Functions Criadas

As seguintes Edge Functions foram criadas e precisam ser deployadas no Supabase:

1. ✅ `list-products` - Listar produtos (com autenticação obrigatória)
2. ✅ `list-cards` - Listar cartões (com autenticação obrigatória)
3. ✅ `list-sales` - Listar vendas (com autenticação obrigatória)
4. ✅ `list-orders` - Listar pedidos (com autenticação obrigatória)
5. ✅ `list-transactions` - Listar transações (com autenticação obrigatória)

## Pré-requisitos

1. Supabase CLI instalado:
   ```bash
   npm install -g supabase
   ```

2. Autenticado no Supabase:
   ```bash
   supabase login
   ```

3. Projeto linkado (se ainda não estiver):
   ```bash
   supabase link --project-ref seu-project-ref
   ```

## Variáveis de Ambiente Necessárias

Antes do deploy, configure as variáveis de ambiente no Supabase Dashboard:

1. Acesse: **Supabase Dashboard** → **Seu Projeto** → **Edge Functions** → **Settings**

2. Adicione as seguintes variáveis:
   - `ALLOWED_ORIGINS` - Domínios autorizados separados por vírgula
     - Exemplo: `https://seu-dominio.com,https://www.seu-dominio.com,http://localhost:5173`
   - `SUPABASE_URL` - Já deve estar configurada
   - `SUPABASE_ANON_KEY` - Já deve estar configurada
   - `SUPABASE_SERVICE_ROLE_KEY` - Já deve estar configurada

## Deploy das Edge Functions

### Opção 1: Deploy Individual (Recomendado)

Deploy cada função individualmente:

```bash
# Deploy list-products
supabase functions deploy list-products

# Deploy list-cards
supabase functions deploy list-cards

# Deploy list-sales
supabase functions deploy list-sales

# Deploy list-orders
supabase functions deploy list-orders

# Deploy list-transactions
supabase functions deploy list-transactions
```

### Opção 2: Deploy de Todas

Deploy todas as funções de uma vez:

```bash
supabase functions deploy
```

## Verificar Deploy

Após o deploy, verifique no Supabase Dashboard:

1. Acesse: **Supabase Dashboard** → **Edge Functions**
2. Verifique se todas as funções aparecem listadas
3. Teste cada função usando o botão "Invoke" no dashboard

## URLs das Edge Functions

Após o deploy, as funções estarão disponíveis em:

```
https://seu-project-ref.supabase.co/functions/v1/list-products
https://seu-project-ref.supabase.co/functions/v1/list-cards
https://seu-project-ref.supabase.co/functions/v1/list-sales
https://seu-project-ref.supabase.co/functions/v1/list-orders
https://seu-project-ref.supabase.co/functions/v1/list-transactions
```

## Configurar ALLOWED_ORIGINS

⚠️ **IMPORTANTE**: Configure a variável `ALLOWED_ORIGINS` com seus domínios de produção:

1. No Supabase Dashboard, vá em **Edge Functions** → **Settings**
2. Adicione a variável `ALLOWED_ORIGINS`
3. Valor exemplo para produção:
   ```
   https://seu-dominio.com,https://www.seu-dominio.com
   ```
4. Para desenvolvimento local:
   ```
   http://localhost:5173,http://localhost:3000
   ```

## Testar as Edge Functions

### Teste Local (Opcional)

```bash
# Servir funções localmente
supabase functions serve

# Testar uma função
curl -X GET http://localhost:54321/functions/v1/list-products \
  -H "Authorization: Bearer SEU_TOKEN_JWT"
```

### Teste em Produção

```bash
# Exemplo de teste
curl -X GET https://seu-project-ref.supabase.co/functions/v1/list-products \
  -H "Authorization: Bearer SEU_TOKEN_JWT" \
  -H "Origin: https://seu-dominio.com"
```

## Troubleshooting

### Erro: "Function not found"
- Verifique se o deploy foi bem-sucedido
- Confirme que está usando o nome correto da função

### Erro: "Missing environment variables"
- Verifique se todas as variáveis de ambiente estão configuradas
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` são obrigatórias

### Erro: "Origin not allowed"
- Verifique se o domínio está na variável `ALLOWED_ORIGINS`
- Confirme que o header `Origin` está sendo enviado

### Erro: "Unauthorized"
- Verifique se está enviando o token JWT no header `Authorization: Bearer <token>`
- Confirme que o token não está expirado

## Checklist Final

Antes de considerar o deploy completo:

- [ ] Todas as Edge Functions foram deployadas
- [ ] Variável `ALLOWED_ORIGINS` configurada com domínios corretos
- [ ] Variáveis de ambiente do Supabase configuradas
- [ ] Funções testadas localmente (opcional)
- [ ] Funções testadas em produção
- [ ] `api-client.ts` está usando as URLs corretas (já configurado automaticamente)

## Nota Importante

⚠️ As Edge Functions antigas (`make-sale`, `update-balance`, `manage-products`, `sapatinho-order-`) também foram atualizadas com CORS restrito. Se elas já estavam deployadas, faça o deploy novamente:

```bash
supabase functions deploy make-sale
supabase functions deploy update-balance
supabase functions deploy manage-products
supabase functions deploy sapatinho-order-
```

---

**Última atualização**: 2025-01-XX
**Status**: Pronto para deploy ✅

