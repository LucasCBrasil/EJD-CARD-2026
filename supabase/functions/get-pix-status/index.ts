import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Edge Function: Get PIX Payment Status
// Retorna o status de um pagamento PIX pelo external_id (Asaas payment ID)

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

const supabaseAdmin = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request): Promise<Response> => {
  console.log('[get-pix-status] Request:', req.method, req.url)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }

  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (!supabaseAdmin) {
    return new Response(JSON.stringify({ success: false, error: 'Supabase not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const url = new URL(req.url)
    const paymentId = url.searchParams.get('paymentId')

    if (!paymentId) {
      return new Response(JSON.stringify({ success: false, error: 'paymentId required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('[get-pix-status] Buscando payment:', paymentId)

    const { data, error } = await supabaseAdmin
      .from('pix_payments')
      .select('id, status, amount, confirmed_at, card_id')
      .eq('external_id', paymentId)
      .maybeSingle()

    if (error) {
      console.error('[get-pix-status] Erro:', error.message)
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!data) {
      return new Response(JSON.stringify({ success: false, error: 'Payment not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('[get-pix-status] Status:', data.status)

    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: any) {
    console.error('[get-pix-status] Erro:', error?.message)
    return new Response(JSON.stringify({ success: false, error: error?.message || 'Erro inesperado' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

