/**
 * Utilitários de autenticação para Edge Functions
 * Valida JWT tokens e extrai informações do usuário
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { type UserRole, hasPermission } from './roles.ts'

export interface AuthUser {
  id: string
  email?: string
  role?: UserRole
}

/**
 * Extrair e validar token JWT da requisição
 * Retorna o usuário autenticado ou null
 */
export const getAuthUser = async (req: Request): Promise<AuthUser | null> => {
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return null
    }

    const token = authHeader.replace('Bearer ', '')
    if (!token) {
      return null
    }

    // Criar cliente temporário para validar o token
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Missing Supabase credentials:', {
        hasUrl: !!supabaseUrl,
        hasAnonKey: !!supabaseAnonKey,
        urlLength: supabaseUrl?.length || 0,
        anonKeyLength: supabaseAnonKey?.length || 0
      })
      throw new Error('Missing Supabase credentials')
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    // Validar token e obter usuário
    const { data: { user }, error } = await supabase.auth.getUser(token)

    if (error || !user) {
      console.error('Auth error:', error)
      return null
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role
    }
  } catch (error) {
    console.error('Error validating auth:', error)
    return null
  }
}

/**
 * Buscar role do usuário no banco de dados
 */
export const getUserRole = async (userId: string): Promise<UserRole> => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials')
    return 'servico'
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  
  const { data: appUser } = await supabase
    .from('app_users')
    .select('role')
    .eq('id', userId)
    .single()

  return (appUser?.role as UserRole) || 'encontrista'
}

/**
 * Verificar se usuário tem permissão específica
 * Usa o sistema de roles existente do frontend!
 */
export const checkPermission = async (req: Request, permission: 'canAddBalance' | 'canManageProductsLojinha' | 'canManageProductsLanchonete'): Promise<boolean> => {
  const user = await getAuthUser(req)
  if (!user) return false

  const userRole = await getUserRole(user.id)
  return hasPermission(userRole, permission)
}

/**
 * Verificar se pode adicionar saldo
 * Roles permitidos: admin, genios_card, comunicacao
 */
export const canAddBalance = async (req: Request): Promise<boolean> => {
  return await checkPermission(req, 'canAddBalance')
}

/**
 * Verificar se usuário é admin
 */
export const isAdmin = async (req: Request): Promise<boolean> => {
  const user = await getAuthUser(req)
  if (!user) return false
  
  const userRole = await getUserRole(user.id)
  return userRole === 'admin'
}

/**
 * Middleware para validar autenticação
 * Retorna erro se não autenticado
 */
export const requireAuth = async (req: Request): Promise<AuthUser | Response> => {
  const user = await getAuthUser(req)
  
  if (!user) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Unauthorized: Authentication required' 
      }),
      { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }

  return user
}

