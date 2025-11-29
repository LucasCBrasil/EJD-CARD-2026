import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { auth } from '../lib/auth-client'
import { api } from '../lib/api-client'
import { useAuthStore, useUser, useIsLoading, type User } from '../stores/authStore'

interface Session {
  access_token: string
  refresh_token?: string
  expires_at?: number
}

interface AuthContextType {
  user: User | null
  session: Session | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  loginWithGoogle: () => Promise<void>
  register: (email: string, password: string, name: string) => Promise<void>
  logout: () => Promise<void>
  getAccessToken: () => Promise<string | null>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Fallback para HMR - evita crash durante hot reload
const authFallback: AuthContextType = {
  user: null,
  session: null,
  isLoading: true,
  login: async () => { throw new Error('AuthProvider not mounted') },
  loginWithGoogle: async () => { throw new Error('AuthProvider not mounted') },
  register: async () => { throw new Error('AuthProvider not mounted') },
  logout: async () => { throw new Error('AuthProvider not mounted') },
  getAccessToken: async () => null,
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  
  // Durante HMR, o contexto pode estar undefined temporariamente
  // Em vez de crashar, retornamos um fallback que mostra loading
  if (context === undefined) {
    if (import.meta.env.DEV) {
      console.warn('[useAuth] Context undefined - likely HMR. Using fallback.')
      return authFallback
    }
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: React.ReactNode
}

/**
 * Carrega perfil completo do usuário via Edge Function
 * Esta função é chamada apenas UMA vez por login/sessão
 */
const loadUserProfile = async (userId: string, authUser: any): Promise<User | null> => {
  try {
    // Buscar perfil via Edge Function (seguro!)
    // A Edge Function já garante que a linha existe e está atualizada
    const response = await api.getUserProfile()
    
    if (!response.success || !response.data) {
      // Se falhar, retornar usuário básico com role padrão
      return {
        id: authUser.id,
        email: authUser.email || '',
        name: authUser.user_metadata?.name || null,
        role: 'encontrista',
      }
    }

    return {
      id: response.data.id,
      email: response.data.email || authUser.email || '',
      name: response.data.name || authUser.user_metadata?.name || null,
      role: (response.data.role as any) || 'encontrista',
    }
  } catch (error) {
    console.error('Error loading user profile:', error)
    // Em caso de erro, retornar usuário básico
    return {
      id: authUser.id,
      email: authUser.email || '',
      name: authUser.user_metadata?.name || null,
      role: 'encontrista',
    }
  }
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const store = useAuthStore()
  const user = useUser()
  const isLoading = useIsLoading()
  const initRef = useRef(false)
  const [session, setSession] = useState<Session | null>(null)

  // Inicialização única - esperar hidratação do Zustand
  useEffect(() => {
    if (initRef.current) return
    
    const init = async () => {
      // Aguardar hidratação do Zustand (máximo 100ms)
      let attempts = 0
      while (!useAuthStore.getState()._hasHydrated && attempts < 10) {
        await new Promise(resolve => setTimeout(resolve, 10))
        attempts++
      }
      
      if (initRef.current) return // Double-check após await
      initRef.current = true
      
      try {
        console.log('[AuthProvider] Iniciando autenticação...')
        store.setLoading(true)
        
        // Sempre verificar sessão do Supabase primeiro (fonte da verdade)
        console.log('[AuthProvider] Chamando auth.getSession()...')
        const { data, error } = await auth.getSession()
        console.log('[AuthProvider] auth.getSession() retornou:', { hasSession: !!data?.session, error })
        
        if (!data.session?.user) {
          // Sem sessão válida - limpar tudo e redirecionar para login
          console.log('[AuthProvider] Sem sessão, resetando...')
          store.reset()
          setSession(null)
          return
        }
        
        // Temos sessão válida - atualizar sessão local
        setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at,
        })
        
        // Verificar se já temos user no store E se é o mesmo usuário
        const currentStoreUser = useAuthStore.getState().user
        if (currentStoreUser && currentStoreUser.id === data.session.user.id) {
          // User já está no store e é o mesmo - usar cache
          console.log('[AuthProvider] Usando user do cache')
          store.setLoading(false)
          store.setInitialized(true)
          return
        }
        
        // Carregar perfil completo (UMA única chamada)
        console.log('[AuthProvider] Carregando perfil do usuário...')
        const userProfile = await loadUserProfile(data.session.user.id, data.session.user)
        store.setUser(userProfile)
        store.setLoading(false)
        store.setInitialized(true)
        console.log('[AuthProvider] Autenticação concluída')
        
      } catch (e) {
        console.error('[AuthProvider] Auth init error:', e)
        store.reset()
        setSession(null)
      }
    }
    
    init()
  }, [])

