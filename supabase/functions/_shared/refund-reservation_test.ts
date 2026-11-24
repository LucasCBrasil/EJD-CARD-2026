import { prepareRefundReservation } from './refund-reservation.ts'
const time=new Date(Date.now()-86400000).toISOString(), user='user1', paymentId='payment1'
const original={id:paymentId,user_id:user,amount:3,status:'confirmed',external_id:'123',confirmed_at:time,webhook_data:{provider:'mercadopago'}}
const remote={id:123,external_reference:paymentId,payment_method_id:'pix',currency_id:'BRL',transaction_amount:3,transaction_amount_refunded:0,metadata:{user_id:user},status:'approved'}
function mockDb(overrides: Record<string, unknown> = {}) {
  const calls: any[]=[]
  const data: Record<string, any>={refund_requests:{id:'request1',user_id:user,status:'pending'},app_users:{balance:3},transactions:[{id:'tx1',type:'credit',amount:3,created_by:'mercadopago_webhook',created_at:time}],pix_payments:[original],refund_payment_operations:[],...overrides}
  return {calls,db:{from(table:string) { const chain:any={select(){return chain},eq(){return chain},order(){return chain},limit(){return Promise.resolve({data:data[table],error:null,count:Array.isArray(data[table]) ? data[table].length : null})},single(){return Promise.resolve({data:data[table],error:null})}};return chain },async rpc(name:string,input:unknown){calls.push({name,input});return {data:'operation1',error:null}}}}
}
Deno.test('reserva após validar o pagamento original no provedor', async () => {
  const {db,calls}=mockDb()
  const result=await prepareRefundReservation(db,'request1','admin',async () => remote)
  if(result.operationId!=='operation1'||calls.length!==1||calls[0].input.p_amount!==3) throw new Error('Reserva incorreta')
})
Deno.test('reserva saldo misto integral na maior recarga original', async () => {
  const base = Date.now() - 86400000
  const timestamps = [0, 1, 2, 3, 4].map(i => new Date(base + i * 1000).toISOString())
  const payments = [40, 5, 2].map((amount, i) => ({ ...original, id: `pay${i}`, amount, external_id: `${123+i}`, confirmed_at: timestamps[i] }))
  const transactions = [
    ...payments.map((p, i) => ({ id: `tx${i}`, type: 'credit', amount: p.amount, created_by: 'mercadopago_webhook', created_at: p.confirmed_at })),
    { id: 'manual', type: 'credit', amount: 5, created_by: '12345678-1234-1234-1234-123456789012', description: 'Crédito manual', created_at: timestamps[3] },
    { id: 'debit', type: 'debit', amount: 41, created_by: 'admin', created_at: timestamps[4] },
  ]
  const { db, calls } = mockDb({ app_users: { balance: 11 }, transactions, pix_payments: payments })
  await prepareRefundReservation(db, 'request1', 'admin', async () => ({ ...remote, external_reference: 'pay0', transaction_amount: 40 }))
  if (calls.length !== 1 || calls[0].input.p_payment !== 'pay0' || calls[0].input.p_amount !== 11) throw new Error('Reserva não corresponde ao saldo ou à maior recarga')
})
Deno.test('tenta a próxima recarga quando a maior não tem saldo no provedor', async () => {
  const base = Date.now() - 86400000
  const first = { ...original, id: 'first', amount: 40, confirmed_at: new Date(base).toISOString() }
  const second = { ...original, id: 'second', amount: 20, external_id: '124', confirmed_at: new Date(base + 1000).toISOString() }
  const transactions = [first, second].map((p, i) => ({ id: `tx${i}`, type: 'credit', amount: p.amount, created_by: 'mercadopago_webhook', created_at: p.confirmed_at }))
  transactions.push({ id: 'debit', type: 'debit', amount: 49, created_by: 'admin', created_at: new Date(base + 2000).toISOString() })
  const { db, calls } = mockDb({ app_users: { balance: 11 }, transactions, pix_payments: [first, second] })
  await prepareRefundReservation(db, 'request1', 'admin', async (path: string) => path.includes('/123')
    ? { ...remote, external_reference: 'first', transaction_amount: 40, transaction_amount_refunded: 35 }
    : { ...remote, id: 124, external_reference: 'second', transaction_amount: 20 })
  if (calls[0]?.input.p_payment !== 'second' || calls[0]?.input.p_amount !== 11) throw new Error('Não selecionou o próximo pagamento elegível')
})
for (const [name, change] of Object.entries({
  'pendente': {status:'pending'}, 'reembolsado': {transaction_amount_refunded:3}, 'outra conta': {metadata:{user_id:'other'}}, 'outro pagamento': {id:456},
})) Deno.test(`não reserva pagamento ${name}`,async () => {
  const {db,calls}=mockDb();let failed=false
  try {await prepareRefundReservation(db,'request1','admin',async () => ({...remote,...change}))} catch {failed=true}
  if(!failed||calls.length) throw new Error('Reserva indevida')
})
