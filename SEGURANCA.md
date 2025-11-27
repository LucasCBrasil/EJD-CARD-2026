# 🔒 Guia de Segurança - Sistema EJD Card

## ✅ CORREÇÕES IMPLEMENTADAS - 2025

### Problemas Críticos Corrigidos:

1. **✅ API Key removida do frontend** - Cliente Supabase não é mais exportado
2. **✅ Estrutura tRPC oculta** - AppRouter não é mais importado no código de produção
3. **✅ Chamadas diretas ao Supabase removidas** - Todas as operações passam por Edge Functions
4. **✅ CORS restrito** - Apenas origens autorizadas podem fazer requisições
5. **✅ Validação de origem** - Handler tRPC valida origem das requisições
6. **✅ Mensagens de erro ofuscadas** - Não expõe estrutura da API

---

## ⚠️ Problemas Críticos de Segurança Identificados e Corrigidos

### 1. **Exposição de API Keys no Frontend**

#### ❌ Problema:
Variáveis que começam com `VITE_` são **embutidas no bundle JavaScript** durante o build e ficam **visíveis para qualquer pessoa** que inspecionar o código no navegador.

#### ✅ Solução:
- **NUNCA** coloque `SERVICE_ROLE_KEY` ou outras chaves sensíveis em variáveis `VITE_*`
- Use apenas `VITE_SUPABASE_ANON_KEY` no frontend (é segura quando RLS está configurado)
- Todas as operações críticas devem passar por **Edge Functions** ou **tRPC procedures** no backend

### 2. **Logs Expondo Informações Sensíveis**

#### ❌ Problema:
`console.log` no código do servidor pode expor tokens, headers e outras informações sensíveis nos logs.

#### ✅ Solução:
- Removido `console.log('opts.req.headers', opts)` de `src/server/trpc.ts`
- Use apenas logs de erro quando necessário, sem expor dados sensíveis

### 3. **Documentação Confusa sobre Variáveis de Ambiente**

#### ❌ Problema:
O CHANGELOG.md documentava `VITE_SUPABASE_SERVICE_ROLE_KEY`, o que poderia levar alguém a colocá-la no frontend.

#### ✅ Solução:
- Documentação atualizada para deixar claro que `SERVICE_ROLE_KEY` **NUNCA** deve estar no frontend
- Separadas as variáveis de ambiente em "Frontend" e "Backend"

---

## 📋 Regras de Segurança

### ✅ O que PODE estar no Frontend:

1. **`VITE_SUPABASE_URL`** - URL pública do projeto
2. **`VITE_SUPABASE_ANON_KEY`** - Chave anônima (segura com RLS ativado)

### ❌ O que NUNCA deve estar no Frontend:

1. **`SERVICE_ROLE_KEY`** - Chave com permissões totais
2. **API Keys de serviços externos** (PIX, pagamentos, etc.)
3. **Tokens de autenticação** (devem ser gerenciados via cookies/headers)
4. **Senhas ou secrets** de qualquer tipo

---

## 🛡️ Como o Sistema Está Protegido

### 1. **Row Level Security (RLS) no Supabase**

Todas as tabelas críticas têm RLS ativado com políticas que:
- Limitam acesso baseado no usuário autenticado
- Verificam roles e permissões
- Impedem acesso não autorizado mesmo com a ANON_KEY

**Arquivo:** `supabase/migrations/20251121_enable_rls.sql`

### 2. **Edge Functions para Operações Críticas**

Todas as operações que modificam dados sensíveis passam por Edge Functions:
- `make-sale` - Vendas
- `update-balance` - Atualização de saldo
- `manage-products` - Gerenciamento de produtos
- `sapatinho-order-` - Pedidos do Sapatinho Veloz

**Localização:** `supabase/functions/`

### 3. **Autenticação Obrigatória**

- Todas as Edge Functions verificam autenticação via token JWT
- tRPC procedures usam middlewares de autenticação
- Tokens são validados no servidor antes de qualquer operação

### 4. **Validação de Permissões**

- Sistema de roles implementado (`admin`, `lojinha`, `lanchonete`, etc.)
- Verificação de permissões em cada operação crítica
- Logs de tentativas de acesso não autorizado

---

## 🔍 Verificações de Segurança

### Como verificar se há problemas:

1. **Inspecionar o bundle JavaScript:**
   ```bash
   npm run build
   # Procurar por SERVICE_ROLE_KEY ou outras chaves sensíveis no dist/
   ```

2. **Verificar variáveis VITE_*:**
   ```bash
   grep -r "VITE_" src/
   # Garantir que não há chaves sensíveis
   ```

3. **Verificar logs do servidor:**
   - Não devem conter tokens ou informações sensíveis
   - Apenas logs de erro genéricos quando necessário

---

## 📝 Checklist de Segurança

Antes de fazer deploy, verifique:

- [ ] Nenhuma `SERVICE_ROLE_KEY` no código frontend
- [ ] Nenhuma API key sensível em variáveis `VITE_*`
- [ ] RLS ativado em todas as tabelas críticas
- [ ] Edge Functions protegidas com autenticação
- [ ] Logs não expõem informações sensíveis
- [ ] Tokens são validados no servidor
- [ ] Permissões verificadas em cada operação crítica

---

## 🚨 Se Você Encontrar uma Vulnerabilidade

1. **NÃO** commite a correção diretamente
2. Documente o problema
3. Crie uma issue ou avise a equipe
4. Corrija seguindo as práticas deste documento

---

## 📚 Referências

- [Supabase Security Best Practices](https://supabase.com/docs/guides/auth/row-level-security)
- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)

---

**Última atualização:** 2025-01-XX
**Versão:** 2.1.0

