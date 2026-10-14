import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api-client'
import { useToastContext } from '../contexts/ToastContext'
import type { ProductCategory } from '../types'

export const saleKeys = {
  all: ['sales'] as const,
  lists: () => [...saleKeys.all, 'list'] as const,
  list: (category?: ProductCategory) => 
    [...saleKeys.lists(), { category }] as const,
}

export function useSales(category?: ProductCategory) {
  return useQuery({
    queryKey: saleKeys.list(category),
    queryFn: async () => {
      const response = await api.listSales(category)
      if (!response.success) {
        throw new Error((response as any).error || 'Erro ao buscar vendas')
      }
      return response.data || []
    },
    staleTime: 1000 * 60, // 1 minuto - histórico pode ter cache maior
    refetchOnMount: false,
    refetchOnWindowFocus: true,
  })
}

export function useCreateSale() {
  const queryClient = useQueryClient()
  const { showSuccess, showError } = useToastContext()

  return useMutation({
    mutationFn: async (data: any) => {
      const response = await api.createSale(data)
      if (!response.success) {
        throw new Error((response as any).error || 'Erro ao criar venda')
      }
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: saleKeys.lists() })
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      showSuccess('Sucesso', 'Venda realizada com sucesso')
    },
    onError: (error: any) => {
      showError('Erro', error?.message || 'Erro ao realizar venda')
    },
  })
}



