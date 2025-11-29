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
        throw new Error((response as any).error || 'Erro ao buscar cartões')
      }
      return Array.isArray(response.data) ? response.data : [response.data].filter(Boolean)
    },
    staleTime: 1000 * 30, // 30 segundos - saldo é crítico
    refetchOnMount: false,
    refetchOnWindowFocus: true, // Refetch ao voltar para a aba (importante para saldo)
  })
}

export function useCard(cardNumber: string, enabled = true) {
  return useQuery({
    queryKey: cardKeys.byNumber(cardNumber),
    queryFn: async () => {
      const response = await api.getCardByNumber(cardNumber)
      if (!response.success) {
        throw new Error((response as any).error || 'Erro ao buscar cartão')
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
        // Se não encontrou cartão, retornar null (não é erro)
        const errorMsg = (response as any).error || ''
        if (errorMsg.includes('não encontrado') || 
            errorMsg.includes('not found') ||
            errorMsg.includes('nenhum resultado')) {
          return null
        }
        // Para outros erros, também retornar null ao invés de lançar erro
        console.warn('Erro ao buscar cartão:', errorMsg)
        return null
      }
      return response.data || null
    },
    enabled: enabled && !!userId,
    retry: false, // Não tentar novamente se falhar
    throwOnError: false, // Não lançar erro, apenas retornar null
    staleTime: 1000 * 30,     // 30 segundos - saldo é crítico
    refetchOnMount: false,
    refetchOnWindowFocus: true, // Refetch ao voltar para a aba (importante para saldo)
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
        throw new Error((response as any).error || 'Erro ao criar cartão')
      }
      return response.data?.card || response.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: cardKeys.lists() })
      // A Edge Function retorna card_number (snake_case) do banco
      const cardNumber = data.card_number || data.cardNumber || 'N/A'
      showSuccess(
        'Cartão Criado!',
        `Cartão de número ${cardNumber} foi criado com sucesso.`
      )
    },
    onError: (error: any) => {
      // Extrair mensagem de erro completa de diferentes formatos
      const errorMessage = error?.message || error?.error || error?.toString() || 'Erro ao criar cartão'
      showError('Erro ao criar cartão', errorMessage)
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
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: cardKeys.all })
      const cardNumber = data?.cardNumber || data?.card_number || 'N/A'
      showSuccess(
        'Cartão Associado!',
        `Cartão de número ${cardNumber} foi associado com sucesso.`
      )
    },
    onError: (error: any) => {
      // Extrair mensagem de erro completa de diferentes formatos
      const errorMessage = error?.message || error?.error || error?.toString() || 'Erro ao associar cartão'
      showError('Erro ao associar cartão', errorMessage)
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
        throw new Error((response as any).error || 'Erro ao atualizar saldo')
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




