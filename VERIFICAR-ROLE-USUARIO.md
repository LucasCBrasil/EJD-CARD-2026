# Como Verificar e Corrigir o Role do Usuário

## Problema

Se você está aparecendo como `servico` em vez de `admin`, o problema está na tabela `app_users` do banco de dados.

## Solução

### Opção 1: Verificar e Atualizar via SQL (Recomendado)

1. **Acesse o SQL Editor no Supabase Dashboard:**
   - Vá para: https://supabase.com/dashboard/project/exppyrjeqxjglwdcijsk/sql/new

2. **Verificar seu role atual:**
   ```sql
   SELECT id, email, name, role 
   FROM app_users 
   WHERE email = 'seu-email@exemplo.com';
   ```

3. **Atualizar seu role para admin:**
   ```sql
   UPDATE app_users 
   SET role = 'admin' 
   WHERE email = 'seu-email@exemplo.com';
   ```

4. **Verificar se atualizou:**
   ```sql
   SELECT id, email, name, role 
   FROM app_users 
   WHERE email = 'seu-email@exemplo.com';
   ```

### Opção 2: Usar a Página de Admin (se tiver acesso)

Se você conseguir acessar a página de gerenciamento de usuários (`/admin/users`), você pode atualizar o role lá.

### Opção 3: Via Edge Function (para outros usuários)

Se você precisar atualizar o role de outro usuário e for admin:

```bash
# Testar a função manage-users localmente
curl -X PUT http://localhost:54321/functions/v1/manage-users \
  -H "Authorization: Bearer SEU_TOKEN_JWT" \
  -H "Content-Type: application/json" \
  -d '{"userId": "id-do-usuario", "role": "admin"}'
```

## Depois de Atualizar

1. **Limpar cache do navegador** ou fazer logout e login novamente
2. **Verificar no console** se o role está correto:
   - Abra o DevTools (F12)
   - Vá para a aba Console
   - Procure por logs do `AuthContext` ou `get-user-profile`

## Prevenção Futura

O problema pode ter acontecido porque:
- A Edge Function `get-user-profile` cria novos usuários com role `'servico'` por padrão
- Se você fez login antes de ter o registro no banco, ele foi criado automaticamente com role `'servico'`

Para evitar isso no futuro, certifique-se de que usuários importantes tenham seus registros criados manualmente ou via script de migração com o role correto.

