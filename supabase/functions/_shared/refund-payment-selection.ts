import { buildRefundPlan } from './refund-plan.ts'

/** Choose a reconciled payment that can return the entire current balance. */
export function selectRefundPayments(transactions: any[], payments: any[], balance: number | string, operations: any[] = [], now = Date.now()) {
  buildRefundPlan(transactions, payments, balance, operations)
  const amount = Math.round(Number(balance) * 100)
  if (!Number.isSafeInteger(amount) || amount <= 0) return []
  return payments.filter(payment => {
    const time = Date.parse(payment.confirmed_at || '')
    if (payment.status !== 'confirmed' || payment.webhook_data?.provider !== 'mercadopago' || !/^\d+$/.test(payment.external_id || '') ||
        !Number.isFinite(time) || time > now || now - time > 180 * 24 * 60 * 60 * 1000) return false
    const matched = transactions.some(tx => tx.type === 'credit' && tx.created_by === 'mercadopago_webhook' &&
      tx.created_at === payment.confirmed_at && Math.round(Number(tx.amount) * 100) === Math.round(Number(payment.amount) * 100))
    const reserved = operations.filter(op => op.payment_id === payment.id && ['prepared', 'processing', 'unknown', 'approved'].includes(op.status))
      .reduce((sum, op) => sum + Math.round(Number(op.amount) * 100), 0)
    return matched && Number.isSafeInteger(reserved) && Math.round(Number(payment.amount) * 100) - reserved >= amount
  }).sort((a, b) => Number(b.amount) - Number(a.amount) || String(a.confirmed_at).localeCompare(String(b.confirmed_at)) || String(a.id).localeCompare(String(b.id)))
}

export function selectRefundPayment(transactions: any[], payments: any[], balance: number | string, operations: any[] = [], now = Date.now()) {
  return selectRefundPayments(transactions, payments, balance, operations, now)[0] || null
}
