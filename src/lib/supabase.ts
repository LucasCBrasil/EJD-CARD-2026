import { createClient } from '@supabase/supabase-js'

// Em desenvolvimento, usar Supabase local se disponível
// Em produção, usar a URL do .env
const isDev = import.meta.env.DEV
const supabaseUrl = isDev 
  ? (import.meta.env.VITE_SUPABASE_LOCAL_URL || (import.meta as any).env?.VITE_SUPABASE_URL)
  : (import.meta as any).env?.VITE_SUPABASE_URL

const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase não configurado. Usando modo local.')
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
)

// Verificar se Supabase está configurado
export const isSupabaseConfigured = () => {
  return !!(supabaseUrl && supabaseAnonKey && 
           supabaseUrl !== 'https://placeholder.supabase.co' && 
           supabaseAnonKey !== 'placeholder-key')
}
