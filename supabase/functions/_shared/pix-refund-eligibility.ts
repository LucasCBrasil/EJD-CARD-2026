import { buildRefundPlan } from './refund-plan.ts'

export function isOriginalPixRefundEligible(transactions: any[], payments: any[], balance: number | string, operations: any[]) {
  const released = new Set(operations.filter(o => ['cancelled', 'rejected'].includes(o.status)).map(o => o.id))
  const credits = transactions.filter(t => t.type === 'credit' && ![...released].some(id => [
    `Liberação de reserva Pix não enviada ${id}`, `Liberação de reserva de reembolso Pix ${id}`,
  ].includes(t.description)))
  if (!credits.length || credits.some(t => t.created_by !== 'mercadopago_webhook')) return false
  try {
    const plan = buildRefundPlan(transactions, payments, balance, operations)
    return plan.manualCents === 0 && plan.pix.length === 1 && plan.pix[0].cents > 0
  } catch { return false }
}

export async function getOriginalPixRefundEligibility(db: any, userId: string) {
  const [account, tx, payments, operations, pending, flag] = await Promise.all([
    db.from('app_users').select('balance').eq('id', userId).single(),
    db.from('transactions').select('id,type,amount,created_by,created_at,description', { count: 'exact' }).eq('user_id', userId).order('created_at').order('id').limit(10001),
    db.from('pix_payments').select('id,user_id,amount,status,external_id,confirmed_at,webhook_data', { count: 'exact' }).eq('user_id', userId).limit(10001),
    db.from('refund_payment_operations').select('id,status,amount', { count: 'exact' }).eq('user_id', userId).limit(10001),
    db.from('refund_requests').select('id').eq('user_id', userId).eq('status', 'pending').limit(1),
    db.from('feature_flags').select('enabled').eq('key', 'refunds_enabled').maybeSingle(),
  ])
  if (account.error || tx.error || payments.error || operations.error || pending.error || flag.error || !account.data ||
    tx.count !== (tx.data || []).length || payments.count !== (payments.data || []).length || operations.count !== (operations.data || []).length) {
    throw new Error('Não foi possível verificar a elegibilidade')
  }
  return { enabled: !!flag.data?.enabled, eligible: !!flag.data?.enabled && isOriginalPixRefundEligible(tx.data || [], payments.data || [], account.data.balance, operations.data || []), pending: (pending.data || []).length > 0 }
}
