# 📋 Plano de Refatoração: Otimização de Requisições e Cache Client-Side

> **Data:** 2025-11-29  
> **Status:** Planejado  
> **Prioridade:** Alta

---

## 📦 Dependências a Instalar

```bash
npm install zustand
```

**Por que Zustand?**
- Leve (~1KB) e sem boilerplate
- Integração nativa com React (sem providers obrigatórios)
- Suporte a persistência (localStorage/sessionStorage)
- DevTools para debug
- Tipagem TypeScript excelente
- Evita prop drilling e re-renders desnecessários

---

## 🔍 Diagnóstico do Problema

### Requisições Observadas no Refresh (usuário logado)

```
user                    200    1.2 kB    203 ms
user                    200    1.2 kB    235 ms
list-cards              200   15.8 kB    702 ms
user                    200    1.2 kB    217 ms
user                    200    1.2 kB    211 ms
list-products?lanchonete 200   2.0 kB    551 ms
user                    200    1.2 kB    224 ms
get-user-profile        200    0.8 kB    509 ms
list-products?lojinha   200    1.9 kB    495 ms
get-user-profile        200    0.8 kB   1.00 s
user                    200    1.2 kB    210 ms
get-user-profile        200    0.8 kB   1.72 s
get-user-profile        200    0.8 kB   2.17 s
list-cards?userId=...   200    1.0 kB    585 ms
get-user-profile        200    0.8 kB   2.68 s
get-user-profile        200    0.8 kB   3.16 s
```

### Resumo das Duplicações

| Endpoint | Chamadas | Tempo Total Aprox. |
|----------|----------|-------------------|
| `user` (Supabase Auth) | **7x** | ~1.5s |
| `get-user-profile` | **6x** | ~11s acumulado |
| `list-cards` | 2x | ~1.3s |
| `list-products` | 2x | ~1s |

### Problemas Adicionais

1. **Flash da tela de login** no refresh - usuário vê login antes de verificar sessão
2. **Latência acumulada** - requisições em cascata ao invés de paralelas

---

## 🎯 Causa Raiz

### 1. Chamadas `user` duplicadas

| Fonte | Arquivo | Linha |
|-------|---------|-------|
| `beforeLoad` | `_layout.tsx` | L8-17 |
| `init()` | `AuthContext.tsx` | L41-51 |
| `onAuthStateChange` | `AuthContext.tsx` | L55-62 |
| `getAuthToken()` em cada request | `api-client.ts` | L28-36 |

### 2. Chamadas `get-user-profile` duplicadas

| Fonte | Arquivo | Motivo |
|-------|---------|--------|
| `ensureAppUserRow()` | `AuthContext.tsx` | Chama `api.getUserProfile()` |
| `loadUserWithRole()` | `AuthContext.tsx` | Chama `api.getUserProfile()` separadamente |
| `Promise.all()` | `AuthContext.tsx` | Executa ambas em paralelo = 2x |
| `onAuthStateChange` | `AuthContext.tsx` | Dispara tudo novamente |

### 3. Chamadas `list-cards` e `list-products` duplicadas

| Fonte | Arquivo |
|-------|---------|
| `loadData()` | `SupabaseDataContext.tsx` |
| `useCards()` / `useProducts()` hooks | Páginas que usam |
| `useCardByUserId()` | `HomePage.tsx` |

### 4. Flash de Login

```typescript
// AuthContext.tsx - PROBLEMA
const init = async () => {
  const { data } = await auth.getSession()
  setIsLoading(false)  // ❌ Termina loading ANTES de popular user
  void handleAuthChange(...)  // User é populado DEPOIS
}
```

---

## 🛠️ Plano de Implementação (Client-Side)

### Fase 0: Criar Store Zustand para Autenticação

**Objetivo:** Centralizar estado de auth com cache seguro e persistência

**Novo arquivo:** `src/stores/authStore.ts`

