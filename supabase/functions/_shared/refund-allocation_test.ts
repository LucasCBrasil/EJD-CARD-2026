import { allocateRefundBalance } from './refund-allocation.ts'
const equal = (a: unknown, b: unknown) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${JSON.stringify(a)} != ${JSON.stringify(b)}`) }
Deno.test('consome Pix antes de saldo manual', () => equal(allocateRefundBalance([{kind:'manual',cents:500},{kind:'pix',paymentId:'1',cents:300},{kind:'debit',cents:200}],600), {pix:[{paymentId:'1',cents:100}],manualCents:500}))
Deno.test('consome Pix mais antigo primeiro e mantém saldo manual', () => equal(allocateRefundBalance([{kind:'pix',paymentId:'1',cents:300},{kind:'pix',paymentId:'2',cents:400},{kind:'manual',cents:200},{kind:'debit',cents:500}],400), {pix:[{paymentId:'2',cents:200}],manualCents:200}))
Deno.test('gastos anteriores não consomem recargas futuras', () => equal(allocateRefundBalance([{kind:'manual',cents:300},{kind:'debit',cents:200},{kind:'pix',paymentId:'1',cents:300}],400), {pix:[{paymentId:'1',cents:300}],manualCents:100}))
for (const [label, action] of Object.entries({
  'saldo divergente': () => allocateRefundBalance([{kind:'manual',cents:200}],300),
  'débito superior aos créditos': () => allocateRefundBalance([{kind:'debit',cents:100}],0),
  'pagamento duplicado': () => allocateRefundBalance([{kind:'pix',paymentId:'1',cents:100},{kind:'pix',paymentId:'1',cents:100}],200),
  'valor fracionado': () => allocateRefundBalance([{kind:'manual',cents:1.5}],1),
})) Deno.test(`bloqueia ${label}`, () => { let failed = false; try { action() } catch { failed = true }; if (!failed) throw new Error('Conciliação deveria falhar') })
