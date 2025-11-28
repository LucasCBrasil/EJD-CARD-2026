import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api-client'

export const transactionKeys = {
  all: ['transactions'] as const,
  lists: () => [...transactionKeys.all, 'list'] as const,
  byCardId: (cardId: string) => [...transactionKeys.all, 'cardId', cardId] as const,
}

export function useTransactions(cardId?: string) {
  return useQuery({
    queryKey: cardId ? transactionKeys.byCardId(cardId) : transactionKeys.lists(),
    queryFn: async () => {
      const response = await api.listTransactions(cardId)
      if (!response.success) {
        throw new Error((response as any).error || 'Erro ao buscar transações')
      }
      return response.data || []
    },
    enabled: !!cardId || !cardId, // Sempre habilitado
  })
}




