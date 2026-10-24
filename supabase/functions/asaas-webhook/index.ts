import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Edge Function: Asaas Webhook
// Recebe notificações do Asaas sobre pagamentos e atualiza o banco
// Variaveis de ambiente esperadas:
// - ASAAS_WEBHOOK_SECRET (obrigatoria para validar a assinatura)
// - SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (obrigatorias)

const ASAAS_WEBHOOK_SECRET = Deno.env.get('ASAAS_WEBHOOK_SECRET') || ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

const supabaseAdmin = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null

type AsaasEvent =
  | 'PAYMENT_CREATED'
  | 'PAYMENT_UPDATED'
  | 'PAYMENT_RECEIVED'
  | 'PAYMENT_CONFIRMED'
  | 'PAYMENT_OVERDUE'
  | 'PAYMENT_DELETED'
  | 'PAYMENT_RESTORED'
  | 'PAYMENT_REFUNDED'
  | 'PAYMENT_REFUND_FAILED'
  | 'PAYMENT_ANTICIPATED'
  | string

interface AsaasWebhookPayload {
  event?: AsaasEvent
  payment?: {
    id: string
    status?: string
    netValue?: number
    value?: number
    description?: string
    externalReference?: string
    pixTransaction?: {
      payload?: string
      encodedImage?: string
      qrCode?: string
      endToEndIdentifier?: string
    }
  }
}

async function verifyWebhookSignature(rawBody: string, signature: string | null): Promise<boolean> {
  if (!ASAAS_WEBHOOK_SECRET) return false
  if (!signature) return false

  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(ASAAS_WEBHOOK_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody))
  const expected = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  return signature === expected
}

// Handler principal usando Deno.serve
Deno.serve(async (req: Request): Promise<Response> => {
  // Webhook não precisa de CORS (é chamado pelo servidor do Asaas)
  const headers = { 'Content-Type': 'application/json' }

  console.log('[asaas-webhook] Request:', req.method, req.url)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers,
    })
  }

  if (!ASAAS_WEBHOOK_SECRET) {
    return new Response(JSON.stringify({ error: 'ASAAS_WEBHOOK_SECRET não configurado' }), {
      status: 503,
      headers,
    })
  }

  const rawBody = await req.text()
  console.log('[asaas-webhook] Body recebido:', rawBody.substring(0, 200))
  
  const signature = req.headers.get('asaas-signature') || req.headers.get('x-asaas-signature')

  const isValid = await verifyWebhookSignature(rawBody, signature)
  if (!isValid) {
    console.log('[asaas-webhook] Assinatura inválida')
    return new Response(JSON.stringify({ error: 'Invalid signature' }), {
      status: 401,
      headers,
    })
  }

  try {
    const payload: AsaasWebhookPayload = JSON.parse(rawBody || '{}')
    
    console.log('[asaas-webhook] Evento:', payload?.event, 'Status:', payload?.payment?.status, 'PaymentId:', payload?.payment?.id)

    if (!supabaseAdmin) {
      return new Response(
        JSON.stringify({ error: 'Supabase admin não configurado' }),
        { status: 503, headers }
      )
    }

    const paymentId = payload?.payment?.id
    if (!paymentId) {
      return new Response(JSON.stringify({ error: 'payment.id ausente no webhook' }), {
        status: 400,
        headers,
      })
    }

    const asaasStatus = (payload.payment?.status || '').toLowerCase()
    const statusMap: Record<string, string> = {
      confirmed: 'confirmed',
      received: 'confirmed',
      pending: 'pending',
      overdue: 'failed',
      refunded: 'cancelled',
      deleted: 'cancelled',
      cancelled: 'cancelled',
    }
    const mappedStatus = statusMap[asaasStatus] || 'pending'
    console.log('[asaas-webhook] Status mapeado:', asaasStatus, '->', mappedStatus)

    // Buscar pagamento existente pelo external_id (paymentId do Asaas)
    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from('pix_payments')
      .select('id, user_id, amount, status')
      .eq('external_id', paymentId)
      .maybeSingle()

    if (fetchErr) {
      console.error('[asaas-webhook] pix_payments fetch error:', fetchErr.message)
      return new Response(JSON.stringify({ error: 'Erro ao buscar pagamento PIX' }), {
        status: 500,
        headers,
      })
    }

    if (!existing) {
      console.log('[asaas-webhook] Payment não encontrado em pix_payments:', paymentId)
      return new Response(
        JSON.stringify({ ok: true, message: 'payment não encontrado em pix_payments' }),
        { status: 200, headers }
      )
    }

    if (mappedStatus === 'confirmed') {
      const { error: confirmationError } = await supabaseAdmin.rpc('confirm_account_pix_payment', {
        p_external_id: paymentId,
        p_webhook_data: payload,
      })
      if (confirmationError) {
        console.error('[asaas-webhook] Erro ao confirmar pagamento e creditar conta:', confirmationError.message)
        return new Response(JSON.stringify({ error: 'Erro ao confirmar pagamento PIX' }), {
          status: 500,
          headers,
        })
      }
    } else if (existing.status !== 'confirmed') {
      const { error: updateError } = await supabaseAdmin
        .from('pix_payments')
        .update({
          status: mappedStatus,
          webhook_data: payload,
          updated_at: new Date().toISOString(),
        })
        .eq('external_id', paymentId)
        .neq('status', 'confirmed')

      if (updateError) {
        console.error('[asaas-webhook] pix_payments update error:', updateError.message)
        return new Response(JSON.stringify({ error: 'Erro ao atualizar pagamento PIX' }), {
          status: 500,
          headers,
        })
      }
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers })
  } catch (error: any) {
    console.error('[asaas-webhook] Erro:', error?.message)
    return new Response(
      JSON.stringify({ error: error?.message || 'Erro ao processar webhook' }),
      { status: 500, headers }
    )
  }
})
