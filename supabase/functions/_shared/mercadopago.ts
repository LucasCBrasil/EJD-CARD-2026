import { createSupabaseClient } from './supabase.ts'
import { validatePayment } from './mercadopago-validation.ts'

export async function mercadoPago(path: string, options: RequestInit = {}) {
  const token = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN')
  if (!token) throw new Error('Recarga Pix indisponível: configure MERCADO_PAGO_ACCESS_TOKEN no servidor.')
  const response = await fetch(`https://api.mercadopago.com/v1${path}`, {
    ...options,
    headers: { ...options.headers, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(20000),
  })
  const data = await response.json()
  if (!response.ok) {
    console.error('Mercado Pago request failed:', response.status)
    throw new Error('Não foi possível processar o Pix no Mercado Pago. Tente novamente.')
  }
  return data
}

// Only a payment fetched using the server's access token can authorize credit.
export async function syncMercadoPagoPayment(local: any) {
  const remote = await mercadoPago(`/payments/${encodeURIComponent(local.external_id)}`)
  validatePayment(remote, local)
  const db = createSupabaseClient()
  if (remote.status === 'approved') {
    const { error } = await db.rpc('confirm_account_pix_payment', {
      p_external_id: local.external_id,
      p_webhook_data: { ...local.webhook_data, provider: 'mercadopago', payment_id: String(remote.id), status: remote.status },
    })
    if (error) throw error
  } else if (['cancelled', 'rejected'].includes(remote.status)) {
    const { error } = await db.from('pix_payments').update({ status: remote.status === 'cancelled' ? 'cancelled' : 'failed' })
      .eq('id', local.id).eq('status', 'pending')
    if (error) throw error
  }
  const { data, error } = await db.from('pix_payments')
    .select('id, status, amount, pix_code, qr_code_url, confirmed_at').eq('id', local.id).single()
  if (error) throw error
  return data
}
