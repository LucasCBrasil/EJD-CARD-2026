# ⚡ Solução Rápida - Erro 500 em MyCardPage

## 🚨 Problema

`MyCardPage.tsx` está retornando erro 500 ao tentar carregar dados do cartão.

## ✅ Solução Imediata

### Opção 1: Se você NÃO fez deploy ainda (mais provável)

**A Edge Function `list-cards` não existe ainda em produção/local!**

```bash
# 1. Testar localmente primeiro
supabase start
supabase functions serve

# 2. Depois fazer deploy
supabase functions deploy list-cards
```

### Opção 2: Verificar se função está rodando

```bash
# Ver se Supabase local está rodando
supabase status

# Se não estiver, iniciar:
supabase start

# Servir funções:
supabase functions serve
```

### Opção 3: Verificar no navegador

1. Abra DevTools (F12)
2. Vá em **Console**
3. Procure por erros específicos
4. Vá em **Network**
5. Procure pela requisição a `list-cards`
6. Veja a resposta completa do erro

## 🔍 Mensagens de Erro Comuns

### "Failed to fetch" ou "Network error"
- Função não está rodando
- URL incorreta
- CORS bloqueando

### "401 Unauthorized"
- Token JWT inválido
- Usuário não autenticado

### "404 Not Found"
- Função não foi deployada
- URL incorreta

### "500 Internal Server Error"
- Erro dentro da função
- Ver logs da função
- Verificar variáveis de ambiente

## 📋 Checklist Rápido

- [ ] `supabase start` rodando?
- [ ] `supabase functions serve` rodando?
- [ ] Função `list-cards` existe em `supabase/functions/list-cards/`?
- [ ] Usuário está autenticado? (token JWT existe?)
- [ ] URL base está correta? (local vs produção)

## 🎯 Próximo Passo

**Teste localmente primeiro:**

```bash
# Terminal 1
supabase start

# Terminal 2  
supabase functions serve

# Terminal 3 (frontend)
npm run dev
```

Agora acesse a página e veja se funciona!

