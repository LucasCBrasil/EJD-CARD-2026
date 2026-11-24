import { selectRefundPayment } from './refund-payment-selection.ts'

export function isOriginalPixRefundEligible(transactions: any[], payments: any[], balance: number | string, operations: any[]) {
  try {
    return !!selectRefundPayment(transactions, payments, balance, operations)
  } catch { return false }
}

export async function getOriginalPixRefundEligibility(db: any, userId: string) {
  const [account, tx, payments, operations, pending, flag] = await Promise.all([
    db.from('app_users').select('balance').eq('id', userId).single(),
    db.from('transactions').select('id,type,amount,created_by,created_at,description', { count: 'exact' }).eq('user_id', userId).order('created_at').order('id').limit(10001),
    db.from('pix_payments').select('id,user_id,amount,status,external_id,confirmed_at,webhook_data', { count: 'exact' }).eq('user_id', userId).limit(10001),
    db.from('refund_payment_operations').select('id,payment_id,status,amount', { count: 'exact' }).eq('user_id', userId).limit(10001),
    db.from('refund_requests').select('id').eq('user_id', userId).eq('status', 'pending').limit(1),
    db.from('feature_flags').select('enabled').eq('key', 'refunds_enabled').maybeSingle(),
  ])
  if (account.error || tx.error || payments.error || operations.error || pending.error || flag.error || !account.data ||
    tx.count !== (tx.data || []).length || payments.count !== (payments.data || []).length || operations.count !== (operations.data || []).length) {
    throw new Error('Não foi possível verificar a elegibilidade')
  }
  const refundable = isOriginalPixRefundEligible(tx.data || [], payments.data || [], account.data.balance, operations.data || [])
  return { enabled: !!flag.data?.enabled, eligible: !!flag.data?.enabled && refundable, refundable, pending: (pending.data || []).length > 0 }
}
