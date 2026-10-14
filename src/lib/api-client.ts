/**
 * API Client - Wrapper REST que oculta estrutura tRPC
 * 
 * Não expõe tipos, schemas ou nomes de rotas no bundle
 * Faz chamadas HTTP genéricas para Edge Functions
 */

const isDev = import.meta.env.DEV

// Em desenvolvimento, priorizar URL local; se não houver, usar localhost padrão
// Em produção, usar URL de produção
const supabaseUrl = isDev 
  ? (import.meta.env.VITE_SUPABASE_LOCAL_URL || 'https://auth.ejdcard.com.br')
  : (import.meta as any).env?.VITE_SUPABASE_URL

const API_BASE_URL = supabaseUrl 
  ? `${supabaseUrl}/functions/v1`
  : ''

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
        error: responseData.error || responseData.message || `Erro ${response.status}`
      } as T
    }

    return responseData
  } catch (error: any) {
    const isNetworkError = error.message?.includes('Failed to fetch') || 
                          error.message?.includes('NetworkError') ||
                          error.message?.includes('CORS')
    
    if (isNetworkError) {
      const errorMsg = isDev
        ? `Edge Function '${functionName}' não está rodando localmente. Execute 'supabase functions serve' em um terminal separado. Se ainda não iniciou o Supabase local, execute 'supabase start' primeiro.`
        : `Edge Function '${functionName}' não encontrada ou não está acessível. Verifique se fez deploy da função: 'supabase functions deploy ${functionName}'`
      
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

  manageSapatinhoProducts: (data: any, method: 'POST' | 'PUT' | 'DELETE' = 'POST') => {
    // Para DELETE, a Edge Function espera o ID como query parameter
    if (method === 'DELETE' && data?.id) {
      return request<{ success: boolean; data: any }>('manage-sapatinho-products', {
        method,
        query: { id: data.id },
      })
    }
    // Para POST e PUT, enviar no body
    return request<{ success: boolean; data: any }>('manage-sapatinho-products', {
      method,
      body: data,
    })
  },
    
  createSapatinhoOrder: (data: any) =>
    request<{ success: boolean; data: any }>('sapatinho-order-', {
      method: 'POST',
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
  getPixPaymentStatus: (paymentId: string) =>
    request<{ success: boolean; data: { id: string; status: string; amount: number; confirmed_at?: string } }>('get-pix-status', {
      method: 'GET',
      query: { paymentId },
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
        sapatinhoSales: any[];
      } 
    }>('my-account-history', {
      method: 'GET',
    }),
}
