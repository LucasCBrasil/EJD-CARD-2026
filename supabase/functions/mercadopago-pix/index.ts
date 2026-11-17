import { requireAuth } from '../_shared/auth.ts'
import { createSupabaseClient } from '../_shared/supabase.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { mercadoPago } from '../_shared/mercadopago.ts'
import { pixPricing } from '../_shared/pix-pricing.ts'

Deno.serve(async (req) => {
  const headers = { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' }
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers })
  if (req.method === 'OPTIONS') return new Response('ok', { headers })
  if (req.method !== 'POST') return reply({ success: false, error: 'Método não permitido' }, 405)
  try {
    const user = await requireAuth(req)
    if (user instanceof Response) return new Response(user.body, { status: user.status, headers })
    if (!Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN')) return reply({ success: false, error: 'Recargas Pix ainda não estão disponíveis. A configuração do Mercado Pago está pendente.' }, 503)
    const body = await req.json()
    const amount = body.amount
    const document = String(body.cpfCnpj || '').replace(/\D/g, '')
    const key = body.idempotencyKey
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 1 || !Number.isSafeInteger(Math.round(amount * 100)) ||
        Math.abs(amount * 100 - Math.round(amount * 100)) > 0.000001 ||
        !/^(\d{11}|\d{14})$/.test(document) || typeof key !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)) {
      return reply({ success: false, error: 'Informe valor a partir de R$ 1,00, CPF/CNPJ e identificador válidos.' }, 400)
    }
    const db = createSupabaseClient()
    const { serviceFee, chargedAmount } = pixPricing(amount)
    const { data: flag, error: flagError } = await db.from('feature_flags').select('enabled').eq('key', 'pix_enabled').maybeSingle()
    if (flagError) throw flagError
    if (flag?.enabled === false) return reply({ success: false, error: 'Recargas Pix temporariamente desabilitadas.' }, 403)
    const { data: account, error: accountError } = await db.from('app_users').select('id, email, name').eq('id', user.id).single()
    if (accountError || !account?.email) return reply({ success: false, error: 'Conta não encontrada.' }, 404)

    // Reserve the request before calling the provider. Retries reuse both the row and the provider key.
    const { error: insertError } = await db.from('pix_payments').insert({
      id: key, user_id: user.id, amount, pix_code: '', status: 'pending', payment_method: 'api',
      external_id: `mp:${key}`, webhook_data: { provider: 'mercadopago', service_fee: serviceFee, amount_charged: chargedAmount },
    })
    if (insertError && insertError.code !== '23505') throw insertError
    const { data: local, error: localError } = await db.from('pix_payments').select('*').eq('id', key).single()
    if (localError) throw localError
    if (local.user_id !== user.id || Number(local.amount) !== amount || local.webhook_data?.provider !== 'mercadopago') {
      return reply({ success: false, error: 'Identificador de recarga já utilizado.' }, 409)
    }
    if (local.external_id.startsWith('mp:')) {
      const payment = await mercadoPago('/payments', {
        method: 'POST', headers: { 'X-Idempotency-Key': key },
        body: JSON.stringify({
          transaction_amount: Number(local.webhook_data?.amount_charged ?? local.amount), payment_method_id: 'pix', description: 'Recarga de saldo EJD',
          external_reference: key, metadata: { user_id: user.id },
          notification_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mercadopago-webhook`,
          payer: { email: account.email, identification: { type: document.length === 11 ? 'CPF' : 'CNPJ', number: document } },
        }),
      })
      const qr = payment.point_of_interaction?.transaction_data
      if (!payment.id || !qr?.qr_code || !qr?.qr_code_base64) throw new Error('Mercado Pago não retornou o QR Code. Tente novamente.')
      const { error } = await db.from('pix_payments').update({ external_id: String(payment.id), pix_code: qr.qr_code,
        qr_code_url: qr.qr_code_base64, expires_at: payment.date_of_expiration || null })
        .eq('id', key).eq('external_id', `mp:${key}`)
      if (error) throw error
      local.external_id = String(payment.id); local.pix_code = qr.qr_code; local.qr_code_url = qr.qr_code_base64
    }
    return reply({ success: true, data: { paymentId: local.external_id, amount: Number(local.amount), chargedAmount: Number(local.webhook_data?.amount_charged ?? local.amount), pixCode: local.pix_code, qrCodeUrl: local.qr_code_url } })
  } catch (error) {
    console.error('Pix creation failed:', error instanceof Error ? error.message : 'Unknown error')
    return reply({ success: false, error: error instanceof Error && error.message.includes('Mercado Pago') ? error.message : 'Não foi possível gerar o Pix. Tente novamente.' }, 500)
  }
})
