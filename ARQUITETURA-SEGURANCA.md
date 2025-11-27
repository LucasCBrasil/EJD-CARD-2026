# 🔒 Nova Arquitetura de Segurança - Documentação para Desenvolvedores

## 📋 Visão Geral

Esta documentação descreve as mudanças arquiteturais implementadas para proteger a aplicação contra exposição de API keys e documentação da API no bundle JavaScript do frontend.

## 🚨 Problemas Identificados e Resolvidos

### Problema 1: API Key Exposta no Bundle
**Antes:**
- `VITE_SUPABASE_ANON_KEY` estava embutida no JavaScript do navegador
- Qualquer pessoa podia inspecionar o código e obter a chave
- Permitia acesso direto ao Supabase mesmo com RLS

**Depois:**
- API key removida do frontend
- Autenticação apenas via `auth-client.ts` (sem acesso direto ao Supabase)
- Todas as operações de dados via Edge Functions

### Problema 2: Documentação Completa da API Exposta
**Antes:**
- Toda a estrutura tRPC estava no bundle JavaScript
- Nomes de rotas, schemas Zod, tipos de entrada/saída visíveis
- Facilita ataques e engenharia reversa

**Depois:**
- Estrutura tRPC oculta em produção
- Chamadas REST genéricas via `api-client.ts`
- Endpoints não revelam estrutura interna

### Problema 3: Chamadas Diretas ao Supabase
**Antes:**
- Frontend fazia queries diretas ao Supabase
- Permitia contornar Edge Functions
- Exposição da estrutura do banco de dados

**Depois:**
- Todas as queries via Edge Functions
- Frontend não acessa Supabase diretamente (exceto autenticação)

## 🏗️ Nova Arquitetura

### Camadas da Aplicação

```
┌─────────────────────────────────────────┐
│         Frontend (React/Vite)           │
│  ┌───────────────────────────────────┐  │
│  │  auth-client.ts (autenticação)    │  │
│  │  api-client.ts (REST genérico)    │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
                    │
                    │ HTTPS (autenticado)
                    ▼
┌─────────────────────────────────────────┐
│      Edge Functions (Supabase)          │
│  ┌───────────────────────────────────┐  │
│  │  - list-products                  │  │
│  │  - list-cards                     │  │
│  │  - list-sales                     │  │
│  │  - list-orders                    │  │
│  │  - get-user-profile               │  │
│  │  - manage-users                   │  │
│  │  - etc...                         │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
                    │
                    │ Service Role Key
                    ▼
┌─────────────────────────────────────────┐
│       Supabase Database (PostgreSQL)    │
│          Row Level Security (RLS)       │
└─────────────────────────────────────────┘
```

### Componentes Principais

#### 1. `src/lib/auth-client.ts`
**Propósito:** Cliente Supabase apenas para autenticação
- Usa `ANON_KEY` (seguro quando RLS está configurado)
- Apenas operações de auth: `signIn`, `signOut`, `getSession`, `getUser`
- Não permite queries diretas ao banco

#### 2. `src/lib/api-client.ts`
**Propósito:** Cliente REST genérico que oculta estrutura da API
- Não expõe tipos, schemas ou nomes de rotas no bundle
- Faz chamadas HTTP simples para Edge Functions
- Formato de resposta: `{ success: boolean, data?: any, error?: string }`

#### 3. Edge Functions (`supabase/functions/*`)
**Propósito:** Lógica de negócio segura no servidor
- Autenticação obrigatória em todas
- CORS restrito apenas a origens autorizadas
- Validação de permissões (roles)
- Acesso ao banco via Service Role Key (nunca exposta)

#### 4. `src/lib/trpc.ts`
**Status:** DEPRECATED ⚠️
- Não use mais tRPC diretamente do frontend
- Mantido apenas para compatibilidade temporária
- Use `api-client.ts` em vez disso

## 📁 Estrutura de Arquivos