```typescript
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface User {
  id: string
  email: string
  name?: string | null
  role: 'admin' | 'lojinha' | 'lanchonete' | 'comunicacao' | 'servico' | 'encontrista'
}

interface SessionCache {
  session: any
  timestamp: number
}

interface AuthState {
  // Estado
  user: User | null
  isLoading: boolean
  isInitialized: boolean
  sessionCache: SessionCache | null
  
  // Constantes
  SESSION_CACHE_TTL: number
  PROFILE_CACHE_TTL: number
  
  // Actions
  setUser: (user: User | null) => void
  setLoading: (loading: boolean) => void
  setInitialized: (initialized: boolean) => void
  
  // Cache de sessão
  getCachedSession: () => SessionCache | null
  setCachedSession: (session: any) => void
  invalidateSession: () => void
  isSessionValid: () => boolean
  
  // Reset completo (logout)
  reset: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Estado inicial
      user: null,
      isLoading: true,
      isInitialized: false,
      sessionCache: null,
      
      // Constantes de TTL
      SESSION_CACHE_TTL: 10000,  // 10 segundos
      PROFILE_CACHE_TTL: 30000,  // 30 segundos
      
      // Actions básicas
      setUser: (user) => set({ user }),
      setLoading: (isLoading) => set({ isLoading }),
      setInitialized: (isInitialized) => set({ isInitialized }),
      
      // Cache de sessão
      getCachedSession: () => {
        const { sessionCache, SESSION_CACHE_TTL } = get()
        if (sessionCache && Date.now() - sessionCache.timestamp < SESSION_CACHE_TTL) {
          return sessionCache
        }
        return null
      },
      
      setCachedSession: (session) => set({ 
        sessionCache: { session, timestamp: Date.now() } 
      }),
      
      invalidateSession: () => set({ sessionCache: null }),
      
      isSessionValid: () => {
        const { sessionCache, SESSION_CACHE_TTL } = get()
        return !!(sessionCache && Date.now() - sessionCache.timestamp < SESSION_CACHE_TTL)
      },
      
      // Reset completo
      reset: () => set({ 
        user: null, 
        isLoading: false, 
        sessionCache: null,
        isInitialized: true 
      }),
    }),
    {
      name: 'ejd-auth-storage',
      storage: createJSONStorage(() => sessionStorage), // sessionStorage para segurança
      partialize: (state) => ({ 
        // Persistir apenas user e sessionCache (não loading states)
        user: state.user,
        sessionCache: state.sessionCache,
      }),
    }
  )
)

// Seletores para performance (evita re-renders)
export const useUser = () => useAuthStore((state) => state.user)
export const useIsLoading = () => useAuthStore((state) => state.isLoading)
export const useIsInitialized = () => useAuthStore((state) => state.isInitialized)
```

**Benefícios do Zustand:**
- Estado centralizado e previsível
- Persistência automática em `sessionStorage` (mais seguro que localStorage)
- Seletores para evitar re-renders desnecessários
- Fácil de testar e debuggar
- Funciona fora de componentes React (em `auth-client.ts`)

---

### Fase 1: Integrar Zustand no `auth-client.ts`

**Objetivo:** Usar store Zustand ao invés de variáveis globais

**Arquivo:** `src/lib/auth-client.ts`

```typescript
import { useAuthStore } from '../stores/authStore'

// Acessar store fora de componentes React
const getAuthStore = () => useAuthStore.getState()

export const auth = {
  getSession: async () => {
    const store = getAuthStore()
    
    // 1. Verificar cache no Zustand
    const cachedSession = store.getCachedSession()
    if (cachedSession) {
      return { data: { session: cachedSession.session }, error: null }
    }
    
    // 2. Fazer requisição e salvar no store
    const result = await client.auth.getSession()
    store.setCachedSession(result.data.session)
    return result
  },
  
  signOut: async () => {
    const store = getAuthStore()
    store.reset() // Limpa tudo no logout
    return client.auth.signOut()
  }
}
```

**Impacto:** Reduz chamadas `user` de 7 para ~1-2

---

### Fase 2: Refatorar `AuthContext.tsx` com Zustand

**Objetivo:** Simplificar AuthContext usando Zustand como fonte da verdade

**Arquivo:** `src/contexts/AuthContext.tsx`

```typescript
import { useAuthStore, useUser, useIsLoading } from '../stores/authStore'

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const store = useAuthStore()
  const initRef = useRef(false)
  
  // Inicialização única
  useEffect(() => {
    if (initRef.current || store.isInitialized) return
    initRef.current = true
    
    const init = async () => {
      try {
        // Verificar se já temos user no store (persistido)
        if (store.user) {
          store.setLoading(false)
          store.setInitialized(true)
          return
        }
        
        const { data } = await auth.getSession()
        
        if (!data.session?.user) {
          store.reset()
          return
        }
        
        // Carregar perfil completo
        const userProfile = await loadUserProfile(data.session.user.id, data.session.user)
        store.setUser(userProfile)
        store.setLoading(false)
        store.setInitialized(true)
        
      } catch (e) {
        console.error('Auth init error:', e)
        store.reset()
      }
    }
    
    init()
  }, [])
  
  // ... resto do provider
}

// Hook simplificado
export const useAuth = () => {
  const user = useUser()
  const isLoading = useIsLoading()
  const store = useAuthStore()
  
  return {
    user,
    isLoading,
    login: store.login,
    logout: store.reset,
    // ...
  }
}
```

