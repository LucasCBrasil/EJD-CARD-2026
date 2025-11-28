import React, { createContext, useContext, useEffect, useState } from 'react'
import { auth } from '../lib/auth-client'
import { api } from '../lib/api-client'

interface User {
  id: string
  email: string
  name?: string | null
  role: 'admin' | 'lojinha' | 'lanchonete' | 'comunicacao' | 'servico' | 'encontrista'
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  loginWithGoogle: () => Promise<void>
  register: (email: string, password: string, name: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: React.ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Verificar sessão via Supabase
  useEffect(() => {
    const init = async () => {
      try {
        const { data } = await auth.getSession()
        // Finalizar loading imediatamente
        setIsLoading(false)
        // Não bloquear a UI esperando o carregamento de role
        void handleAuthChange(data.session?.user?.id || null)
      } catch (e) {
        console.error('Auth init error:', e)
        setIsLoading(false)
      }
    }
    void init()

    const { data: sub } = auth.onAuthStateChange(async (_event, session) => {
      try {
        // também não bloquear
        void handleAuthChange(session?.user?.id || null)
      } catch (e) {
        console.error('handleAuthChange error (onAuthStateChange):', e)
      }
    })
    return () => {
      sub.subscription.unsubscribe()
    }
  }, [])

  // ✅ Agora usa Edge Function segura
  const loadUserWithRole = async (userId: string): Promise<User | null> => {
    const { data: authUser } = await auth.getUser()
    if (!authUser.user) return null

    try {
      // Buscar perfil via Edge Function (seguro!)
      const response = await api.getUserProfile()
      
      if (!response.success || !response.data) {
        // Se falhar, retornar usuário básico com role padrão
        return {
          id: authUser.user.id,
          email: authUser.user.email || '',
          name: authUser.user.user_metadata?.name || null,
          role: 'servico',
        }
      }

      return {
        id: response.data.id,
        email: response.data.email || authUser.user.email || '',
        name: response.data.name || authUser.user.user_metadata?.name || null,
        role: (response.data.role as any) || 'servico',
      }
    } catch (error) {
      console.error('Error loading user profile:', error)
      // Em caso de erro, retornar usuário básico
      return {
        id: authUser.user.id,
        email: authUser.user.email || '',
        name: authUser.user.user_metadata?.name || null,
        role: 'servico',
      }
    }
  }

  // ✅ A Edge Function já garante que a linha existe e está atualizada
  const ensureAppUserRow = async (userId: string) => {
    // Apenas chamar a Edge Function que já faz isso automaticamente
    try {
      await api.getUserProfile()
    } catch (error) {
      console.warn('ensureAppUserRow warning:', error)
    }
  }

  const handleAuthChange = async (userId: string | null) => {
    try {
      if (!userId) {
        setUser(null)
        return
      }

      // Definir usuário básico imediatamente
      const { data: authUser } = await auth.getUser()
      if (!authUser.user || authUser.user.id !== userId) {
        setUser(null)
        return
      }
      
      const basicUser = {
        id: authUser.user.id,
        email: authUser.user.email || '',
        name: authUser.user.user_metadata?.name || null,
        role: 'servico' as const,
      }
      
      // Só atualizar se o usuário mudou
      setUser((prev: User | null) => {
        if (prev?.id === userId) {
          return prev // Não precisa atualizar, já temos o mesmo usuário
        }
        return basicUser
      })
      
      // Em segundo plano: garantir linha e carregar role real (não bloquear)
      Promise.all([
        ensureAppUserRow(userId).catch(console.error),
        loadUserWithRole(userId).catch(console.error)
      ]).then(([, u]) => {
        if (u && u.id === userId) {
          setUser((prev: User | null) => {
            // Só atualizar se ainda for o mesmo usuário e algo mudou
            if (prev?.id === userId) {
              // Atualizar nome e role se mudaram
              if (prev.role !== u.role || prev.name !== u.name) {
                return { 
                  ...prev, 
                  role: u.role,
                  name: u.name || prev.name
                }
              }
            }
            return prev
          })
        }
      })
    } catch (e) {
      console.error('handleAuthChange fatal:', e)
      setUser(null)
    }
  }

  const login = async (email: string, password: string) => {
    const cleanEmail = (email || '').trim().toLowerCase()
    const { error } = await auth.signInWithPassword({ email: cleanEmail, password })
    if (error) throw error
    const { data: sessionData } = await auth.getSession()
    const userId = sessionData.session?.user?.id
    if (!userId) return
    await ensureAppUserRow(userId)
    const u = await loadUserWithRole(userId)
    setUser(u)
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
    setUser(null)
    // O redirecionamento será feito automaticamente pelo __root.tsx
  }

  const value: AuthContextType = {
    user,
    isLoading,
    login,
    loginWithGoogle,
    register,
    logout,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