```
src/
├── lib/
│   ├── auth-client.ts      ✅ NOVO: Autenticação segura
│   ├── api-client.ts       ✅ NOVO: Cliente REST genérico
│   ├── trpc.ts             ⚠️  DEPRECATED (não use)
│   └── supabase.ts         ⚠️  DEPRECATED (não use)
│
├── api/                    ⚠️  REMOVIDO: Arquivos antigos deletados
│   ├── products.api.ts     ❌ DELETADO
│   ├── cards.api.ts        ❌ DELETADO
│   ├── sales.api.ts        ❌ DELETADO
│   └── ...
│
supabase/functions/
├── _shared/
│   ├── auth.ts            🔒 Validação de autenticação
│   ├── cors.ts            🔒 Headers CORS restritos
│   ├── supabase.ts        🔒 Cliente Supabase (service role)
│   └── types.ts           📝 Tipos compartilhados
│
├── list-products/         ✅ NOVO
├── list-cards/            ✅ NOVO
├── list-sales/            ✅ NOVO
├── list-orders/           ✅ NOVO
├── list-transactions/     ✅ NOVO
├── get-user-profile/      ✅ NOVO
├── manage-users/          ✅ NOVO
└── ...
```

## 🔐 Segurança Implementada

### 1. CORS Restrito
**Arquivo:** `supabase/functions/_shared/cors.ts`

- Apenas origens autorizadas podem fazer requisições
- Configurado via variável de ambiente `ALLOWED_ORIGINS`
- Headers CORS válidos apenas para origens permitidas

```typescript
// Exemplo de uso
const corsHeaders = getCorsHeaders(origin)
return new Response(JSON.stringify(data), {
  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
})
```

### 2. Autenticação Obrigatória
**Arquivo:** `supabase/functions/_shared/auth.ts`

- Todas as Edge Functions validam JWT token
- Função `requireAuth()` retorna 401 se não autenticado
- Extração segura do usuário do token

### 3. Validação de Permissões (Roles)
**Arquivo:** `supabase/functions/_shared/auth.ts`

- Funções verificam roles do usuário (`admin`, `lojinha`, etc.)
- Acesso restrito baseado em permissões
- Exemplo: `isAdmin()`, `getUserRole()`

### 4. Row Level Security (RLS)
**Arquivo:** `supabase/migrations/20251121_enable_rls.sql`

- Políticas RLS em todas as tabelas críticas
- Usuários só veem seus próprios dados (ou baseado em role)
- Edge Functions usam `service_role` para operações administrativas

### 5. Rate Limiting (tRPC Handler)
**Arquivo:** `api/trpc/[trpc].ts`

- Validação de origem
- Rate limiting básico por IP/usuário
- Erros genéricos que não revelam estrutura

## 📝 Como Usar a Nova Arquitetura

### Para Autenticação

```typescript
import { auth } from '@/lib/auth-client'

// Login
await auth.signInWithPassword({ email, password })

// Logout
await auth.signOut()

// Obter sessão
const { data: { session } } = await auth.getSession()

// Obter usuário
const { data: { user } } = await auth.getUser()
```

### Para Operações de Dados

```typescript
import { api } from '@/lib/api-client'

// Listar produtos
const response = await api.listProducts('lojinha')
if (response.success) {
  console.log(response.data) // Array de produtos
} else {
  console.error(response.error) // Mensagem de erro
}

// Criar produto (admin only)
const createResponse = await api.createProduct({
  name: 'Produto',
  price: 10.00,
  category: 'lojinha',
  // ...
})

// Listar cartões
const cardsResponse = await api.listCards()

// Buscar cartão por usuário
const cardResponse = await api.getCardByUserId(userId)

// Criar venda
const saleResponse = await api.createSale({
  cardId: '...',
  items: [...],
  category: 'lojinha'
})
```

### Resposta Padrão da API

Todas as funções retornam o mesmo formato:

```typescript
interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

// Exemplo de sucesso
{
  success: true,
  data: { /* dados aqui */ }
}

// Exemplo de erro
{
  success: false,
  error: 'Mensagem de erro descritiva'
}
```

## 🔄 Migração de Código Antigo

### ❌ ANTES (Código Antigo - NÃO USE MAIS)

```typescript
import { supabase } from '@/lib/supabase'

// ❌ Chamada direta ao Supabase
const { data } = await supabase
  .from('products')
  .select('*')

// ❌ Uso de tRPC exposto
const products = trpc.sales.getAll.useQuery()
```

### ✅ DEPOIS (Código Novo)

```typescript
import { api } from '@/lib/api-client'

// ✅ Chamada via Edge Function
const response = await api.listProducts()
if (response.success) {
  const products = response.data
}
```

## 🚀 Edge Functions Disponíveis

### Funções de Leitura
- `list-products` - Lista produtos (opcionalmente por categoria)
- `list-cards` - Lista cartões (filtrado por usuário/role)
- `list-sales` - Lista vendas (com permissões)
- `list-orders` - Lista pedidos
- `list-transactions` - Lista transações
- `get-user-profile` - Obtém perfil do usuário autenticado