**Impacto:** 
- Reduz `get-user-profile` de 6 para 1
- Elimina flash de login (user pode estar persistido)
- Código mais limpo e testável

---

### Fase 3: Otimizar Hooks com React Query

**Objetivo:** Configurar cache inteligente nos hooks

#### `src/hooks/useProducts.ts`

```typescript
// ANTES
export function useProducts(category?: ProductCategory) {
  return useQuery({
    queryKey: productKeys.list(category),
    queryFn: ...,
    refetchOnMount: 'always', // ❌ Sempre refaz
  })
}

// DEPOIS
export function useProducts(category?: ProductCategory) {
  return useQuery({
    queryKey: productKeys.list(category),
    queryFn: ...,
    staleTime: 1000 * 60 * 2, // 2 minutos - dados frescos
    refetchOnMount: false,    // Não refaz se cache válido
  })
}
```

#### `src/hooks/useCards.ts`

```typescript
// ANTES
export function useCardByUserId(userId: string, enabled = true) {
  return useQuery({
    ...
    refetchOnMount: true,         // ❌
    refetchOnWindowFocus: true,   // ❌
  })
}

// DEPOIS
export function useCardByUserId(userId: string, enabled = true) {
  return useQuery({
    ...
    staleTime: 1000 * 60 * 2,     // 2 minutos
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  })
}
```

**Impacto:** Reduz chamadas `list-cards` e `list-products` pela metade

---

### Fase 4: Simplificar `SupabaseDataContext.tsx`

**Objetivo:** Remover carregamento duplicado no mount

**Arquivo:** `src/contexts/SupabaseDataContext.tsx`

**Mudanças:**
- Remover `api.listCards()` do `loadData()`
- Remover `api.listProducts()` do `loadData()`
- Manter contexto apenas para **operações** (create, update, delete)
- Delegar **leitura** aos hooks com React Query

```typescript
// ANTES
const loadData = async () => {
  const cardsResponse = await api.listCards()        // ❌ Duplicado
  const lojinhaResponse = await api.listProducts('lojinha')    // ❌ Duplicado
  const lanchoneteResponse = await api.listProducts('lanchonete') // ❌ Duplicado
  // ...
}

// DEPOIS
const loadData = async () => {
  // Apenas inicializar estrutura - dados carregados pelos hooks quando necessário
  setData({
    balances: new Map(),
    products: { lojinha: [], lanchonete: [] },
    sales: [],
    orders: [],
    cards: [],
    coupons: []
  })
  setIsLoading(false)
}
```

**Impacto:** Elimina carregamento duplicado no mount

---

### Fase 5 (Opcional): Otimizar `_layout.tsx`

**Objetivo:** Evitar `getSession()` redundante

**Opção A:** Remover verificação (já feita no `__root.tsx`)

```typescript
// ANTES
beforeLoad: async () => {
  const { data: { session } } = await auth.getSession() // Duplicado
  if (!session) throw redirect({ to: '/login' })
}

// DEPOIS - confiar no cache do auth-client
// O cache implementado na Fase 1 resolve isso automaticamente
```

---

## 📊 Resultado Esperado

| Métrica | Antes | Depois |
|---------|-------|--------|
| Chamadas `user` | 7 | 1-2 |
| Chamadas `get-user-profile` | 6 | 1 (ou 0 se cache válido) |
| Chamadas `list-cards` | 2 | 1 |
| Chamadas `list-products` | 2+ | 1 por categoria |
| Flash de login | Sim | **Não** |
| Tempo de carregamento inicial | ~3s+ | **~200-500ms** |
| Persistência entre refreshes | Não | **Sim (sessionStorage)** |
| Estado previsível/debuggável | Não | **Sim (Zustand DevTools)** |

---

