import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api-client'
import { useToastContext } from '../contexts/ToastContext'

export const accountKeys = {
  all: ['accounts'] as const,
  lists: () => [...accountKeys.all, 'list'] as const,
  detail: (userId: string) => [...accountKeys.all, 'detail', userId] as const,
}

export function useAccounts(search?: string) {
  return useQuery({
    queryKey: [...accountKeys.lists(), search || ''],
    queryFn: async () => {
      const response = await api.listAccounts(search)
      if (!response.success) {
        throw new Error(response.error || 'Erro ao buscar contas')
      }
      return (response.data || []).map((account) => ({
        id: account.user_id || account.id,
        email: account.email || '',
        name: account.name || account.user_name || '',
        role: account.role || 'encontrista',
        balance: Number(account.balance) || 0,
        createdAt: account.created_at || account.createdAt || '',
      }))
    },
    staleTime: 1000 * 30,
    refetchOnWindowFocus: true,
  })
}

export function useAccountByUserId(userId: string, enabled = true) {
  return useQuery({
    queryKey: accountKeys.detail(userId),
    queryFn: async () => {
      const response = await api.getAccountByUserId(userId)
      if (!response.success) {
        throw new Error(response.error || 'Erro ao buscar conta')
      }
      return response.data || null
    },
    enabled: enabled && !!userId,
    retry: false,
    refetchOnWindowFocus: true,
  })
}

export function useUpdateUserBalance() {
  const queryClient = useQueryClient()
  const { showSuccess, showError } = useToastContext()

  return useMutation({
    mutationFn: async (input: { userId: string; amount: number; type: 'credit' | 'debit'; description?: string }) => {
      const response = await api.updateBalance(input)
      if (!response.success) {
        throw new Error(response.error || 'Erro ao atualizar saldo')
      }
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: accountKeys.all })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      showSuccess('Sucesso', 'Saldo atualizado com sucesso')
    },
    onError: (error: Error) => showError('Erro', error.message || 'Erro ao atualizar saldo'),
  })
}