### Funções de Escrita
- `make-sale` - Cria uma nova venda
- `update-balance` - Atualiza saldo do cartão (crédito/débito/criar/associar)
- `mark-sale-delivered` - Marca venda como entregue
- `create-product` - Cria produto (admin only)
- `update-product` - Atualiza produto (admin only)
- `delete-product` - Deleta produto (admin only)

### Funções Administrativas
- `manage-users` - Gerencia usuários (buscar por email, atualizar role)
- `manage-products` - Gerencia produtos (CRUD completo)

### Funções Especiais
- `sapatinho-order-` - Cria pedido do Sapatinho Veloz

## 🔐 Permissões e Roles

### Roles Disponíveis
- `admin` - Acesso total
- `lojinha` - Gerencia lojinha (ver vendas, pedidos)
- `lanchonete` - Gerencia lanchonete (ver vendas, pedidos)
- `comunicacao` - Pode criar cartões, ver tudo
- `servico` - Usuário padrão (apenas seus dados)
- `encontrista` - Usuário padrão (apenas seus dados)

### Regras de Acesso

**Histórico Geral:**
- Apenas `admin`, `lojinha`, `lanchonete` podem ver histórico geral
- Usuários normais só veem histórico do próprio cartão

**Cartões:**
- Usuários veem apenas seu próprio cartão
- `admin`, `lojinha`, `lanchonete`, `comunicacao` veem todos

**Produtos:**
- Todos podem ver produtos ativos
- Apenas `admin` pode criar/editar/deletar

**Usuários:**
- Apenas `admin` pode buscar e atualizar roles

## 🌐 Variáveis de Ambiente

### Frontend (.env)
```env
# URL do Supabase (produção)
VITE_SUPABASE_URL=https://seu-project.supabase.co

# Anon Key (apenas para autenticação, seguro com RLS)
VITE_SUPABASE_ANON_KEY=eyJhbGc...

# Service Role Key NUNCA deve estar no frontend!
```

### Edge Functions (Supabase Dashboard → Settings → Edge Functions)
```env
# Origens permitidas (separadas por vírgula)
ALLOWED_ORIGINS=https://seu-dominio.com,https://www.seu-dominio.com

# Credenciais (injetadas automaticamente pelo Supabase)
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=... (NUNCA expor!)
```

## ⚠️ Boas Práticas

### ✅ FAÇA:
1. Use sempre `api-client.ts` para operações de dados
2. Use `auth-client.ts` apenas para autenticação
3. Trate erros adequadamente (verifique `response.success`)
4. Adicione novas funcionalidades como Edge Functions
5. Valide permissões nas Edge Functions

### ❌ NÃO FAÇA:
1. ❌ Importar `supabase` diretamente para queries
2. ❌ Usar `trpc` do frontend em produção
3. ❌ Expor `SERVICE_ROLE_KEY` no frontend
4. ❌ Criar queries diretas ao banco do frontend
5. ❌ Desabilitar RLS sem justificativa
6. ❌ Criar Edge Functions sem autenticação

## 🐛 Debugging

### Ver Logs das Edge Functions
1. Dashboard do Supabase → Logs → Edge Functions
2. Ou via CLI: `supabase functions logs <function-name>`

### Verificar Autenticação
```typescript
// No console do navegador
const { auth } = await import('./src/lib/auth-client')
const { data } = await auth.getSession()
console.log('Session:', data.session)
```

### Verificar Resposta da API
```typescript
// No console do navegador
const { api } = await import('./src/lib/api-client')
const response = await api.listProducts()
console.log('Response:', response)
```

## 📚 Recursos Adicionais

- [Documentação Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Row Level Security (RLS)](https://supabase.com/docs/guides/auth/row-level-security)
- [CORS Configuration](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)

## 🔄 Changelog

### Mudanças Principais
- ✅ Removido `supabase` client direto do frontend
- ✅ Criado `auth-client.ts` para autenticação isolada
- ✅ Criado `api-client.ts` para chamadas REST genéricas
- ✅ Criadas Edge Functions para todas as operações
- ✅ Implementado CORS restrito
- ✅ Autenticação obrigatória em todas as funções
- ✅ Permissões baseadas em roles
- ✅ RLS configurado em todas as tabelas

---

**Última atualização:** Janeiro 2025  
**Mantido por:** Equipe de Desenvolvimento

