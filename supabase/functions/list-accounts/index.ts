import { createSupabaseClient } from '../_shared/supabase.ts'
import { requireAuth, getUserRole } from '../_shared/auth.ts'
import { getUserPermissions } from '../_shared/roles.ts'
import type { ApiResponse } from '../_shared/types.ts'
import { getCorsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(origin) })
  }

  try {
    const authResult = await requireAuth(req)
    if (authResult instanceof Response) {
      return new Response(authResult.body, {
        status: authResult.status,
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
      })
    }

    if (req.method !== 'GET') {
      return new Response(JSON.stringify({ success: false, error: 'Método não permitido' } as ApiResponse), {
        status: 405,
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
      })
    }

    const role = await getUserRole(authResult.id)
    const permissions = getUserPermissions(role)
    const canBrowseAccounts = ['admin', 'lojinha', 'lanchonete', 'comunicacao'].includes(role)
    const supabase = createSupabaseClient()
    const url = new URL(req.url)
    const requestedUserId = url.searchParams.get('userId')

    if (requestedUserId && requestedUserId !== authResult.id && !canBrowseAccounts) {
      return new Response(JSON.stringify({ success: false, error: 'Acesso negado' } as ApiResponse), {
        status: 403,
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
      })
    }

    let query = supabase
      .from('app_users')
      .select('id, email, name, role, balance, created_at')
      .order('name', { ascending: true })

    if (requestedUserId) {
      query = query.eq('id', requestedUserId)
    } else if (!canBrowseAccounts) {
      query = query.eq('id', authResult.id)
    } else {
      const search = (url.searchParams.get('search') || '').replace(/[,%()]/g, '').trim()
      if (search) {
        query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`).limit(50)
      } else {
        query = query.limit(1000)
      }
    }

    const { data: accounts, error } = await query
    if (error) {
      console.error('Error listing accounts:', error.message)
      return new Response(JSON.stringify({ success: false, error: 'Erro ao buscar contas' } as ApiResponse), {
        status: 500,
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
      })
    }

    const data = (accounts || []).map((account) => ({
      ...account,
      balance: account.id === authResult.id || permissions.canViewAllBalances ? account.balance : null,
    }))

    return new Response(JSON.stringify({
      success: true,
      data: requestedUserId ? data[0] || null : data,
    } as ApiResponse), {
      status: 200,
      headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error in list-accounts:', error)
    return new Response(JSON.stringify({ success: false, error: 'Erro interno do servidor' } as ApiResponse), {
      status: 500,
      headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
    })
  }
})
