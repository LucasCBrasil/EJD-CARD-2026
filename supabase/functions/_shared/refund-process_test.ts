import { processRefundOperation } from './refund-process.ts'
const id='cebe5d5d-e34b-45ac-b7ce-f18ee54eb7be'
function mockDb(status='prepared', refundId: string | null=null) {
  const calls: any[] = []
  const db = {
    from(table: string) {
      const chain: any = { select() { return chain }, eq() { return chain }, async single() {
        return { data: table === 'pix_payments' ? {external_id:'123'} : {id,payment_id:'p',amount:3,status,provider_refund_id:refundId}, error:null }
      } }; return chain
    },
    async rpc(name: string, input: unknown) { calls.push({name,input}); return {data:(input as any).p_status,error:null} },
  }
  return {db,calls}
}
Deno.test('aprovação é conciliada com a reserva', async () => {
  const {db,calls}=mockDb()
  const result=await processRefundOperation(db,id,'admin','token',async () => new Response(JSON.stringify({id:456,payment_id:123,amount:3,status:'approved'}),{status:201}))
  if(result.status!=='approved'||calls.length!==1||calls[0].input.p_operation!==id) throw new Error('Conciliação incorreta')
})
Deno.test('resultado incerto nunca libera a reserva', async () => {
  const {db,calls}=mockDb(); let failed=false
  try { await processRefundOperation(db,id,'admin','token',async () => {throw new Error('timeout')}) } catch { failed=true }
  if(!failed||calls.length) throw new Error('Resultado incerto alterou a reserva')
})
Deno.test('operação em processamento consulta a devolução original', async () => {
  const {db,calls}=mockDb('processing','456'); let url=''
  const result=await processRefundOperation(db,id,'admin','token',async (u) => {url=String(u); return new Response(JSON.stringify({id:456,payment_id:123,amount:3,status:'in_process'}),{status:200})})
  if(!url.endsWith('/123/refunds/456')||result.status!=='processing'||calls[0].input.p_status!=='processing') throw new Error('Consulta incorreta')
})
Deno.test('resposta incompatível não altera reserva', async () => {
  const {db,calls}=mockDb(); let failed=false
  try { await processRefundOperation(db,id,'admin','token',async () => new Response(JSON.stringify({id:456,payment_id:999,amount:3,status:'approved'}),{status:201})) } catch { failed=true }
  if(!failed||calls.length) throw new Error('Resposta incompatível foi aceita')
})
Deno.test('consulta rejeita outro reembolso do mesmo pagamento e valor', async () => {
  const {db,calls}=mockDb('processing','456'); let failed=false
  try { await processRefundOperation(db,id,'admin','token',async () => new Response(JSON.stringify({id:789,payment_id:123,amount:3,status:'rejected'}),{status:200})) } catch { failed=true }
  if(!failed||calls.length) throw new Error('Outro reembolso alterou a reserva')
})
