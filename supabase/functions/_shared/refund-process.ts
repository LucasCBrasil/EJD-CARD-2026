import { requestMercadoPagoRefund } from './mercadopago-refund.ts'
import { validateRefundResponse } from './refund-validation.ts'

/** Retries the same provider key; never releases funds for an uncertain result. */
export async function processRefundOperation(db: any, operationId: string, adminId: string, token: string, fetcher: typeof fetch = fetch) {
  const { data: op, error } = await db.from('refund_payment_operations').select('id,payment_id,amount,status,provider_refund_id').eq('id', operationId).single()
  if (error || !op) throw new Error('Operação não encontrada')
  if (['approved', 'rejected', 'cancelled'].includes(op.status)) return { status: op.status }
  const { data: payment, error: paymentError } = await db.from('pix_payments').select('external_id').eq('id', op.payment_id).single()
  if (paymentError || !payment || !/^\d+$/.test(payment.external_id || '')) throw new Error('Pagamento original indisponível')
  const paymentId = String(payment.external_id)
  const amountCents = Math.round(Number(op.amount) * 100)
  let provider
  if (op.provider_refund_id) {
    if (!/^\d+$/.test(op.provider_refund_id)) throw new Error('Identificador inválido')
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 20000)
    try {
      const response = await fetcher(`https://api.mercadopago.com/v1/payments/${paymentId}/refunds/${op.provider_refund_id}`, {
        headers: { Authorization: `Bearer ${token}`, 'X-Render-In-Process-Refunds': 'true' }, signal: controller.signal,
      })
      if (!response.ok) throw new Error('Não foi possível consultar o reembolso no Mercado Pago')
      provider = validateRefundResponse(await response.json(), paymentId, amountCents)
      if (provider.id !== op.provider_refund_id) throw new Error('Reembolso consultado não corresponde à operação')
    } finally { clearTimeout(timer) }
  } else {
    provider = await requestMercadoPagoRefund({token,paymentId,amountCents,operationId: op.id}, fetcher)
  }
  const status = ['in_process','authorized'].includes(provider.status) ? 'processing' : provider.status
  const { data, error: finalError } = await db.rpc('finalize_pix_refund', {
    p_operation: op.id, p_status: status, p_provider_refund_id: provider.id, p_admin: adminId,
  })
  if (finalError || !data) throw new Error('Reembolso recebido, mas a conciliação precisa ser repetida')
  return { status: String(data) }
}
