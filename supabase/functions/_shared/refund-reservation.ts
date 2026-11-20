import { buildRefundPlan } from './refund-plan.ts'

import { mercadoPago } from './mercadopago.ts'
import { validatePayment } from './mercadopago-validation.ts'

/** Prepare one safely attributable Pix after verifying the provider. */
export async function prepareRefundReservation(db: any, requestId: string, adminId: string, fetchPayment = mercadoPago) {
  const { data: request, error: requestError } = await db.from('refund_requests').select('id,user_id,status').eq('id', requestId).single()
  if (requestError || !request || request.status !== 'pending') throw new Error('Solicitação indisponível')
  const [accountResult, transactionResult, paymentResult, operationResult] = await Promise.all([
    db.from('app_users').select('balance').eq('id', request.user_id).single(),
    db.from('transactions').select('id,type,amount,created_by,created_at,description').eq('user_id', request.user_id).order('created_at').order('id').limit(10001),
    db.from('pix_payments').select('id,user_id,amount,status,external_id,confirmed_at,webhook_data').eq('user_id', request.user_id).limit(10001),
    db.from('refund_payment_operations').select('id,status,amount').eq('user_id', request.user_id).limit(10001),
  ])
  if (accountResult.error || transactionResult.error || paymentResult.error || operationResult.error || !accountResult.data) throw new Error('Não foi possível conciliar a conta')
  const transactions = transactionResult.data || []
  const payments = paymentResult.data || []
  const operations = operationResult.data || []
  if (transactions.length > 10000 || payments.length > 10000 || operations.length > 10000) throw new Error('Histórico extenso requer análise manual')
  const plan = buildRefundPlan(transactions, payments, accountResult.data.balance, operations)
  if (plan.pix.length !== 1) throw new Error('A reserva de múltiplos pagamentos ou sem Pix requer análise manual')
  const pix = plan.pix[0]
  const original = payments.find((payment: any) => payment.id === pix.paymentId)
  if (!original?.external_id) throw new Error('Pagamento Pix original não encontrado')
  const remote = await fetchPayment(`/payments/${encodeURIComponent(original.external_id)}`)
  validatePayment(remote, original)
  const paid = Number(remote.transaction_amount)
  const refunded = Number(remote.transaction_amount_refunded ?? 0)
  if (remote.status !== 'approved' || !Number.isFinite(refunded) || refunded < 0 ||
      Math.round((paid - refunded) * 100) < pix.cents) {
    throw new Error('Pagamento original não possui valor reembolsável suficiente')
  }
  const { data, error } = await db.rpc('reserve_pix_refund', {
    p_request: requestId, p_payment: pix.paymentId, p_amount: pix.cents / 100,
    p_expected_balance: Number(accountResult.data.balance), p_expected_transaction_count: transactions.length,
    p_admin: adminId,
  })
  if (error || !data) throw new Error('Não foi possível reservar o saldo; atualize e tente novamente')
  return { operationId: data as string, pixCents: pix.cents, manualCents: plan.manualCents }
}
