/**
 * API Client - Wrapper REST que oculta estrutura tRPC
 * 
 * Não expõe tipos, schemas ou nomes de rotas no bundle
 * Faz chamadas HTTP genéricas para Edge Functions
 */

import type { FoodTruck } from '../types'

const isDev = import.meta.env.DEV

// Em desenvolvimento, priorizar URL local; se não houver, usar localhost padrão
// Em produção, usar URL de produção
const supabaseUrl = isDev 
  ? (import.meta.env.VITE_SUPABASE_LOCAL_URL || 'https://auth.ejdcard.com.br')
  : (import.meta as any).env?.VITE_SUPABASE_URL

const API_BASE_URL = import.meta.env.VITE_SUPABASE_FUNCTIONS_URL || (supabaseUrl
  ? `${supabaseUrl}/functions/v1`
  : '')

// Log para debug (apenas em desenvolvimento)
if (isDev) {
  console.log('[api-client] Modo DEV detectado. API_BASE_URL:', API_BASE_URL)
}

/**
 * Obter token de autenticação
 * Agora usa cache do Zustand store para evitar chamadas redundantes
 */
async function getAuthToken(): Promise<string | null> {
  try {
    const { useAuthStore } = await import('../stores/authStore')
    const store = useAuthStore.getState()
    
    // Tentar pegar do cache primeiro
    const cachedSession = store.getCachedSession()
    if (cachedSession?.session?.access_token) {
      return cachedSession.session.access_token
    }
    
    // Se não tiver cache válido, buscar sessão (que já vai atualizar o cache)
    const { auth } = await import('./auth-client')
    const { data: { session } } = await auth.getSession()
    return session?.access_token || null
  } catch {
    return null
  }
}

/**
 * Fazer requisição autenticada para Edge Function
 */
async function request<T = any>(
  functionName: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
    body?: any
    query?: Record<string, string>
  } = {}
): Promise<T> {
  const { method = 'GET', body, query } = options
  
  // Verificar se API_BASE_URL está configurado
  if (!API_BASE_URL) {
    const errorMsg = isDev
      ? 'API não configurada. Em modo DEV, certifique-se de que o Supabase local está rodando (supabase start) e as Edge Functions estão sendo servidas (supabase functions serve).'
      : 'API não configurada. Verifique VITE_SUPABASE_URL nas variáveis de ambiente.'
    console.error('[api-client]', errorMsg)
    return {
      success: false,
      error: errorMsg
    } as T
  }
  
  const token = await getAuthToken()
  if (!token) {
    return {
      success: false,
      error: 'Não autenticado'
    } as T
  }

  try {
    const url = new URL(`${API_BASE_URL}/${functionName}`)
    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        if (value) { // Só adicionar se tiver valor
          url.searchParams.append(key, value)
        }
      })
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    }
    if (import.meta.env.VITE_SUPABASE_ANON_KEY) headers.apikey = import.meta.env.VITE_SUPABASE_ANON_KEY

    const response = await fetch(url.toString(), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })

    // Tentar parsear resposta como JSON
    let responseData: any
    try {
      responseData = await response.json()
    } catch {
      // Se não for JSON, retornar erro genérico
      return {
        success: false,
        error: `Erro ${response.status}: ${response.statusText}`
      } as T
    }

    if (!response.ok) {
      // Retornar erro no formato esperado
      return {
        success: false,
        error: responseData.error || responseData.message || `Erro ${response.status}`,
        code: responseData.code,
        details: responseData.details,
      } as T
    }

    return responseData
  } catch (error: any) {
    const isNetworkError = error.message?.includes('Failed to fetch') || 
                          error.message?.includes('NetworkError') ||
                          error.message?.includes('CORS')
    
    if (isNetworkError) {
      const errorMsg = isDev && /localhost|127\.0\.0\.1/.test(API_BASE_URL)
        ? `Edge Function '${functionName}' não está rodando localmente. Execute 'supabase functions serve' em um terminal separado. Se ainda não iniciou o Supabase local, execute 'supabase start' primeiro.`
        : 'Não foi possível acessar o serviço. Tente novamente em instantes. Se o problema continuar, contate a organização.'
      
      console.error(`[api-client] ${errorMsg}`, error)
      return {
        success: false,
        error: errorMsg
      } as T
    }
    
    console.error(`[api-client] Erro ao chamar Edge Function ${functionName}:`, error)
    
    return {
      success: false,
      error: error.message || 'Erro desconhecido ao fazer requisição'
    } as T
  }
}

