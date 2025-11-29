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
    staleTime: 1000 * 5, // 5 segundos - dados ficam frescos por pouco tempo
    refetchOnMount: true, // Busca ao montar o componente
    refetchOnWindowFocus: true, // Atualiza ao focar na janela
    refetchInterval: 1000 * 5, // Auto-refresh a cada 5 segundos (polling)
  })
}




