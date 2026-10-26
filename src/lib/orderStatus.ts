/**
 * Status de vendas/pedidos
 * - completed/delivered: venda de balcão (Lojinha e Lanchonete)
 * - pending -> preparing -> ready -> delivered | cancelled: autoatendimento da Lanchonete
 */

export type OrderStatus = 'completed' | 'delivered' | 'pending' | 'preparing' | 'ready' | 'cancelled'

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  completed: '✓ Concluída',
  delivered: 'Entregue',
  pending: 'Aguardando',
  preparing: 'Preparando',
  ready: 'Pronto p/ retirar',
  cancelled: 'Cancelado',
}

export const ORDER_STATUS_CLASSES: Record<OrderStatus, string> = {
  completed: 'text-green-700',
  delivered: 'text-anil-700',
  pending: 'text-latao-700',
  preparing: 'text-anil-700',
  ready: 'text-green-700',
  cancelled: 'text-vagao-700',
}

export const getOrderStatusLabel = (status: string) =>
  ORDER_STATUS_LABELS[status as OrderStatus] ?? status

export const getOrderStatusClass = (status: string) =>
  ORDER_STATUS_CLASSES[status as OrderStatus] ?? 'text-ferro-500'
