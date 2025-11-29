import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Edge Function: Asaas PIX Checkout
// Cria cliente e pagamento PIX no Asaas e retorna copia-e-cola/QR
// Variaveis de ambiente esperadas:
// - ASAAS_API_KEY (obrigatoria)
// - ASAAS_API_URL (opcional, default sandbox)
// - SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (opcional, para registrar em pix_payments)

const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY') || ''

// Normalizar URL base da API Asaas
function normalizeAsaasUrl(url: string): string {
  let normalized = url.trim().replace(/\/+$/, '') // Remove trailing slashes
  // Se não termina em /v3, adiciona
  if (!normalized.endsWith('/v3')) {
    // Se termina em /api/v3, corrige para /v3
    normalized = normalized.replace(/\/api\/v3$/, '/v3')
    // Se ainda não tem /v3, adiciona
    if (!normalized.endsWith('/v3')) {
      normalized = normalized + '/v3'
    }
  }
  return normalized
}

const ASAAS_API_URL = normalizeAsaasUrl(Deno.env.get('ASAAS_API_URL') || 'https://api.asaas.com/v3')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

const supabaseAdmin = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null

// CORS headers - permissivo para funcionar em qualquer origem
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface InputPayload {
  name: string
  email?: string
  cpfCnpj: string
  phone?: string
  amount: number // Valor total a ser cobrado no PIX (inclui taxa)
  creditAmount?: number // Valor a ser creditado no cartão (sem taxa)
  description?: string
  cardId?: string
  userId?: string
}

async function createAsaasCustomer(
  body: { name: string; email?: string; cpfCnpj: string; phone?: string },
  idempotencyKey: string
) {
  console.log('[asaas-pix] Criando customer no Asaas:', body.name, body.cpfCnpj)
  console.log('[asaas-pix] URL:', `${ASAAS_API_URL}/customers`)
  console.log('[asaas-pix] API Key presente:', !!ASAAS_API_KEY, 'tamanho:', ASAAS_API_KEY.length)
  
  const res = await fetch(`${ASAAS_API_URL}/customers`, {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'content-type': 'application/json',
      'access_token': ASAAS_API_KEY,
      'X-Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(body),
  })
  
  const responseText = await res.text()
  console.log('[asaas-pix] Customer response status:', res.status)
  console.log('[asaas-pix] Customer response body:', responseText)
  
  let data: any = {}
  try {
    data = JSON.parse(responseText)
  } catch (e) {
    console.log('[asaas-pix] Resposta não é JSON válido')
  }
  
  if (!res.ok) {
    const errorMsg = data?.errors?.[0]?.description || data?.message || responseText || 'Erro ao criar cliente Asaas'
    console.log('[asaas-pix] Erro:', errorMsg)
    throw new Error(errorMsg)
  }
  return data
}

async function createAsaasPayment(body: any, idempotencyKey: string) {
  console.log('[asaas-pix] Criando payment no Asaas:', body.value, body.billingType)
  
  const res = await fetch(`${ASAAS_API_URL}/payments`, {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'content-type': 'application/json',
      'access_token': ASAAS_API_KEY,
      'X-Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify(body),
  })
  
  const data = await res.json().catch(() => ({}))
  console.log('[asaas-pix] Payment response:', res.status, data?.id || data?.errors?.[0]?.description)
  
  if (!res.ok) {
    throw new Error(data?.errors?.[0]?.description || data?.message || 'Erro ao criar pagamento Asaas')
  }
  return data
}

async function fetchPixQrCode(paymentId: string) {
  console.log('[asaas-pix] Buscando QR Code para payment:', paymentId)
  
  const attempts = [
    { endpoint: `${ASAAS_API_URL}/pix/qrCodes`, body: { payment: paymentId } },
    { endpoint: `${ASAAS_API_URL}/payments/${paymentId}/pixQrCode`, body: {} },
  ]
  
  for (const attempt of attempts) {
    try {
      const res = await fetch(attempt.endpoint, {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'content-type': 'application/json',
          'access_token': ASAAS_API_KEY,
        },
        body: Object.keys(attempt.body).length ? JSON.stringify(attempt.body) : undefined,
      })
      
      if (!res.ok) continue
      
      const data = await res.json()
      if (data?.payload || data?.encodedImage || data?.qrCode) {
        console.log('[asaas-pix] QR Code obtido com sucesso')
        return data
      }
    } catch (e) {
      console.log('[asaas-pix] Tentativa de QR falhou:', (e as Error)?.message)
    }
  }
  return null
}

