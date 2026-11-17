import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api-client'
import type { FoodTruck } from '../types'
import { useToastContext } from '../contexts/ToastContext'

export const foodTruckKeys = {
  all: ['food-trucks'] as const,
  list: (includeInactive: boolean) => [...foodTruckKeys.all, 'list', { includeInactive }] as const,
}

/**
 * Food trucks com cardápio. `includeInactive` só funciona para admin
 * (painel de cadastro); a página pública usa apenas os ativos.
 */
export function useFoodTrucks(includeInactive = false) {
  return useQuery({
    queryKey: foodTruckKeys.list(includeInactive),
    queryFn: async (): Promise<FoodTruck[]> => {
      const response = await api.listFoodTrucks(includeInactive)
      if (!response.success) {
        throw new Error(response.error || 'Erro ao buscar food trucks')
      }
      return response.data || []
    },
    staleTime: 1000 * 60 * 2,
    refetchOnWindowFocus: true,
  })
}

type ManageMethod = 'POST' | 'PUT' | 'DELETE'

interface ManageInput {
  method: ManageMethod
  data: Record<string, unknown>
  successMessage: string
}

/** Criar, editar ou excluir food truck/item. Invalida a lista ao terminar. */
export function useManageFoodTrucks() {
  const queryClient = useQueryClient()
  const { showSuccess, showError } = useToastContext()

  return useMutation({
    mutationFn: async ({ method, data }: ManageInput) => {
      const response = await api.manageFoodTrucks(data, method)
      if (!response.success) {
        throw new Error(response.error || 'Erro ao salvar')
      }
      return response.data
    },
    onSuccess: (_data, { successMessage }) => {
      queryClient.invalidateQueries({ queryKey: foodTruckKeys.all })
      showSuccess('Pronto', successMessage)
    },
    onError: (error: Error) => {
      showError('Erro', error.message || 'Erro ao salvar')
    },
  })
}
