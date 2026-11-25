import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type ApiResult, type SelfOrderItemInput } from '../lib/api-client'
import { useAuth } from '../contexts/AuthContext'
import { accountKeys, useAccountByUserId } from './useAccounts'

export const SELF_ORDER_FLAG = 'lanchonete_self_order'

export const lanchoneteOrderKeys = {
  all: ['lanchonete-orders'] as const,
  menu: () => [...lanchoneteOrderKeys.all, 'menu'] as const,
  balance: () => [...lanchoneteOrderKeys.all, 'balance'] as const,
  mine: () => [...lanchoneteOrderKeys.all, 'mine'] as const,
  queue: (status: string) => [...lanchoneteOrderKeys.all, 'queue', status] as const,
  flag: () => ['feature-flags', SELF_ORDER_FLAG] as const,
}

/** Erro da API com o código da RPC (ex.: INSUFFICIENT_BALANCE) e detalhes */
export class LanchoneteOrderError extends Error {
  code?: string
  details?: any

  constructor(response: ApiResult<unknown>, fallback: string) {
    super(response.error || fallback)
    this.code = response.code
    this.details = response.details
  }
}

const unwrap = <T,>(response: ApiResult<T>, fallback: string): T => {
  if (!response.success) throw new LanchoneteOrderError(response, fallback)
  return response.data as T
}

export interface MenuProduct {
  id: string
  name: string
  menuCategory: string
  description: string | null
  price: number
  stock: number | null // null = sem controle de estoque
  imageUrl: string | null
  comboItems: { productId: string; name: string; quantity: number }[]
}

export function useSelfOrderEnabled() {
  return useQuery({
    queryKey: lanchoneteOrderKeys.flag(),
    queryFn: async () => {
      const response = await api.getFeatureFlag(SELF_ORDER_FLAG)
      return response.success && response.data?.enabled === true
    },
    staleTime: 1000 * 30,
    refetchOnWindowFocus: true,
  })
}

export function useLanchoneteMenu() {
  return useQuery({
    queryKey: lanchoneteOrderKeys.menu(),
    queryFn: async (): Promise<MenuProduct[]> => {
      const data = unwrap(await api.listProducts('lanchonete'), 'Erro ao carregar o cardápio') as any[]
      return (data || [])
        .map((product) => ({
          id: product.id,
          name: product.name,
          menuCategory: product.menu_category || 'Outros',
          description: product.description || null,
          price: Number(product.price) || 0,
          stock: product.stock === null || product.stock === undefined ? null : Number(product.stock),
          imageUrl: product.image_url || product.image || null,
          comboItems: Array.isArray(product.combo_items)
            ? product.combo_items.map((item: any) => ({
              productId: item.product_id,
              name: item.name,
              quantity: Number(item.quantity),
            }))
            : [],
        }))
        .sort((a, b) => a.name.localeCompare(b.name))
    },
    staleTime: 1000 * 30,
    refetchOnWindowFocus: true,
  })
}

export function useMyBalance() {
  const { user } = useAuth()
  const query = useAccountByUserId(user?.id || '')
  return { ...query, data: query.data?.balance == null ? undefined : Number(query.data.balance) }
}

export function useMyLanchoneteOrders(options: { poll?: boolean } = {}) {
  return useQuery({
    queryKey: lanchoneteOrderKeys.mine(),
    queryFn: async () => unwrap(await api.listMyLanchoneteOrders(), 'Erro ao carregar seus pedidos') || [],
    staleTime: 1000 * 5,
    refetchOnWindowFocus: true,
    refetchInterval: options.poll === false ? false : 1000 * 10, // acompanhar o status do pedido
  })
}

export function useLanchoneteQueue(status: 'open' | 'delivered' | 'cancelled' = 'open', enabled = true) {
  return useQuery({
    enabled,
    queryKey: lanchoneteOrderKeys.queue(status),
    queryFn: async () => unwrap(await api.listLanchoneteOrders(status), 'Erro ao carregar a fila') || [],
    staleTime: 1000 * 3,
    refetchOnWindowFocus: true,
    refetchInterval: status === 'open' ? 1000 * 5 : false, // fila "em tempo real" por polling
  })
}

export function useCreateSelfOrder() {
  const queryClient = useQueryClient()

  return useMutation({
    // Retentar só falha de rede/servidor: é seguro porque o requestId torna o pedido idempotente.
    // Erro de negócio (saldo, estoque...) tem code e não adianta repetir.
    retry: (failureCount, error) => failureCount < 1 && !(error instanceof LanchoneteOrderError && error.code),
    mutationFn: async ({ items, requestId }: { items: SelfOrderItemInput[]; requestId: string }) =>
      unwrap(await api.createSelfOrder(items, requestId), 'Erro ao enviar o pedido'),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: lanchoneteOrderKeys.all })
      queryClient.invalidateQueries({ queryKey: accountKeys.all })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
    },
  })
}

export function useCancelMyLanchoneteOrder() {
  const queryClient = useQueryClient()

  return useMutation({
    retry: false, // um retry após sucesso não visto daria erro falso de status
    mutationFn: async (saleId: string) =>
      unwrap(await api.cancelMyLanchoneteOrder(saleId), 'Erro ao cancelar o pedido'),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: lanchoneteOrderKeys.all })
      queryClient.invalidateQueries({ queryKey: accountKeys.all })
    },
  })
}

export function useUpdateLanchoneteOrder() {
  const queryClient = useQueryClient()

  return useMutation({
    retry: false,
    mutationFn: async ({ saleId, action }: { saleId: string; action: 'preparing' | 'ready' | 'delivered' | 'cancel' }) =>
      unwrap<unknown>(
        action === 'cancel'
          ? await api.cancelLanchoneteOrder(saleId)
          : await api.updateLanchoneteOrderStatus(saleId, action),
        'Erro ao atualizar o pedido',
      ),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: lanchoneteOrderKeys.all })
      queryClient.invalidateQueries({ queryKey: accountKeys.all })
    },
  })
}
