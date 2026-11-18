import { createSupabaseClient } from '../_shared/supabase.ts'
import { syncMercadoPagoPayment } from '../_shared/mercadopago.ts'

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  try {
    const secret = Deno.env.get('MERCADO_PAGO_WEBHOOK_SECRET')
    if (!secret) return new Response('Webhook not configured', { status: 503 })
    const url = new URL(req.url)
    const id = url.searchParams.get('data.id')
    const requestId = req.headers.get('x-request-id')
    const signature = Object.fromEntries((req.headers.get('x-signature') || '').split(',').map(part => part.trim().split('=')))
    if (!id || !/^\d+$/.test(id) || !requestId || !signature.ts || !/^[a-f0-9]{64}$/i.test(signature.v1 || '')) return new Response('Invalid signature', { status: 401 })
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])
    const bytes = Uint8Array.from(signature.v1.match(/.{2}/g)!.map((hex: string) => parseInt(hex, 16)))
    const valid = await crypto.subtle.verify('HMAC', key, bytes, encoder.encode(`id:${id};request-id:${requestId};ts:${signature.ts};`))
    if (!valid) return new Response('Invalid signature', { status: 401 })
    const db = createSupabaseClient()
    const { data: local, error } = await db.from('pix_payments').select('*').eq('external_id', id).maybeSingle()
    if (error) throw error
    // Retry early notifications if creation has not finished persisting the remote ID.
    if (!local) return new Response('Payment not registered yet', { status: 503 })
    if (local.webhook_data?.provider !== 'mercadopago') return new Response('Provider mismatch', { status: 400 })
    await syncMercadoPagoPayment(local)
    return new Response('ok')
  } catch {
    return new Response('Unable to reconcile payment', { status: 500 })
  }
})
