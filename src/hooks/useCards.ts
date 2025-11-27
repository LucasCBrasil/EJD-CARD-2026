import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api-client'
import { useToastContext } from '../contexts/ToastContext'
import { auth } from '../lib/auth-client'

// Query Keys
export const cardKeys = {
  all: ['cards'] as const,
  lists: () => [...cardKeys.all, 'list'] as const,
  list: (filters: string) => [...cardKeys.lists(), { filters }] as const,
  details: () => [...cardKeys.all, 'detail'] as const,
  detail: (id: string) => [...cardKeys.details(), id] as const,
  byNumber: (number: string) => [...cardKeys.all, 'number', number] as const,
  byUserId: (userId: string) => [...cardKeys.all, 'userId', userId] as const,
}

// Queries
export function useCards() {
  return useQuery({
    queryKey: cardKeys.lists(),
    queryFn: async () => {
      const response = await api.listCards()
      if (!response.success) {
        throw new Error(response.error || 'Erro ao buscar cartões')
      }
      return Array.isArray(response.data) ? response.data : [response.data].filter(Boolean)
    },
  })
}

export function useCard(cardNumber: string, enabled = true) {
  return useQuery({
    queryKey: cardKeys.byNumber(cardNumber),
    queryFn: async () => {
      const response = await api.getCardByNumber(cardNumber)
      if (!response.success) {
        throw new Error(response.error || 'Erro ao buscar cartão')
      }
      return response.data || null
    },
    enabled: enabled && !!cardNumber && cardNumber.length >= 3,
  })
}

export function useCardByUserId(userId: string, enabled = true) {
  return useQuery({
    queryKey: cardKeys.byUserId(userId),
    queryFn: async () => {
      const response = await api.getCardByUserId(userId)
      if (!response.success) {
        throw new Error(response.error || 'Erro ao buscar cartão')
      }
      return response.data || null
    },
    enabled: enabled && !!userId,
    retry: false, // Não tentar novamente se falhar
    throwOnError: false, // Não lançar erro, apenas retornar null
    refetchOnMount: true, // Refetch quando o componente montar
    refetchOnWindowFocus: true, // Refetch quando a janela ganhar foco
  })
}

// Mutations
export function useCreateCard() {
  const queryClient = useQueryClient()
  const { showSuccess, showError } = useToastContext()

  return useMutation({
    mutationFn: async (params: { name: string; cardNumber: string; cardCode: string; phoneNumber: string; initialBalance?: number }) => {
      const response = await api.updateBalance({
        action: 'create',
        name: params.name,
        cardNumber: params.cardNumber,
        cardCode: params.cardCode,
        phoneNumber: params.phoneNumber,
        initialBalance: params.initialBalance || 0,
        description: params.initialBalance ? `Saldo inicial de R$ ${params.initialBalance.toFixed(2)}` : undefined
      })
      if (!response.success) {
        throw new Error(response.error || 'Erro ao criar cartão')
      }
      return response.data?.card || response.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: cardKeys.lists() })
      showSuccess(
        'Cartão Criado!',
        `Cartão de número ${data.cardNumber} foi criado com sucesso.`
      )
    },
    onError: (error: any) => {
      showError('Erro', error?.message || 'Erro ao criar cartão')
    },
  })
}

export function useAssociateCard() {
  const queryClient = useQueryClient()
  const { showSuccess, showError } = useToastContext()

  return useMutation({
    mutationFn: async (params: { cardNumber: string; cardCode: string }) => {
      // TODO: Criar Edge Function para associate ou usar updateBalance
      throw new Error('Associate card precisa ser implementado via Edge Function')
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: cardKeys.all })
      showSuccess(
        'Cartão Associado!',
        `Cartão de número ${data.cardNumber} foi associado com sucesso.`
      )
    },
    onError: (error: any) => {
      showError('Erro', error?.message || 'Erro ao associar cartão')
    },
  })
}

export function useUpdateCardBalance() {
  const queryClient = useQueryClient()
  const { showSuccess, showError } = useToastContext()

  return useMutation({
    mutationFn: async (params: { cardId: string; amount: number; type: 'credit' | 'debit'; description?: string }) => {
      const response = await api.updateBalance({
        action: params.type === 'credit' ? 'add' : 'subtract',
        cardId: params.cardId,
        amount: Math.abs(params.amount),
        description: params.description
      })
      if (!response.success) {
        throw new Error(response.error || 'Erro ao atualizar saldo')
      }
      return response.data
    },
    onMutate: async (variables) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: cardKeys.all })
      
      const previousCards = queryClient.getQueryData(cardKeys.lists())
      
      // Atualizar cache otimisticamente
      queryClient.setQueryData(cardKeys.detail(variables.cardId), (old: any) => {
        if (!old) return old
        const newBalance = variables.type === 'credit'
          ? old.balance + variables.amount
          : old.balance - variables.amount
        return { ...old, balance: newBalance }
      })
      
      return { previousCards }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cardKeys.all })
      showSuccess('Sucesso', 'Saldo atualizado com sucesso')
    },
    onError: (error: any, _variables, context) => {
      // Rollback em caso de erro
      if (context?.previousCards) {
        queryClient.setQueryData(cardKeys.lists(), context.previousCards)
      }
      showError('Erro', error?.message || 'Erro ao atualizar saldo')
    },
  })
}




