/**
 * Edge Function: get-user-profile
 * 
 * Retorna perfil do usuário autenticado (apenas dados próprios)
 * 
 * Este código roda NA NUVEM, inacessível via DevTools!
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createSupabaseClient } from '../_shared/supabase.ts'
import { requireAuth } from '../_shared/auth.ts'
import type { ApiResponse } from '../_shared/types.ts'
import { getCorsHeaders } from '../_shared/cors.ts'

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

    if (req.method !== 'GET') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Método não permitido'
        } as ApiResponse),
        {
          status: 405,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const supabase = createSupabaseClient()

    // Buscar perfil do usuário (apenas próprio perfil)
    const { data: profile, error } = await supabase
      .from('app_users')
      .select('id, email, name, role')
      .eq('id', user.id)
      .maybeSingle()

    if (error) {
      console.error('Error fetching user profile:', error)
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Erro ao buscar perfil do usuário.'
        } as ApiResponse),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Se não existe, criar com role padrão
    if (!profile) {
      // Buscar dados do auth.users usando o token
      const supabaseUrl = Deno.env.get('SUPABASE_URL')
      const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
      const authHeader = req.headers.get('Authorization')
      const token = authHeader?.replace('Bearer ', '')
      
      let email = ''
      let name: string | null = null
      
      if (supabaseUrl && supabaseAnonKey && token) {
        const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey)
        const { data: authUser } = await supabaseAnon.auth.getUser(token)
        email = authUser?.user?.email || ''
        name = authUser?.user?.user_metadata?.name || null
      }
      
      const defaultProfile = {
        id: user.id,
        email: email,
        name: name,
        role: 'encontrista' as const
      }

      const { error: insertError } = await supabase
        .from('app_users')
        .insert(defaultProfile)

      if (insertError) {
        console.warn('Could not create user profile:', insertError)
        // Retornar perfil padrão mesmo se não conseguir criar
        return new Response(
          JSON.stringify({
            success: true,
            data: defaultProfile
          } as ApiResponse),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({
          success: true,
          data: defaultProfile
        } as ApiResponse),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Atualizar email/name se estiverem vazios (do auth.users)
    if (!profile.email || !profile.name) {
      // Buscar dados do auth.users usando o token
      const supabaseUrl = Deno.env.get('SUPABASE_URL')
      const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
      const authHeader = req.headers.get('Authorization')
      const token = authHeader?.replace('Bearer ', '')
      
      const updates: any = {}
      
      if (supabaseUrl && supabaseAnonKey && token) {
        const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey)
        const { data: authUser } = await supabaseAnon.auth.getUser(token)
        
        if (!profile.email && authUser?.user?.email) {
          updates.email = authUser.user.email
        }
        if (!profile.name && authUser?.user?.user_metadata?.name) {
          updates.name = authUser.user.user_metadata.name
        }
      }

      if (Object.keys(updates).length > 0) {
        await supabase
          .from('app_users')
          .update(updates)
          .eq('id', user.id)

        // Atualizar profile local
        Object.assign(profile, updates)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: profile
      } as ApiResponse),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

