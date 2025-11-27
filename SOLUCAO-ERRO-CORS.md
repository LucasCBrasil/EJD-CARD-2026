# Solução para Erro de CORS - Edge Functions

## Problema

O frontend está tentando chamar Edge Functions em produção, mas elas não estão deployadas ainda, causando erros de CORS.

```
Access to fetch at 'https://exppyrjeqxjglwdcijsk.supabase.co/functions/v1/...' 
from origin 'http://localhost:5174' has been blocked by CORS policy
```

## Soluções

### Opção 1: Testar Localmente (Recomendado antes de fazer deploy)

1. **Iniciar Supabase localmente:**
   ```bash
   supabase start
   ```

2. **Iniciar Edge Functions localmente:**
   ```bash
   supabase functions serve
   ```

3. **Configurar variável de ambiente local:**
   
   Adicione ao arquivo `.env`:
   ```env
   VITE_SUPABASE_LOCAL_URL=http://localhost:54321
   ```

4. **Reiniciar o servidor de desenvolvimento:**
   
   O Vite precisa ser reiniciado para pegar novas variáveis de ambiente:
   ```bash
   # Parar o servidor atual (Ctrl+C)
   # Iniciar novamente
   npm run dev
   ```

### Opção 2: Fazer Deploy das Edge Functions

Se você quiser testar direto em produção, faça deploy das funções:

```bash
# Deploy individual (recomendado para testar)
supabase functions deploy list-cards
supabase functions deploy list-products
supabase functions deploy list-sales
supabase functions deploy list-orders
supabase functions deploy list-transactions
supabase functions deploy get-user-profile
supabase functions deploy manage-users

# Ou deploy de todas de uma vez
supabase functions deploy
```

⚠️ **IMPORTANTE**: Após fazer deploy, configure a variável de ambiente `ALLOWED_ORIGINS` no Supabase para incluir seu domínio de produção:

```bash
supabase secrets set ALLOWED_ORIGINS="http://localhost:5174,https://seu-dominio.com"
```

### Opção 3: Verificar Modo de Desenvolvimento

Se o `api-client.ts` não está detectando que está em modo desenvolvimento, você pode forçar:

1. Verifique se está rodando com `npm run dev` (não `npm run build && npm run preview`)
2. O `import.meta.env.DEV` deve ser `true` quando está em desenvolvimento

## Correções Aplicadas

1. ✅ `_layout.tsx` corrigido para usar `auth` do `auth-client.ts`
2. ✅ CORS atualizado para incluir `localhost:5174`

## Próximos Passos

1. Escolha uma das opções acima (recomendo Opção 1 para testar localmente primeiro)
2. Teste o aplicativo novamente
3. Se ainda houver erros, verifique os logs:
   - Frontend: Console do navegador
   - Edge Functions (local): Terminal onde está rodando `supabase functions serve`
   - Edge Functions (produção): Logs no dashboard do Supabase

