# 🔍 Debug: Erro 500 em MyCardPage.tsx

## 🎯 Problema Identificado

A página `MyCardPage.tsx` está tentando chamar `api.getCardByUserId()` mas está recebendo erro 500.

## 🔎 Possíveis Causas

### 1. **Edge Function não está deployada ou rodando localmente**

A função `list-cards` precisa estar disponível para responder à requisição.

**Solução:**
```bash
# Se estiver testando localmente:
supabase functions serve list-cards

# Se estiver em produção, precisa fazer deploy:
supabase functions deploy list-cards
```

### 2. **Token JWT inválido ou ausente**

A função `list-cards` requer autenticação obrigatória.

**Verificar:**
```javascript
// No console do navegador (DevTools)
const { auth } = await import('./src/lib/auth-client.ts')
const { data } = await auth.getSession()
console.log('Token:', data.session?.access_token)
// Se for null, o usuário não está autenticado
```

### 3. **Erro na Edge Function `list-cards`**

A função pode estar falhando ao buscar os dados.

**Verificar logs:**
```bash
# Se rodando localmente:
supabase functions serve list-cards
# Ver logs no terminal

# Se em produção:
# Ver logs no Supabase Dashboard → Edge Functions → list-cards → Logs
```

### 4. **Problema com userId vazio**

Se `user?.id` for `undefined` ou vazio, a query pode falhar.

**Verificar no código:**
```javascript
// Linha 86 em MyCardPage.tsx
const response = await api.getCardByUserId(user?.id || '')
// Se user?.id for undefined, vai passar '' (string vazia)
```

## 🛠️ Como Debug

### Passo 1: Verificar se a função está rodando

```bash
# Testar se a função responde
curl -X GET http://localhost:54321/functions/v1/list-cards \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Origin: http://localhost:5173"
```

Se retornar 404, a função não está rodando.

### Passo 2: Verificar token

No console do navegador:
```javascript
// Verificar se usuário está autenticado
const { auth } = await import('./src/lib/auth-client.ts')
const { data } = await auth.getSession()
console.log('Session:', data.session)
console.log('Token:', data.session?.access_token)

// Se não houver token, fazer login primeiro
```

### Passo 3: Verificar erro específico

Adicionar tratamento de erro melhor em `MyCardPage.tsx`:

```typescript
try {
  const { api } = await import('../../lib/api-client')
  const response = await api.getCardByUserId(user?.id || '')
  
  console.log('Response:', response) // Debug
  
  if (!response.success) {
    console.error('API Error:', response.error) // Debug
    // Se não tem cartão, não é erro - apenas não mostrar
    if (response.error?.includes('não encontrado') || response.error?.includes('not found')) {
      setCard(null)
      return
    }
    // Outros erros - mostrar mensagem
    throw new Error(response.error || 'Erro ao buscar cartão')
  }
  
  // ... resto do código
} catch (error) {
  console.error('Erro completo:', error) // Debug completo
  // Tratar erro adequadamente
}
```

### Passo 4: Testar Edge Function diretamente

```bash
# 1. Obter token (veja Passo 2)
# 2. Testar função diretamente
curl -v -X GET "http://localhost:54321/functions/v1/list-cards?userId=SEU_USER_ID" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Origin: http://localhost:5173" \
  -H "Content-Type: application/json"
```

## 🐛 Problema Mais Provável

Com base no código, o problema mais provável é:

**A Edge Function `list-cards` não está deployada ou não está rodando localmente!**

A função está tentando chamar `http://localhost:54321/functions/v1/list-cards` (local) ou a URL de produção, mas a função não existe lá ainda.

## ✅ Solução Rápida

### Se testando localmente:

```bash
# Terminal 1: Iniciar Supabase
supabase start

# Terminal 2: Servir funções
supabase functions serve

# Agora teste a página novamente
```

### Se em produção:

```bash
# Fazer deploy da função
supabase functions deploy list-cards

# Verificar no Dashboard se foi deployada com sucesso
```

## 📝 Próximos Passos

1. ✅ Verificar se `supabase functions serve` está rodando (se local)
2. ✅ Verificar se `list-cards` está deployada (se produção)
3. ✅ Verificar token JWT válido
4. ✅ Ver logs da função para ver erro específico
5. ✅ Adicionar tratamento de erro melhor no frontend

