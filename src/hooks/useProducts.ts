import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { productsApi } from '../api/products.api'
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
    queryFn: () => productsApi.getAll(category),
    refetchOnMount: 'always', // Sempre buscar dados frescos quando o componente for montado
  })
}

export function useCreateProduct() {
  const queryClient = useQueryClient()
  const { showSuccess, showError } = useToastContext()

  return useMutation({
    mutationFn: productsApi.create,
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
    mutationFn: ({ id, updates }: { id: string; updates: { category: ProductCategory } & Record<string, any> }) =>
      productsApi.update(id, updates),
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
    mutationFn: ({ id, category }: { id: string; category: ProductCategory }) =>
      productsApi.delete(id, category),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.lists() })
      showSuccess('Sucesso', 'Produto removido com sucesso')
    },
    onError: (error: any) => {
      showError('Erro', error?.message || 'Erro ao remover produto')
    },
  })
}