## ⚠️ Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| Cache desatualizado | TTL curto (10-30s) + invalidação em login/logout |
| Dados inconsistentes após mutations | `queryClient.invalidateQueries()` + `store.invalidateSession()` |
| Regressões | Testar fluxos de login/logout/refresh |
| sessionStorage cheio | Persistir apenas dados essenciais (user, timestamp) |
| User desatualizado após mudança de role | TTL de 30s + revalidação em rotas protegidas |

---

## 🛠️ Debug com Zustand DevTools

Para debugar o estado em desenvolvimento, adicione ao `authStore.ts`:

```typescript
import { devtools } from 'zustand/middleware'

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set, get) => ({
        // ... estado
      }),
      { name: 'ejd-auth-storage' }
    ),
    { name: 'AuthStore' } // Nome no Redux DevTools
  )
)
```

Instale a extensão [Redux DevTools](https://chrome.google.com/webstore/detail/redux-devtools) no Chrome para visualizar:
- Estado atual
- Histórico de ações
- Time-travel debugging

---

## 📝 Checklist de Implementação

- [ ] **Fase 0:** Instalar Zustand (`npm install zustand`)
- [ ] **Fase 0:** Criar `src/stores/authStore.ts`
- [ ] **Fase 1:** Integrar Zustand no `auth-client.ts`
- [ ] **Fase 2:** Refatorar `AuthContext.tsx` com Zustand
- [ ] **Fase 3:** Otimizar `useProducts.ts`
- [ ] **Fase 3:** Otimizar `useCards.ts`
- [ ] **Fase 4:** Simplificar `SupabaseDataContext.tsx`
- [ ] **Fase 5:** Otimizar `_layout.tsx` (opcional)
- [ ] **Teste:** Login/logout funciona corretamente
- [ ] **Teste:** Refresh não mostra flash de login
- [ ] **Teste:** Dados atualizam após mutations
- [ ] **Teste:** Persistência funciona (fechar/abrir aba)

---

## 📁 Arquivos Afetados

```
src/
├── stores/
│   └── authStore.ts            # Fase 0 (NOVO)
├── lib/
│   └── auth-client.ts          # Fase 1
├── contexts/
│   ├── AuthContext.tsx         # Fase 2
│   └── SupabaseDataContext.tsx # Fase 4
├── hooks/
│   ├── useCards.ts             # Fase 3
│   └── useProducts.ts          # Fase 3
└── routes/
    └── _layout.tsx             # Fase 5 (opcional)
```

---

## 🔄 Fluxo com Zustand

```
┌─────────────────────────────────────────────────────────────────┐
│                        REFRESH/LOAD                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. App inicia                                                  │
│     │                                                           │
│     ▼                                                           │
│  2. Zustand carrega estado do sessionStorage                    │
│     │                                                           │
│     ├── Se tem user válido → Mostra app (sem flash!)            │
│     │                                                           │
│     └── Se não tem user → Continua...                           │
│         │                                                       │
│         ▼                                                       │
│  3. auth.getSession()                                           │
│     │                                                           │
│     ├── Cache hit (Zustand) → Retorna cache                     │
│     │                                                           │
│     └── Cache miss → Faz requisição → Salva no Zustand          │
│         │                                                       │
│         ▼                                                       │
│  4. Se tem sessão válida:                                       │
│     │                                                           │
│     ▼                                                           │
│  5. loadUserProfile() (1 única chamada)                         │
│     │                                                           │
│     ▼                                                           │
│  6. Salva user no Zustand → Mostra app                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                          LOGOUT                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Usuário clica em "Sair"                                     │
│     │                                                           │
│     ▼                                                           │
│  2. store.reset() → Limpa user + sessionCache + sessionStorage  │
│     │                                                           │
│     ▼                                                           │
│  3. auth.signOut() → Limpa sessão no Supabase                   │
│     │                                                           │
│     ▼                                                           │
│  4. Redirect para /login                                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔐 Considerações de Segurança

### Por que `sessionStorage` ao invés de `localStorage`?

| Aspecto | sessionStorage | localStorage |
|---------|---------------|--------------|
| Persistência | Apenas na aba atual | Entre abas e fechamentos |
| Segurança | Mais seguro (limpa ao fechar) | Menos seguro (persiste) |
| XSS | Menor superfície de ataque | Maior risco |
| Uso recomendado | Dados de sessão | Preferências do usuário |

### O que NÃO persistir:
- Tokens de acesso (gerenciados pelo Supabase)
- Dados sensíveis não necessários
- Estados de loading

### O que persistir:
- `user` (id, email, name, role) - para evitar flash
- `sessionCache.timestamp` - para validar TTL