// API pública - métodos genéricos que não expõem estrutura
export const api = {
  listRefunds: () => request<any>('refunds'),
  requestRefund: (pix_key: string, whatsapp: string) => request<any>('refunds', { method: 'POST', body: { pix_key, whatsapp, confirmed: true } }),
  getMyPixRefundEligibility: () => request<any>('refunds', { query: { view: 'mine' } }),
  requestOriginalPixRefund: () => request<any>('refunds', { method: 'POST', body: { mode: 'original_pix', confirmed: true } }),
  authorizeRefund: (id: string) => request<any>('refunds', { method: 'PUT', body: { id, action: 'refund_pix' } }),
  settleManualRefund: (id: string, expected_balance: number) => request<any>('refunds', { method: 'PUT', body: { id, action: 'settle_manual', expected_balance } }),
  claimManualRefund: (id: string) => request<any>('refunds', { method: 'PUT', body: { id, action: 'claim_manual' } }),
  releaseManualRefund: (id: string) => request<any>('refunds', { method: 'PUT', body: { id, action: 'release_manual' } }),
  // Products
  listProducts: (category?: string) => 
    request<{ success: boolean; data: any[] }>('list-products', {
      method: 'GET',
      query: category ? { category } : undefined,
    }),

  // User accounts and balances
  listAccounts: (search?: string) =>
    request<{ success: boolean; data: any[]; error?: string }>('list-accounts', {
      method: 'GET',
      query: search ? { search } : undefined,
    }),

  getAccountByUserId: (userId: string) =>
    request<{ success: boolean; data: any; error?: string }>('list-accounts', {
      method: 'GET',
      query: { userId },
    }),

  // Sales
  listSales: (category?: string, userId?: string, page?: number, limit?: number) =>
    request<{ success: boolean; data: any[]; total?: number }>('list-sales', {
      method: 'GET',
      query: {
        ...(category ? { category } : {}),
        ...(userId ? { userId } : {}),
        ...(page ? { page: page.toString() } : {}),
        ...(limit ? { limit: limit.toString() } : {}),
      },
    }),

  // Orders
  listOrders: (category?: string) =>
    request<{ success: boolean; data: any[] }>('list-orders', {
      method: 'GET',
      query: category ? { category } : undefined,
    }),

  getOpenOrders: () =>
    request<{ success: boolean; data: any[] }>('list-orders', {
      method: 'GET',
      query: { status: 'pending' },
    }),

  markOrderAsDelivered: (saleId: string) =>
    request<{ success: boolean }>('mark-sale-delivered', {
      method: 'POST',
      body: { saleId },
    }),

  // Transactions
  listTransactions: (userId?: string) =>
    request<{ success: boolean; data: any[]; error?: string }>('list-transactions', {
      method: 'GET',
      query: userId ? { userId } : undefined,
    }),

  // Operações existentes via Edge Functions já criadas
  createSale: (data: any) =>
    request<{ success: boolean; data: any }>('make-sale', {
      method: 'POST',
      body: data,
    }),

  getLojinhaCart: (params: { userId?: string; cartId?: string }) =>
    request<{ success: boolean; data: any; error?: string }>('lojinha-carts', {
      method: 'GET',
      query: {
        ...(params.userId ? { userId: params.userId } : {}),
        ...(params.cartId ? { cartId: params.cartId } : {}),
      },
    }),

  manageLojinhaCart: (data: Record<string, unknown>) =>
    request<{ success: boolean; data: any; error?: string }>('lojinha-carts', {
      method: 'POST',
      body: data,
    }),

  updateBalance: (data: any) =>
    request<{ success: boolean; data: any; error?: string }>('update-balance', {
      method: 'POST',
      body: data,
    }),

  manageProducts: (data: any, method: 'POST' | 'PUT' | 'DELETE' = 'POST') =>
    request<{ success: boolean; data: any }>('manage-products', {
      method,
      body: data,
    }),

  // Coupons
  listCoupons: (category?: string) =>
    request<{ success: boolean; data: Array<{ name: string; discountAmount?: number }> }>('list-coupons', {
      method: 'GET',
      query: category ? { category } : undefined,
    }),

  // User Profile
  getUserProfile: () =>
    request<{ success: boolean; data: { id: string; email: string; name?: string | null; role: string } }>('get-user-profile', {
      method: 'GET',
    }),

  // User Management (admin only)
  searchUsers: (email: string) =>
    request<{ success: boolean; data: Array<{ id: string; email: string; name?: string | null; role: string; created_at?: string }> }>('manage-users', {
      method: 'GET',
      query: { email },
    }),

  updateUserRole: (userId: string, role: string) =>
    request<{ success: boolean; data: { userId: string; role: string } }>('manage-users', {
      method: 'PUT',
      body: { userId, role },
    }),

  // PIX Payment Status
  createPixPayment: (input: { amount: number; cpfCnpj: string; idempotencyKey: string }) =>
    request<{ success: boolean; data: { paymentId: string; pixCode: string; qrCodeUrl: string; amount: number; chargedAmount?: number }; error?: string }>('mercadopago-pix', { method: 'POST', body: input }),
  getPixPaymentStatus: (paymentId: string) =>
    request<{ success: boolean; error?: string; data: { id: string; status: string; amount: number; amount_charged?: number; pix_code?: string; qr_code_url?: string; confirmed_at?: string } }>('get-pix-status', {
      method: 'GET',
      query: { paymentId },
    }),

  // Food trucks parceiros (somente cardápio)
  listFoodTrucks: (includeInactive = false) =>
    request<ApiResult<FoodTruck[]>>('list-food-trucks', {
      method: 'GET',
      query: includeInactive ? { includeInactive: 'true' } : undefined,
    }),

  manageFoodTrucks: (data: Record<string, unknown>, method: 'POST' | 'PUT' | 'DELETE' = 'POST') =>
    request<ApiResult<unknown>>('manage-food-trucks', {
      method,
      body: data,
    }),

  getFoodTruckUploadUrl: (kind: 'logo' | 'item', contentType: string) =>
    request<ApiResult<{ bucket: string; path: string; token: string }>>('manage-food-trucks', {
      method: 'POST',
      body: { entity: 'upload', kind, contentType },
    }),

  // Feature Flags
  getFeatureFlag: (key: string) =>
    request<{ success: boolean; data: { key: string; enabled: boolean; description?: string } }>('feature-flags', {
      method: 'GET',
      query: { key },
    }),

  listFeatureFlags: () =>
    request<{ success: boolean; data: Array<{ key: string; enabled: boolean; description?: string; updated_at?: string }> }>('feature-flags', {
      method: 'GET',
    }),

  updateFeatureFlag: (key: string, enabled: boolean) =>
    request<{ success: boolean; data: { key: string; enabled: boolean } }>('feature-flags', {
      method: 'PUT',
      body: { key, enabled },
    }),

  // Own account history
  getMyAccountHistory: () =>
    request<{ 
      success: boolean; 
      error?: string;
      data: { 
        account: any | null;
        transactions: any[];
        sales: any[];
      } 
    }>('my-account-history', {
      method: 'GET',
    }),

  // Pedido de autoatendimento da Lanchonete (comprador = usuário logado)
  createSelfOrder: (items: SelfOrderItemInput[], requestId: string) =>
    request<ApiResult<{ saleId: string; saleNumber: number; total: number; newBalance: number; alreadyExisted: boolean }>>(
      'create-self-order',
      { method: 'POST', body: { items, requestId } },
    ),

  listMyLanchoneteOrders: () =>
    request<ApiResult<LanchoneteOrder[]>>('my-lanchonete-orders', { method: 'GET' }),

  cancelMyLanchoneteOrder: (saleId: string) =>
    request<ApiResult<{ saleId: string; saleNumber: number; refundedAmount: number; newBalance: number }>>(
      'my-lanchonete-orders',
      { method: 'POST', body: { saleId, action: 'cancel' } },
    ),

  // Fila da equipe da Lanchonete
  listLanchoneteOrders: (status: 'open' | 'delivered' | 'cancelled' = 'open') =>
    request<ApiResult<LanchoneteOrder[]>>('lanchonete-orders', { method: 'GET', query: { status } }),

  updateLanchoneteOrderStatus: (saleId: string, status: 'preparing' | 'ready' | 'delivered') =>
    request<ApiResult<{ saleId: string; saleNumber: number; status: string }>>('lanchonete-orders', {
      method: 'POST',
      body: { saleId, status },
    }),

  cancelLanchoneteOrder: (saleId: string) =>
    request<ApiResult<{ saleId: string; saleNumber: number; refundedAmount: number }>>('lanchonete-orders', {
      method: 'POST',
      body: { saleId, action: 'cancel' },
    }),
}

export interface ApiResult<T> {
  success: boolean
  data?: T
  error?: string
  code?: string
  details?: any
}

export interface SelfOrderItemInput {
  productId: string
  quantity: number
}

export interface LanchoneteOrder {
  id: string
  saleNumber: number
  total: number
  status: 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled'
  createdAt: string
  statusUpdatedAt: string | null
  deliveredAt: string | null
  customerName?: string
  items: Array<{ productId: string; productName: string; quantity: number; price: number }>
}
