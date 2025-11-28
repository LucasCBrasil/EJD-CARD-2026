import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api-client'
import { useToastContext } from '../contexts/ToastContext'

export const orderKeys = {
  all: ['orders'] as const,
  lists: () => [...orderKeys.all, 'list'] as const,
  open: () => [...orderKeys.all, 'open'] as const,
}

export function useOrders() {
  return useQuery({
    queryKey: orderKeys.lists(),
    queryFn: async () => {
      const response = await api.listOrders('lojinha')
      if (!response.success) {
        throw new Error((response as any).error || 'Erro ao buscar pedidos')
      }
      return response.data || []
    },
  })
}

export function useOpenOrders() {
  return useQuery({
    queryKey: orderKeys.open(),
    queryFn: async () => {
      const response = await api.listOrders('lojinha')
      if (!response.success) {
        throw new Error((response as any).error || 'Erro ao buscar pedidos')
      }
      // Filtrar apenas pedidos abertos
      return (response.data || []).filter((order: any) => !order.delivered_at)
    },
  })
}

export function useMarkOrderAsDelivered() {
  const queryClient = useQueryClient()
  const { showSuccess, showError } = useToastContext()

  return useMutation({
    mutationFn: async (orderId: string) => {
      // TODO: Criar Edge Function para marcar como entregue
      throw new Error('Não implementado - use Edge Function mark-sale-delivered')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orderKeys.all })
      showSuccess('Sucesso', 'Pedido marcado como entregue')
    },
    onError: (error: any) => {
      showError('Erro', error?.message || 'Erro ao marcar pedido como entregue')
    },
  })
}