// Handler principal usando Deno.serve
Deno.serve(async (req: Request): Promise<Response> => {
  console.log('[asaas-pix] Request:', req.method, req.url)
  
  // Responder imediatamente ao preflight CORS
  if (req.method === 'OPTIONS') {
    console.log('[asaas-pix] Respondendo OPTIONS (preflight)')
    return new Response('ok', { status: 200, headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (!ASAAS_API_KEY) {
    console.error('[asaas-pix] ASAAS_API_KEY não configurada!')
    return new Response(JSON.stringify({ error: 'ASAAS_API_KEY nao configurada' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const body: InputPayload = await req.json()
    console.log('[asaas-pix] Body recebido:', { 
      name: body.name, 
      cpfCnpj: body.cpfCnpj?.substring(0, 3) + '***', 
      amount: body.amount,
      cardId: body.cardId 
    })

    const name = (body.name || '').trim()
    const email = (body.email || '').trim().toLowerCase()
    const phone = (body.phone || '').trim()
    const amount = Number(body.amount || 0)
    const cpfCnpj = String(body.cpfCnpj || '').replace(/\D/g, '')

    // Validações
    if (!name || !cpfCnpj || !(cpfCnpj.length === 11 || cpfCnpj.length === 14) || amount <= 0) {
      console.error('[asaas-pix] Validação falhou:', { name: !!name, cpfCnpjLen: cpfCnpj.length, amount })
      return new Response(JSON.stringify({ error: 'Dados invalidos (nome, CPF/CNPJ e valor sao obrigatorios)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 1. Criar customer no Asaas
    const custIdempotency = `cust:${cpfCnpj}:${email || 'no-email'}`
    const customer = await createAsaasCustomer(
      { name, email: email || undefined, cpfCnpj, phone: phone || undefined },
      custIdempotency
    )

    // 2. Criar payment PIX
    const payIdempotency = `pay:${customer.id}:${amount}:${Date.now()}`
    const payment = await createAsaasPayment(
      {
        customer: customer.id,
        billingType: 'PIX',
        value: amount,
        description: body.description || 'Pagamento PIX',
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      },
      payIdempotency
    )

    // 3. Extrair código PIX
    let pixCopyPasteKey =
      payment?.pixCopyPasteKey ||
      payment?.payload ||
      payment?.pixTransaction?.payload ||
      ''
    let pixQrCodeImage =
      payment?.pixQrCodeImage ||
      payment?.encodedImage ||
      payment?.qrCode ||
      payment?.pixTransaction?.encodedImage ||
      payment?.pixTransaction?.qrCode ||
      ''

    // 4. Se não tem código, buscar via endpoint de QR
    if (!pixCopyPasteKey || !pixQrCodeImage) {
      const extra = await fetchPixQrCode(payment.id)
      if (extra) {
        pixCopyPasteKey = pixCopyPasteKey || extra.payload || ''
        pixQrCodeImage = pixQrCodeImage || extra.encodedImage || extra.qrCode || ''
      }
    }

    console.log('[asaas-pix] PIX gerado:', { 
      paymentId: payment.id, 
      hasPixCode: !!pixCopyPasteKey,
      hasQrCode: !!pixQrCodeImage 
    })

    // 5. Salvar no banco (se configurado)
    // IMPORTANTE: Salvamos o creditAmount (valor sem taxa) que será creditado no cartão
    // O amount é o valor total cobrado no PIX (com taxa)
    const amountToCredit = body.creditAmount || amount // Fallback para amount se creditAmount não vier
    
    if (supabaseAdmin && body.cardId) {
      try {
        console.log('[asaas-pix] Salvando no banco:', { 
          card_id: body.cardId, 
          external_id: payment.id,
          amount_charged: amount,
          amount_to_credit: amountToCredit 
        })
        const { error } = await supabaseAdmin.from('pix_payments').insert({
          card_id: body.cardId,
          amount: amountToCredit, // Valor que será creditado (sem taxa)
          pix_code: pixCopyPasteKey || 'N/A',
          qr_code_url: pixQrCodeImage || null,
          status: (payment.status || 'pending').toLowerCase(),
          payment_method: 'asaas',
          external_id: payment.id,
          webhook_data: { ...payment, amount_charged: amount, amount_to_credit: amountToCredit },
        })
        if (error) {
          console.error('[asaas-pix] Erro ao salvar pix_payments:', error.message, error.details, error.hint)
        } else {
          console.log('[asaas-pix] Salvo em pix_payments com sucesso!')
        }
      } catch (e) {
        console.error('[asaas-pix] Exception ao salvar:', (e as Error)?.message)
      }
    } else {
      console.log('[asaas-pix] Não salvando no banco:', { hasSupabase: !!supabaseAdmin, cardId: body.cardId })
    }

    // 6. Retornar resposta
    return new Response(
      JSON.stringify({
        paymentId: payment.id,
        status: payment.status,
        charges: {
          pixCopyPasteKey,
          pixQrCodeImage,
          payload: payment.payload || payment.pixTransaction?.payload,
          encodedImage: payment.encodedImage || payment.pixTransaction?.encodedImage,
        },
        raw: payment,
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err: any) {
    console.error('[asaas-pix] Erro:', err?.message || err)
    return new Response(JSON.stringify({ error: err?.message || 'Erro inesperado' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
