import axios from 'axios'

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '/api',
  timeout: 12000,
  headers: { 'Content-Type': 'application/json' },
})

client.interceptors.response.use(
  (res) => res,
  (error) => {
    const message = error?.response?.data?.error || error.message || 'Erro de rede'
    return Promise.reject(new Error(message))
  }
)

const inFlight = new Map<string, Promise<any>>()

async function dedupe<T>(key: string, fn: () => Promise<T>): Promise<T> {
  if (inFlight.has(key)) return inFlight.get(key) as Promise<T>
  const promise = fn().finally(() => inFlight.delete(key))
  inFlight.set(key, promise)
  return promise
}

export interface CheckoutCustomerInput {
  name: string
  email?: string
  cpfCnpj: string
  phone?: string
}

export interface CheckoutPaymentInput {
  customerId: string
  value: number
  description?: string
  billingType: 'PIX' | 'BOLETO' | 'CREDIT_CARD'
  idempotencyKey?: string
}

export const api = {
  createCustomer(input: CheckoutCustomerInput) {
    const key = `customer:${input.cpfCnpj}:${(input.email || '').toLowerCase()}`
    return dedupe(key, async () => {
      const res = await client.post('/customers', input)
      return res.data.customer
    })
  },
  createPayment(input: CheckoutPaymentInput) {
    const key = input.idempotencyKey || `pay:${input.customerId}:${input.billingType}:${input.value}`
    return dedupe(key, async () => {
      const res = await client.post('/payments', input)
      return res.data
    })
  },
}
