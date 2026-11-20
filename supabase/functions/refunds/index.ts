import { createSupabaseClient } from '../_shared/supabase.ts'
import { requireAuth, getUserRole } from '../_shared/auth.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { prepareRefundReservation } from '../_shared/refund-reservation.ts'
import { processRefundOperation } from '../_shared/refund-process.ts'
import { getOriginalPixRefundEligibility } from '../_shared/pix-refund-eligibility.ts'

Deno.serve(async (req) => {
  const headers = { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' }
  const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers })
  if (req.method === 'OPTIONS') return new Response('ok', { headers })
  try {
    const user = await requireAuth(req)
    if (user instanceof Response) return reply({ success: false, error: 'Não autenticado' }, 401)
    const db = createSupabaseClient()
    const admin = await getUserRole(user.id) === 'admin'
    if (req.method === 'GET') {
      if (new URL(req.url).searchParams.get('view') === 'mine') return reply({ success: true, data: await getOriginalPixRefundEligibility(db, user.id) })
      if (!admin) return reply({ success: false, error: 'Acesso negado' }, 403)
      const { data, error } = await db.from('refund_requests').select('*, app_users!refund_requests_user_id_fkey(name,email,balance)').order('created_at', { ascending: false })
      if (error) throw error
      const ids = [...new Set((data || []).map((row: any) => row.user_id))]
      let credits: any[] = []
      if (ids.length) {
        const result = await db.from('transactions').select('user_id,amount,description,created_at,created_by').in('user_id', ids).eq('type', 'credit').order('created_at', { ascending: false })
        if (result.error) throw result.error
        credits = result.data || []
      }
      const idsRequests = (data || []).map((row: any) => row.id)
      let operations: any[] = []
      if (idsRequests.length) {
        const result = await db.from('refund_payment_operations').select('id,refund_request_id,amount,status').in('refund_request_id', idsRequests)
        if (result.error) throw result.error
        operations = result.data || []
      }
      return reply({ success: true, data: (data || []).map((row: any) => ({ ...row, manual_claim_mine: row.manual_claimed_by === user.id, credits: credits.filter(c => c.user_id === row.user_id), operations: operations.filter(o => o.refund_request_id === row.id), account_operations: operations.filter(o => (data || []).some((request: any) => request.id === o.refund_request_id && request.user_id === row.user_id)) })) })
    }
    if (req.method === 'POST') {
      const body = await req.json()
      if (body.mode === 'original_pix') {
        if (body.confirmed !== true) return reply({ success: false, error: 'Confirme a solicitação.' }, 400)
        const eligibility = await getOriginalPixRefundEligibility(db, user.id)
        if (!eligibility.eligible) return reply({ success: false, error: 'Não foi possível confirmar a elegibilidade para devolução ao Pix original.' }, 409)
        if (eligibility.pending) return reply({ success: false, error: 'Você já possui uma solicitação pendente.' }, 409)
        const { error } = await db.from('refund_requests').insert({ user_id: user.id, pix_key: null, whatsapp: null })
        if (error?.code === '23505') return reply({ success: false, error: 'Você já possui uma solicitação pendente.' }, 409)
        if (error) throw error
        return reply({ success: true })
      }
      const pix = typeof body.pix_key === 'string' ? body.pix_key.trim() : ''
      const whatsapp = typeof body.whatsapp === 'string' ? body.whatsapp.trim() : ''
      if (!pix || pix.length > 200 || whatsapp.length < 8 || whatsapp.length > 40 || body.confirmed !== true) return reply({ success: false, error: 'Preencha os dados e confirme a solicitação.' }, 400)
      const { data: flag, error: flagError } = await db.from('feature_flags').select('enabled').eq('key', 'refunds_enabled').maybeSingle()
      if (flagError) throw flagError
      if (!flag?.enabled) return reply({ success: false, error: 'Solicitações de ressarcimento estão desativadas.' }, 403)
      const { error } = await db.from('refund_requests').insert({ user_id: user.id, pix_key: pix, whatsapp })
      if (error?.code === '23505') return reply({ success: false, error: 'Você já possui uma solicitação pendente.' }, 409)
      if (error) throw error
      return reply({ success: true })
    }
    if (req.method === 'PUT') {
      if (!admin) return reply({ success: false, error: 'Acesso negado' }, 403)
      const body = await req.json()
      if (typeof body.id !== 'string') return reply({ success: false, error: 'Solicitação inválida' }, 400)
      if (body.action === 'claim_manual' || body.action === 'release_manual') {
        if (body.action === 'claim_manual') {
          const { data: requestRow, error: requestError } = await db.from('refund_requests').select('pix_key').eq('id', body.id).single()
          if (requestError || !requestRow?.pix_key?.trim()) return reply({ success: false, error: 'A solicitação não possui chave Pix informada. Entre em contato com a pessoa.' }, 409)
        }
        const fn = body.action === 'claim_manual' ? 'claim_manual_refund' : 'release_manual_refund'
        const { data, error } = await db.rpc(fn, { p_request: body.id, p_admin: user.id })
        if (error) { console.error('Manual refund claim failed:', error.message); return reply({ success: false, error: 'Não foi possível abrir ou liberar a solicitação. Ela pode estar reservada por outro administrador ou ter sido alterada.' }, 409) }
        return reply({ success: true, data })
      }
      if (body.action === 'settle_manual') {
        if (typeof body.expected_balance !== 'number' || !Number.isFinite(body.expected_balance) || body.expected_balance <= 0) return reply({ success: false, error: 'Saldo inválido.' }, 400)
        const { data, error } = await db.rpc('settle_manual_refund', { p_request: body.id, p_expected_balance: body.expected_balance, p_admin: user.id })
        if (error) { console.error('Manual settlement failed:', error.message); return reply({ success: false, error: 'Não foi possível registrar a baixa. Atualize a página e confira o saldo e as operações pendentes.' }, 409) }
        return reply({ success: true, data: { amount: data } })
      }
      if (body.action !== 'refund_pix') return reply({ success: false, error: 'Atualize a página antes de solicitar o reembolso.' }, 400)
      const token = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN')
      if (!token) return reply({ success: false, error: 'Mercado Pago não configurado.' }, 503)
      const { data: existing, error: existingError } = await db.from('refund_payment_operations')
        .select('id,status').eq('refund_request_id', body.id).in('status', ['prepared', 'processing', 'unknown', 'approved']).limit(1).maybeSingle()
      if (existingError) throw existingError
      let operationId = existing?.id
      if (!operationId) {
        try {
          const reservation = await prepareRefundReservation(db, body.id, user.id)
          operationId = reservation.operationId
        } catch (error) {
          return reply({ success: false, error: error instanceof Error ? error.message : 'Não foi possível reservar o saldo' }, 409)
        }
      }
      try {
        const result = await processRefundOperation(db, operationId, user.id, token)
        return reply({ success: true, data: result })
      } catch (error) {
        console.error('Falha ao processar reembolso:', error)
        return reply({ success: false, error: 'Resultado ainda não confirmado. O saldo permanece reservado; tente consultar novamente.' }, 502)
      }
    }
    return reply({ success: false, error: 'Método não permitido' }, 405)
  } catch (error) {
    console.error('refunds:', error)
    return reply({ success: false, error: 'Não foi possível processar a solicitação.' }, 500)
  }
})