  // Escutar mudanças de autenticação do Supabase
  // Registrar listener após inicialização para capturar login/logout futuros
  useEffect(() => {
    // Aguardar inicialização antes de registrar listener
    if (!store.isInitialized) {
      console.log('[AuthProvider] Aguardando inicialização para registrar listener...')
      return
    }
    
    console.log('[AuthProvider] Registrando onAuthStateChange listener')
    const { data: sub } = auth.onAuthStateChange(async (_event, supaSession) => {
      // Ignorar evento INITIAL_SESSION - já tratamos na inicialização
      if (_event === 'INITIAL_SESSION') {
        console.log('[AuthProvider] Ignorando INITIAL_SESSION (já tratado)')
        return
      }
      
      console.log('[AuthProvider] onAuthStateChange disparado:', _event)
      try {
        const store = useAuthStore.getState()
        
        if (supaSession) {
          // Atualizar sessão
          setSession({
            access_token: supaSession.access_token,
            refresh_token: supaSession.refresh_token,
            expires_at: supaSession.expires_at,
          })
          
          // Atualizar cache
          store.setCachedSession(supaSession)
          
          // Se o usuário mudou ou não temos user no store, carregar perfil
          if (!store.user || store.user.id !== supaSession.user.id) {
            const userProfile = await loadUserProfile(supaSession.user.id, supaSession.user)
            store.setUser(userProfile)
          }
        } else {
          // Logout
          store.reset()
          setSession(null)
        }
      } catch (e) {
        console.error('handleAuthChange error (onAuthStateChange):', e)
      }
    })
    
    return () => {
      sub.subscription.unsubscribe()
    }
  }, [store.isInitialized])

  const login = async (email: string, password: string) => {
    const cleanEmail = (email || '').trim().toLowerCase()
    const { error } = await auth.signInWithPassword({ email: cleanEmail, password })
    if (error) throw error
    
    const { data: sessionData } = await auth.getSession()
    const userId = sessionData.session?.user?.id
    if (!userId) return
    
    // Carregar perfil completo (UMA única chamada)
    const userProfile = await loadUserProfile(userId, sessionData.session.user)
    store.setUser(userProfile)
    
    // Atualizar sessão
    if (sessionData.session) {
      setSession({
        access_token: sessionData.session.access_token,
        refresh_token: sessionData.session.refresh_token,
        expires_at: sessionData.session.expires_at,
      })
    }
  }

  const register = async (email: string, password: string, name: string) => {
    const cleanEmail = (email || '').trim().toLowerCase()
    const { error } = await auth.signUp({
      email: cleanEmail,
      password,
      options: { data: { name } }
    })
    if (error) {
      const anyErr: any = error
      if (anyErr?.code === 'user_already_exists' || anyErr?.message === 'User already registered') {
        throw new Error('Email já cadastrado')
      }
      throw new Error(anyErr?.message || 'Erro no cadastro')
    }
  }

  const loginWithGoogle = async () => {
    const { error } = await auth.signInWithGoogle()
    if (error) throw error
    // O redirecionamento será feito automaticamente pelo Supabase após o OAuth
  }

  const logout = async () => {
    await auth.signOut()
    // auth.signOut() já chama store.reset() internamente
    setSession(null)
    // O redirecionamento será feito automaticamente pelo __root.tsx
  }

  // Função para obter token de acesso atualizado
  const getAccessToken = async (): Promise<string | null> => {
    try {
      const { data } = await auth.getSession()
      return data.session?.access_token || null
    } catch {
      return null
    }
  }

  const value: AuthContextType = {
    user,
    session,
    isLoading,
    login,
    loginWithGoogle,
    register,
    logout,
    getAccessToken,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
