import { requireAuth, getUserRole } from '../_shared/auth.ts'
import { hasPermission, type UserRole } from '../_shared/roles.ts'
import { createSupabaseClient } from '../_shared/supabase.ts'
import { getCorsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req: Request) => {
  const headers = { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' }
  if (req.method === 'OPTIONS') return new Response('ok', { headers })
  const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers })
  try {
    const user = await requireAuth(req)
    if (user instanceof Response) return user
    const db = createSupabaseClient()
    if (req.method === 'POST') {
      const role = await getUserRole(user.id) as UserRole
      if (!hasPermission(role, 'canSellLojinha') && !hasPermission(role, 'canSellLanchonete') && role !== 'comunicacao') {
        return respond({ success: false, error: 'Acesso negado.' }, 403)
      }
      const { userId, code } = await req.json()
      if (typeof userId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId) || typeof code !== 'string' || !/^[0-9]{4}$/.test(code)) {
        return respond({ success: false, error: 'Informe os quatro dígitos do código.' }, 400)
      }
      const { data, error } = await db.rpc('verify_sale_security_code', { p_seller: user.id, p_customer: userId, p_code: code })
      if (error) return respond({ success: false, error: 'Não foi possível verificar o código.' }, 500)
      if (data === 'locked') return respond({ success: false, error: 'Muitas tentativas. Aguarde 15 minutos e tente novamente.' }, 429)
      if (data === 'missing') return respond({ success: false, error: 'O cliente precisa cadastrar o WhatsApp antes de realizar a compra.' }, 400)
      if (data !== 'ok') return respond({ success: false, error: 'Código incorreto. Tente novamente.' }, 400)
      return respond({ success: true })
    }
    if (req.method === 'GET') {
      const [flag, profile] = await Promise.all([
        db.from('feature_flags').select('enabled').eq('key', 'require_whatsapp_contact').single(),
        db.from('app_users').select('whatsapp').eq('id', user.id).single(),
      ])
      if (flag.error || profile.error) return respond({ success: false, error: 'Não foi possível verificar o contato.' }, 500)
      return respond({ success: true, data: { required: flag.data.enabled, whatsapp: profile.data.whatsapp } })
    }
    if (req.method === 'PUT') {
      const { whatsapp } = await req.json()
      if (typeof whatsapp !== 'string' || !/^[0-9]{10,15}$/.test(whatsapp)) return respond({ success: false, error: 'Informe um número válido com DDD.' }, 400)
      const { data, error } = await db.from('app_users').update({ whatsapp }).eq('id', user.id).select('id').maybeSingle()
      if (error || !data) return respond({ success: false, error: 'Não foi possível salvar o contato.' }, 500)
      return respond({ success: true })
    }
    return respond({ success: false, error: 'Método não permitido.' }, 405)
  } catch {
    return respond({ success: false, error: 'Não foi possível processar a solicitação.' }, 500)
  }
})
