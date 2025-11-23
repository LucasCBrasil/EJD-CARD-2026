import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

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
        const { data } = await supabase.auth.getSession()
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

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
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

  const loadUserWithRole = async (userId: string): Promise<User | null> => {
    const { data: authUser } = await supabase.auth.getUser()
    if (!authUser.user) return null

    const { data: profile } = await supabase
      .from('app_users')
      .select('role')
      .eq('id', userId)
      .maybeSingle()

    return {
      id: authUser.user.id,
      email: authUser.user.email || '',
      name: authUser.user.user_metadata?.name || null,
      role: (profile?.role as any) || 'encontrista',
    }
  }

  const ensureAppUserRow = async (userId: string) => {
    // Verificar se linha já existe
    const { data: existing } = await supabase
      .from('app_users')
      .select('id, email, name, role')
      .eq('id', userId)
      .maybeSingle()

    // Se já existe e tem email/name preenchidos, não fazer nada
    if (existing && existing.email && existing.name) {
      return // Linha já existe e está completa, não precisa atualizar
    }

    // Só buscar dados de auth.users se precisar preencher email/name
    const { data: authUser } = await supabase.auth.getUser()
    if (!authUser.user) return

    const email = authUser.user.email || ''
    const name = authUser.user.user_metadata?.name || null

    // Criar ou atualizar apenas se não existir ou se faltar email/name
    if (!existing) {
      // Criar nova linha
      const { error } = await supabase
        .from('app_users')
        .insert({ 
          id: userId, 
          role: 'encontrista',
          email: email,
          name: name
        })
      if (error) {
        console.warn('ensureAppUserRow insert warning:', error.message)
      }
    } else if (!existing.email || !existing.name) {
      // Atualizar apenas email/name se estiverem vazios (preservar role)
      const updates: any = {}
      if (!existing.email) updates.email = email
      if (!existing.name) updates.name = name

      const { error } = await supabase
        .from('app_users')
        .update(updates)
        .eq('id', userId)
      if (error) {
        console.warn('ensureAppUserRow update warning:', error.message)
      }
    }
  }

  const handleAuthChange = async (userId: string | null) => {
    try {
      if (!userId) {
        setUser(null)
        return
      }

      // Definir usuário básico imediatamente
      const { data: authUser } = await supabase.auth.getUser()
      if (!authUser.user || authUser.user.id !== userId) {
        setUser(null)
        return
      }
      
      const basicUser = {
        id: authUser.user.id,
        email: authUser.user.email || '',
        name: authUser.user.user_metadata?.name || null,
        role: 'encontrista' as const,
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
            // Só atualizar se ainda for o mesmo usuário e o role mudou
            if (prev?.id === userId && prev.role !== u.role) {
              return { ...prev, role: u.role }
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
    const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password })
    if (error) throw error
    const { data: sessionData } = await supabase.auth.getSession()
    const userId = sessionData.session?.user?.id
    if (!userId) return
    await ensureAppUserRow(userId)
    const u = await loadUserWithRole(userId)
    setUser(u)
  }

  const register = async (email: string, password: string, name: string) => {
    const cleanEmail = (email || '').trim().toLowerCase()
    const { error } = await supabase.auth.signUp({
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

  const logout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    window.location.href = '/'
  }

  const value: AuthContextType = {
    user,
    isLoading,
    login,
    register,
    logout,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
