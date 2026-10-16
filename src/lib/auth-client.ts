/**
 * Cliente de Autenticação - Frontend
 * 
 * Apenas para autenticação (login/logout/session)
 * NÃO expõe cliente Supabase para queries de dados
 */

import { createClient } from '@supabase/supabase-js'
import { useAuthStore } from '../stores/authStore'

// Acessar store fora de componentes React
const getAuthStore = () => useAuthStore.getState()

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
  
  console.log('[auth-client] Criando cliente Supabase...', { supabaseUrl, hasAnonKey: !!supabaseAnonKey })
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[auth-client] Supabase não configurado, usando mock')
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
  
  console.log('[auth-client] Cliente Supabase criado')

  return _authClient
}

// Flag para evitar chamadas concorrentes
let _getSessionPromise: Promise<any> | null = null

// API pública apenas para autenticação
export const auth = {
  getSession: async () => {
    console.log('[auth-client] getSession chamado')
    
    // 1. Se já há uma requisição em andamento, aguardar ela
    if (_getSessionPromise) {
      console.log('[auth-client] Aguardando requisição em andamento...')
      return _getSessionPromise
    }
    
    // 2. Verificar cache no Zustand (apenas se store já foi inicializado)
    try {
      const store = getAuthStore()
      const cachedSession = store.getCachedSession()
      if (cachedSession) {
        console.log('[auth-client] Retornando sessão do cache')
        return { data: { session: cachedSession.session }, error: null }
      }
    } catch (e) {
      console.warn('[auth-client] Erro ao acessar cache:', e)
    }
    
    // 3. Fazer requisição e salvar no store
    console.log('[auth-client] Buscando sessão do Supabase...')
    const client = getAuthClient()
    
    // Timeout de 10 segundos para não travar para sempre
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout ao buscar sessão')), 10000)
    )
    
    _getSessionPromise = client.auth.getSession()
    
    try {
      const result = await Promise.race([_getSessionPromise, timeoutPromise]) as any
      console.log('[auth-client] Supabase retornou:', { hasSession: !!result.data?.session, error: result.error })
      
      // Salvar no cache
      if (result.data?.session) {
        try {
          const store = getAuthStore()
          store.setCachedSession(result.data.session)
        } catch (e) {
          console.warn('[auth-client] Erro ao salvar cache:', e)
        }
      }
      
      return result
    } catch (e) {
      console.error('[auth-client] Erro ao buscar sessão:', e)
      return { data: { session: null }, error: e }
    } finally {
      _getSessionPromise = null
    }
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
      : 'https://ejd-card-2026.vercel.app'
    return client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
      }
    })
  },
  
  signOut: async () => {
    const store = getAuthStore()
    store.reset() // Limpa tudo no logout
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

