/**
 * ⚠️ DEPRECATED - Não use mais este arquivo diretamente
 * 
 * Para autenticação, use: import { auth } from './auth-client'
 * Para queries de dados, use: import { api } from './api-client'
 * 
 * Este arquivo mantém compatibilidade temporária mas será removido.
 */

// Re-exportar apenas funções de auth para compatibilidade
export { auth, isSupabaseConfigured } from './auth-client'

// Cliente Supabase NÃO EXPORTADO mais - previne queries diretas
// Todas as operações devem passar por Edge Functions via api-client
const _supabaseExport = {
  // @ts-ignore - apenas para compatibilidade durante migração
  auth: undefined,
  // @ts-ignore
  from: () => {
    throw new Error('⚠️ Chamadas diretas ao Supabase foram desabilitadas por segurança. Use api-client.ts em vez disso.')
  },
  // @ts-ignore
  functions: {
    invoke: () => {
      throw new Error('⚠️ Use api-client.ts para chamar Edge Functions')
    }
  }
}

// @ts-ignore
export const supabase = _supabaseExport
