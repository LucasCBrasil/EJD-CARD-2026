import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api-client'
import type { ProductCategory } from '../types'
import { useToastContext } from '../contexts/ToastContext'

export const productKeys = {
  all: ['products'] as const,
  lists: () => [...productKeys.all, 'list'] as const,
  list: (category?: ProductCategory) => 
    [...productKeys.lists(), { category }] as const,
}

export function useProducts(category?: ProductCategory) {
  return useQuery({
    queryKey: productKeys.list(category),
    queryFn: async () => {
      const response = await api.listProducts(category)
      if (!response.success) {
        throw new Error((response as any).error || 'Erro ao buscar produtos')
      }
      return response.data || []
    },
    staleTime: 1000 * 60 * 2, // 2 minutos - produtos mudam menos frequentemente
    refetchOnMount: false,    // Não refaz se cache válido
    refetchOnWindowFocus: true, // Refetch ao voltar para a aba (caso admin tenha alterado)
  })
}

export function useCreateProduct() {
  const queryClient = useQueryClient()
  const { showSuccess, showError } = useToastContext()

  return useMutation({
    mutationFn: async (product: any) => {
      const response = await api.manageProducts(product, 'POST')
      if (!response.success) {
        throw new Error((response as any).error || 'Erro ao criar produto')
      }
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.lists() })
      showSuccess('Sucesso', 'Produto criado com sucesso')
    },
    onError: (error: any) => {
      showError('Erro', error?.message || 'Erro ao criar produto')
    },
  })
}

export function useUpdateProduct() {
  const queryClient = useQueryClient()
  const { showSuccess, showError } = useToastContext()

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: { category: ProductCategory } & Record<string, any> }) => {
      const response = await api.manageProducts({ id, ...updates }, 'PUT')
      if (!response.success) {
        throw new Error((response as any).error || 'Erro ao atualizar produto')
      }
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.lists() })
      showSuccess('Sucesso', 'Produto atualizado com sucesso')
    },
    onError: (error: any) => {
      showError('Erro', error?.message || 'Erro ao atualizar produto')
    },
  })
}

export function useDeleteProduct() {
  const queryClient = useQueryClient()
  const { showSuccess, showError } = useToastContext()

  return useMutation({
    mutationFn: async ({ id, category }: { id: string; category: ProductCategory }) => {
      const response = await api.manageProducts({ id, category }, 'DELETE')
      if (!response.success) {
        throw new Error((response as any).error || 'Erro ao remover produto')
      }
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.lists() })
      showSuccess('Sucesso', 'Produto removido com sucesso')
    },
    onError: (error: any) => {
      showError('Erro', error?.message || 'Erro ao remover produto')
    },
  })
}




