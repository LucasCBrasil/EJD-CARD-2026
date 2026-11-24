import { selectRefundPayments } from './refund-payment-selection.ts'

import { mercadoPago } from './mercadopago.ts'
import { validatePayment } from './mercadopago-validation.ts'

/** Reserve the balance against the largest suitable Pix after verifying the provider. */
export async function prepareRefundReservation(db: any, requestId: string, adminId: string, fetchPayment = mercadoPago) {
  const { data: request, error: requestError } = await db.from('refund_requests').select('id,user_id,status').eq('id', requestId).single()
  if (requestError || !request || request.status !== 'pending') throw new Error('Solicitação indisponível')
  const [accountResult, transactionResult, paymentResult, operationResult] = await Promise.all([
    db.from('app_users').select('balance').eq('id', request.user_id).single(),
    db.from('transactions').select('id,type,amount,created_by,created_at,description', { count: 'exact' }).eq('user_id', request.user_id).order('created_at').order('id').limit(10001),
    db.from('pix_payments').select('id,user_id,amount,status,external_id,confirmed_at,webhook_data', { count: 'exact' }).eq('user_id', request.user_id).limit(10001),
    db.from('refund_payment_operations').select('id,payment_id,status,amount', { count: 'exact' }).eq('user_id', request.user_id).limit(10001),
  ])
  if (accountResult.error || transactionResult.error || paymentResult.error || operationResult.error || !accountResult.data) throw new Error('Não foi possível conciliar a conta')
  const transactions = transactionResult.data || []
  const payments = paymentResult.data || []
  const operations = operationResult.data || []
  if (transactions.length > 10000 || payments.length > 10000 || operations.length > 10000 ||
      transactionResult.count !== transactions.length || paymentResult.count !== payments.length || operationResult.count !== operations.length) {
    throw new Error('Histórico incompleto ou extenso requer análise manual')
  }
  const candidates = selectRefundPayments(transactions, payments, accountResult.data.balance, operations)
  const pixCents = Math.round(Number(accountResult.data.balance) * 100)
  let original: any = null
  for (const candidate of candidates) {
    const remote = await fetchPayment(`/payments/${encodeURIComponent(candidate.external_id)}`)
    validatePayment(remote, candidate)
    const paid = Number(remote.transaction_amount)
    const refunded = Number(remote.transaction_amount_refunded ?? 0)
    if (!Number.isFinite(refunded) || refunded < 0 || refunded > paid) throw new Error('Valor reembolsado inválido no Mercado Pago')
    if (remote.status === 'approved' && Math.round((paid - refunded) * 100) >= pixCents) {
      original = candidate
      break
    }
  }
  if (!original) throw new Error('Nenhum pagamento Pix possui valor reembolsável suficiente')
  const { data, error } = await db.rpc('reserve_pix_refund', {
    p_request: requestId, p_payment: original.id, p_amount: pixCents / 100,
    p_expected_balance: Number(accountResult.data.balance), p_expected_transaction_count: transactions.length,
    p_admin: adminId,
  })
  if (error || !data) throw new Error('Não foi possível reservar o saldo; atualize e tente novamente')
  return { operationId: data as string, pixCents, manualCents: 0 }
}
