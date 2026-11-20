import { prepareRefundReservation } from './refund-reservation.ts'
const time='2026-01-01T00:00:00Z', user='user1', paymentId='payment1'
const original={id:paymentId,user_id:user,amount:3,status:'confirmed',external_id:'123',confirmed_at:time,webhook_data:{provider:'mercadopago'}}
const remote={id:123,external_reference:paymentId,payment_method_id:'pix',currency_id:'BRL',transaction_amount:3,transaction_amount_refunded:0,metadata:{user_id:user},status:'approved'}
function mockDb() {
  const calls: any[]=[]
  const data: Record<string, unknown>={refund_requests:{id:'request1',user_id:user,status:'pending'},app_users:{balance:3},transactions:[{id:'tx1',type:'credit',amount:3,created_by:'mercadopago_webhook',created_at:time}],pix_payments:[original],refund_payment_operations:[]}
  return {calls,db:{from(table:string) { const chain:any={select(){return chain},eq(){return chain},order(){return chain},limit(){return Promise.resolve({data:data[table],error:null})},single(){return Promise.resolve({data:data[table],error:null})}};return chain },async rpc(name:string,input:unknown){calls.push({name,input});return {data:'operation1',error:null}}}}
}
Deno.test('reserva após validar o pagamento original no provedor', async () => {
  const {db,calls}=mockDb()
  const result=await prepareRefundReservation(db,'request1','admin',async () => remote)
  if(result.operationId!=='operation1'||calls.length!==1||calls[0].input.p_amount!==3) throw new Error('Reserva incorreta')
})
for (const [name, change] of Object.entries({
  'pendente': {status:'pending'}, 'reembolsado': {transaction_amount_refunded:3}, 'outra conta': {metadata:{user_id:'other'}}, 'outro pagamento': {id:456},
})) Deno.test(`não reserva pagamento ${name}`,async () => {
  const {db,calls}=mockDb();let failed=false
  try {await prepareRefundReservation(db,'request1','admin',async () => ({...remote,...change}))} catch {failed=true}
  if(!failed||calls.length) throw new Error('Reserva indevida')
})
