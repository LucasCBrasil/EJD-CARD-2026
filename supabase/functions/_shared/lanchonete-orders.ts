/**
 * Utilitários compartilhados pelas Edge Functions de pedidos da Lanchonete
 * (create-self-order, my-lanchonete-orders, lanchonete-orders)
 */

import { getCorsHeaders } from './cors.ts'
import type { ApiResponse } from './types.ts'

export const OPEN_ORDER_STATUSES = ['pending', 'preparing', 'ready'] as const

export const jsonResponse = (origin: string | null, body: ApiResponse, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
  })

interface RpcError {
  code?: string
  message: string
  details?: string | null
}

// Erros levantados pelas RPCs (RAISE EXCEPTION '<CODIGO>') -> HTTP + mensagem para o usuário
const RPC_ERRORS: Record<string, { status: number; message: string }> = {
  INVALID_REQUEST: { status: 400, message: 'Requisição inválida' },
  EMPTY_CART: { status: 400, message: 'O carrinho está vazio' },
  TOO_MANY_ITEMS: { status: 400, message: 'Pedido com itens demais' },
  INVALID_ITEM: { status: 400, message: 'Item inválido no pedido' },
  INVALID_QUANTITY: { status: 400, message: 'Quantidade inválida (máximo de 10 unidades por item)' },
  ORDER_TOO_LARGE: { status: 400, message: 'O pedido pode ter no máximo 20 unidades' },
  INVALID_STATUS: { status: 400, message: 'Status inválido' },
  INSUFFICIENT_BALANCE: { status: 400, message: 'Saldo insuficiente' },
  PRODUCT_UNAVAILABLE: { status: 409, message: 'Um produto do pedido não está mais disponível' },
  OUT_OF_STOCK: { status: 409, message: 'Estoque insuficiente para um produto do pedido' },
  TOO_MANY_OPEN_ORDERS: { status: 409, message: 'Você já tem 3 pedidos em aberto. Aguarde a retirada para pedir de novo.' },
  INVALID_STATUS_TRANSITION: { status: 409, message: 'O status do pedido mudou. Atualize a tela.' },
  SELF_ORDER_DISABLED: { status: 423, message: 'Os pedidos pelo app estão fechados no momento' },
  ORDER_NOT_FOUND: { status: 404, message: 'Pedido não encontrado' },
}

const parseDetails = (details?: string | null): unknown => {
  if (!details) return undefined
  try {
    return JSON.parse(details)
  } catch {
    return undefined
  }
}

export const rpcErrorResponse = (origin: string | null, error: RpcError, context: string) => {
  const known = RPC_ERRORS[error.message]
  if (known) {
    return jsonResponse(origin, {
      success: false,
      error: known.message,
      code: error.message,
      details: parseDetails(error.details),
    }, known.status)
  }

  if (error.code === 'P0002') {
    return jsonResponse(origin, { success: false, error: 'Conta não encontrada', code: 'ACCOUNT_NOT_FOUND' }, 404)
  }

  console.error(`${context} failed:`, error.code, error.message)
  return jsonResponse(origin, { success: false, error: 'Erro ao processar o pedido' }, 500)
}

export const isUuid = (value: unknown): value is string =>
  typeof value === 'string'
  && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)

interface SaleRow {
  id: string
  sale_number: number
  total: number | string
  status: string
  created_at: string
  status_updated_at: string | null
  delivered_at: string | null
  sale_items?: { product_id: string; product_name: string; quantity: number; price: number | string }[]
  user?: CustomerRow | CustomerRow[] | null
}

interface CustomerRow {
  name: string | null
  email: string | null
}

export const SALE_SELECT = 'id, sale_number, total, status, created_at, status_updated_at, delivered_at, sale_items(product_id, product_name, quantity, price)'

export const mapOrder = (sale: SaleRow) => {
  // Join N:1 vem como objeto em runtime; sem tipos gerados o client infere array
  const customer = Array.isArray(sale.user) ? sale.user[0] : sale.user
  return {
    id: sale.id,
    saleNumber: sale.sale_number,
    total: Number(sale.total),
    status: sale.status,
    createdAt: sale.created_at,
    statusUpdatedAt: sale.status_updated_at,
    deliveredAt: sale.delivered_at,
    customerName: customer ? (customer.name || customer.email || 'Sem nome') : undefined,
    items: (sale.sale_items || []).map((item) => ({
      productId: item.product_id,
      productName: item.product_name,
      quantity: item.quantity,
      price: Number(item.price),
    })),
  }
}
