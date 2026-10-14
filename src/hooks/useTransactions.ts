import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api-client'

export const transactionKeys = {
  all: ['transactions'] as const,
  lists: () => [...transactionKeys.all, 'list'] as const,
  byUserId: (userId: string) => [...transactionKeys.all, 'userId', userId] as const,
}

export function useTransactions(userId?: string) {
  return useQuery({
    queryKey: userId ? transactionKeys.byUserId(userId) : transactionKeys.lists(),
    queryFn: async () => {
      const response = await api.listTransactions(userId)
      if (!response.success) {
        throw new Error((response as any).error || 'Erro ao buscar transações')
      }
      return response.data || []
    },
    enabled: true,
    staleTime: 1000 * 5, // 5 segundos - dados ficam frescos por pouco tempo
    refetchOnMount: true, // Busca ao montar o componente
    refetchOnWindowFocus: true, // Atualiza ao focar na janela
    refetchInterval: 1000 * 5, // Auto-refresh a cada 5 segundos (polling)
  })
}



