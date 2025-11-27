/**
 * Edge Function: manage-users
 * 
 * Gerencia usuários (apenas admin pode usar):
 * - Buscar usuários por email
 * - Atualizar role de usuário
 * 
 * Este código roda NA NUVEM, inacessível via DevTools!
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireAuth, getUserRole, isAdmin } from '../_shared/auth.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import type { ApiResponse } from '../_shared/types.ts'

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authResult = await requireAuth(req)
    if (authResult instanceof Response) {
      return authResult
    }
    const user = authResult

    // Apenas admin pode gerenciar usuários
    const userIsAdmin = await isAdmin(req)
    if (!userIsAdmin) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Acesso negado: apenas administradores podem gerenciar usuários'
        } as ApiResponse),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Criar cliente Supabase com SERVICE_ROLE_KEY para operações privilegiadas
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase credentials')
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    if (req.method === 'GET') {
      // Buscar usuários por email
      const url = new URL(req.url)
      const email = url.searchParams.get('email')

      if (!email) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Parâmetro "email" é obrigatório'
          } as ApiResponse),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const { data: users, error } = await supabase
        .from('app_users')
        .select('id, email, name, role, created_at')
        .ilike('email', `%${email}%`)
        .order('email', { ascending: true })
        .limit(50)

      if (error) {
        console.error('Error fetching users:', error)
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Erro ao buscar usuários.'
          } as ApiResponse),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({
          success: true,
          data: users || []
        } as ApiResponse),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (req.method === 'PUT') {
      // Atualizar role de usuário
      const { userId, role } = await req.json()

      if (!userId || !role) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'userId e role são obrigatórios'
          } as ApiResponse),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Validar role
      const validRoles = ['admin', 'lojinha', 'lanchonete', 'comunicacao', 'servico', 'encontrista']
      if (!validRoles.includes(role)) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Role inválido'
          } as ApiResponse),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Não permitir alterar próprio role
      if (userId === user.id) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Você não pode alterar seu próprio role'
          } as ApiResponse),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const { error: updateError } = await supabase
        .from('app_users')
        .update({ role })
        .eq('id', userId)

      if (updateError) {
        console.error('Error updating user role:', updateError)
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Erro ao atualizar role do usuário.'
          } as ApiResponse),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({
          success: true,
          data: { userId, role }
        } as ApiResponse),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Método não permitido'
      } as ApiResponse),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Unhandled error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erro interno do servidor.'
      } as ApiResponse),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

