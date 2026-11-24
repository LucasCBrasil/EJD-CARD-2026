import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api-client'

/**
 * Lê uma feature flag sem bloquear a tela: enquanto carrega, `data` é undefined.
 * A Edge Function `feature-flags` costuma estar fria (cold start de vários segundos),
 * então quem usa deve tratar "ainda carregando" como desligado e seguir em frente.
 */
export function useFeatureFlag(key: string, enabled = true) {
  return useQuery({
    queryKey: ['feature-flags', key] as const,
    queryFn: async () => {
      const response = await api.getFeatureFlag(key)
      return response.success && response.data?.enabled === true
    },
    enabled,
    staleTime: 1000 * 60,
  })
}
