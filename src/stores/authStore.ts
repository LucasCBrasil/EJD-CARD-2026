import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface User {
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
  _hasHydrated: boolean
  
  // Constantes
  SESSION_CACHE_TTL: number
  PROFILE_CACHE_TTL: number
  
  // Actions
  setUser: (user: User | null) => void
  setLoading: (loading: boolean) => void
  setInitialized: (initialized: boolean) => void
  setHasHydrated: (hasHydrated: boolean) => void
  
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
      _hasHydrated: false,
      
      // Constantes de TTL
      SESSION_CACHE_TTL: 10000,  // 10 segundos
      PROFILE_CACHE_TTL: 30000,  // 30 segundos
      
      // Actions básicas
      setUser: (user) => {
        console.log('[authStore] setUser:', user?.email)
        set({ user })
      },
      setLoading: (isLoading) => {
        console.log('[authStore] setLoading:', isLoading)
        set({ isLoading })
      },
      setInitialized: (isInitialized) => {
        console.log('[authStore] setInitialized:', isInitialized)
        set({ isInitialized })
      },
      setHasHydrated: (hasHydrated) => set({ _hasHydrated: hasHydrated }),
      
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
      reset: () => {
        console.log('[authStore] reset')
        set({ 
          user: null, 
          isLoading: false, 
          sessionCache: null,
          isInitialized: true 
        })
      },
    }),
    {
      name: 'ejd-auth-storage',
      storage: createJSONStorage(() => sessionStorage), // sessionStorage para segurança
      partialize: (state) => ({ 
        // Persistir apenas user e sessionCache (não loading states)
        user: state.user,
        sessionCache: state.sessionCache,
      }),
      onRehydrateStorage: () => (state) => {
        console.log('[authStore] Hidratado do sessionStorage:', state?.user?.email)
        state?.setHasHydrated(true)
      },
    }
  )
)

// Seletores para performance (evita re-renders)
export const useUser = () => useAuthStore((state) => state.user)
export const useIsLoading = () => useAuthStore((state) => state.isLoading)
export const useIsInitialized = () => useAuthStore((state) => state.isInitialized)
