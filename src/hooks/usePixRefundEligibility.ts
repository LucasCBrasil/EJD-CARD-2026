import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../lib/api-client'

export function usePixRefundEligibility() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['pix-refund-eligibility', user?.id],
    queryFn: async () => {
      const result = await api.getMyPixRefundEligibility()
      if (!result.success) throw new Error(result.error || 'Erro ao verificar ressarcimento')
      return result.data as { enabled: boolean; eligible: boolean; pending: boolean }
    },
    enabled: !!user?.id,
    retry: false,
    refetchOnWindowFocus: true,
    staleTime: 0,
  })
}
