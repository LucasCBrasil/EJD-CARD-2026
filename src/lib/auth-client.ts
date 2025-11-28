/**
 * Cliente de Autenticação - Frontend
 * 
 * Apenas para autenticação (login/logout/session)
 * NÃO expõe cliente Supabase para queries de dados
 */

import { createClient } from '@supabase/supabase-js'

// Variáveis privadas - não exportadas
const isDev = import.meta.env.DEV
const supabaseUrl = isDev 
  ? (import.meta.env.VITE_SUPABASE_LOCAL_URL || (import.meta as any).env?.VITE_SUPABASE_URL)
  : (import.meta as any).env?.VITE_SUPABASE_URL

const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY

// Cliente privado - apenas para auth
let _authClient: any = null

function getAuthClient() {
  if (_authClient) return _authClient
  
  if (!supabaseUrl || !supabaseAnonKey) {
    // Retornar cliente mock para permitir renderização da UI
    return {
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
        getUser: async () => ({ data: { user: null }, error: null }),
        signInWithPassword: async () => ({ data: null, error: new Error('Supabase não configurado') }),
        signInWithOAuth: async () => ({ data: null, error: new Error('Supabase não configurado') }),
        signUp: async () => ({ data: null, error: new Error('Supabase não configurado') }),
        signOut: async () => ({ error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      }
    }
  }
  
  _authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  })

  return _authClient
}

// API pública apenas para autenticação
export const auth = {
  getSession: async () => {
    const client = getAuthClient()
    return client.auth.getSession()
  },
  
  getUser: async () => {
    const client = getAuthClient()
    return client.auth.getUser()
  },
  
  signInWithPassword: async (credentials: { email: string; password: string }) => {
    const client = getAuthClient()
    return client.auth.signInWithPassword(credentials)
  },
  
  signUp: async (credentials: { email: string; password: string; options?: any }) => {
    const client = getAuthClient()
    return client.auth.signUp(credentials)
  },
  
  signInWithGoogle: async () => {
    const client = getAuthClient()
    // Em produção, sempre redireciona para o domínio principal
    const redirectUrl = isDev 
      ? window.location.origin 
      : 'https://www.ejdcard.com.br'
    return client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
      }
    })
  },
  
  signOut: async () => {
    const client = getAuthClient()
    return client.auth.signOut()
  },
  
  onAuthStateChange: (callback: (event: any, session: any) => void) => {
    const client = getAuthClient()
    return client.auth.onAuthStateChange(callback)
  },
}

export const isSupabaseConfigured = () => {
  return !!(supabaseUrl && supabaseAnonKey && 
           supabaseUrl !== 'https://placeholder.supabase.co' && 
           supabaseAnonKey !== 'placeholder-key')
}

