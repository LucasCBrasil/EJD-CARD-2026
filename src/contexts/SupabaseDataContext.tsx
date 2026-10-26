import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type { UserAccount } from '../types'

// Interfaces (mantendo compatibilidade com DataContext original)
export interface Transaction {
  id: string
  userId: string
  amount: number
  type: 'credit' | 'debit'
  description: string
  createdBy?: string
  createdAt: string
}

export interface Product {
  id: string
  name: string
  price: number
  category: 'lojinha' | 'lanchonete'
  description?: string
  stock?: number
  active: boolean
  createdAt: string
}

export interface SaleItem {
  id?: string | null
  productId: string
  productName: string
  quantity: number
  price: number
  image?: string | null
}

export interface Sale {
  id: string
  userId: string
  sellerId: string
  saleId?: string
  category: 'lojinha' | 'lanchonete'
  customerName?: string
  customerEmail?: string
  items: SaleItem[]
  total: number
  status: 'completed' | 'delivered' | 'pending' | 'preparing' | 'ready' | 'cancelled'
  createdAt: string
  seller?: {
    id: string
    name: string
    email: string
  }
}

export interface Order {
  id: string
  saleId: string,
  saleNumber: string,
  orderCode?: string
  sale?: any
  userId: string
  customerName: string
  customer_name?: string
  items: SaleItem[]
  total: number
  status: 'pending' | 'completed' | 'delivered'
  createdAt: string
  deliveredAt?: string
}

export interface AppData {
  balances: Map<string, { balance: number; transactions: Transaction[] }>
  products: {
    lojinha: Product[]
    lanchonete: Product[]
  }
  sales: Sale[]
  orders: Order[]
  coupons: string[]
}

interface SupabaseDataContextType {
  data: AppData
  isLoading: boolean
  error: string | null
  
  // Funções de saldo
  addBalance: (userId: string, amount: number, description: string, createdBy?: string) => Promise<void>
  getBalance: (userId: string) => number
  getTransactions: (userId: string) => Transaction[]
  
  // Funções de produtos
  addProduct: (product: Omit<Product, 'id' | 'createdAt'>) => Promise<void>
  updateProduct: (id: string, updates: Partial<Product>) => Promise<void>
  deleteProduct: (id: string) => Promise<void>
  getProducts: (category: 'lojinha' | 'lanchonete') => Product[]
  
  // Funções de vendas
  makeSale: (userId: string, items: Omit<SaleItem, 'id'>[], category: 'lojinha' | 'lanchonete', coupon: string, discountedTotal: number) => Promise<string>
  getSales: (category?: 'lojinha' | 'lanchonete', limit?: number) => Promise<Sale[]>
  getSalesByUserId: (userId: string, limit?: number) => Promise<Sale[]>
  
  // Funções de pedidos
  getOpenOrders: () => Promise<Order[]>
  markAsDelivered: (orderId: string) => Promise<void>

  // Funções de cupons
  getCoupons: (category?: 'lojinha' | 'lanchonete') => Promise<Array<{ name: string; discountAmount?: number }>>
  
  // Funções de conta e saldo
  getAccountByUserId: (userId: string) => Promise<UserAccount | null>
  searchAccountsByName: (name: string) => Promise<UserAccount[]>
  updateUserBalance: (userId: string, amount: number, type: 'credit' | 'debit', description?: string) => Promise<void>
  
  // Utilitários
  resetData: () => Promise<void>
  loadSeedData: () => Promise<void>
}

const SupabaseDataContext = createContext<SupabaseDataContextType | undefined>(undefined)

export const useSupabaseData = () => {
  const context = useContext(SupabaseDataContext)
  if (context === undefined) {
    throw new Error('useSupabaseData must be used within a SupabaseDataProvider')
  }
  return context
}

interface SupabaseDataProviderProps {
  children: ReactNode
}

const mapUserAccount = (account: any): UserAccount => ({
  id: account.user_id || account.id,
  email: account.email || '',
  name: account.name || account.user_name || '',
  role: account.role || 'encontrista',
  balance: Number(account.balance) || 0,
  createdAt: account.created_at || account.createdAt || '',
})

export const SupabaseDataProvider: React.FC<SupabaseDataProviderProps> = ({ children }) => {
  const [data, setData] = useState<AppData>({
    balances: new Map(),
    products: { lojinha: [], lanchonete: [] },
    sales: [],
    orders: [],
    coupons: []
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Carregar dados do Supabase
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setError('Supabase não configurado')
      setIsLoading(false)
      return
    }

    loadData()
  }, [])

  // ✅ Simplificado: Apenas inicializar estrutura - dados carregados pelos hooks quando necessário
  // Isso elimina carregamento duplicado no mount (hooks já fazem isso via React Query)
  const loadData = async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      // Apenas inicializar estrutura vazia - os dados são carregados sob demanda pelos hooks.
      // quando necessário, aproveitando o cache do React Query
      setData({
        balances: new Map(),
        products: { lojinha: [], lanchonete: [] },
        sales: [], // Será carregado sob demanda via getSales() (Edge Function)
        orders: [], // Será carregado sob demanda via getOpenOrders() (Edge Function)
        coupons: [] // Será carregado sob demanda via getCoupons()
      })
      
      setIsLoading(false)
    } catch (err) {
      console.error('Erro ao inicializar dados:', err)
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
      setIsLoading(false)
    }
  }

  // ✅ Agora usa Edge Function via api-client
  const addBalance = async (userId: string, amount: number, description: string, createdBy?: string) => {
    try {
      const { api } = await import('../lib/api-client')
      const response = await api.updateBalance({
        userId,
        type: amount > 0 ? 'credit' : 'debit',
        amount: Math.abs(amount),
        description: description || (amount > 0 ? 'Crédito' : 'Débito'),
      })

      if (!response.success) {
        throw new Error((response as any).error || 'Erro ao atualizar saldo')
      }

      // Recarregar dados
      await loadData()
    } catch (err) {
      console.error('Erro ao adicionar saldo:', err)
      throw err
    }
  }

  // ⚠️ DEPRECATED: Use hooks ou API diretamente
  // Mantido apenas para compatibilidade com código legado
  const getBalance = (userId: string): number => {
    // data.cards não é mais populado no mount - use hooks ou API diretamente
    console.warn('SupabaseDataContext.getBalance() está obsoleto; busque o saldo pelo endpoint da conta')
    return 0
  }

  // ⚠️ DEPRECATED: Use hooks ou API diretamente
  // Mantido apenas para compatibilidade com código legado
  const getTransactions = (userId: string): Transaction[] => {
    // data.cards não é mais populado no mount - use hooks ou API diretamente
    console.warn('⚠️ SupabaseDataContext.getTransactions() está DEPRECATED. Use useTransactions() hook')
    return []
  }

  // Funções de produtos
  const addProduct = async (product: Omit<Product, 'id' | 'createdAt'>) => {
    try {
      // ✅ AGORA USA EDGE FUNCTION (SEGURO - apenas admins!)
      const { data: response, error } = await (supabase.functions.invoke as any)('manage-products', {
        method: 'POST',
        body: {
          name: product.name,
          price: product.price,
          category: product.category,
          description: product.description,
          stock: product.stock
        }
      })

      if (error) {
        console.error('Edge function error:', error)
        
        // Verificar se é erro de timeout
        const isTimeout = (error as any).message?.includes('timeout') || 
                         (error as any).message?.includes('aborted') || 
                         (error as any).name === 'AbortError' ||
                         (error as any).message?.includes('network') ||
                         (error as any).message?.includes('fetch')
        
        if (isTimeout) {
          throw new Error('Esta operação passou do limite de tempo para ser concluída. Por favor, tente novamente.')
        }
        
        throw new Error((error as any).message || 'Erro ao adicionar produto')
      }

      if (!response?.success) {
        throw new Error((response as any)?.error || 'Erro ao adicionar produto')
      }

      await loadData()
    } catch (err: any) {
      console.error('Erro ao adicionar produto:', err)
      
      // Verificar se é erro de timeout
      const isTimeout = err?.message?.includes('timeout') || 
                       err?.message?.includes('aborted') || 
                       err?.name === 'AbortError' ||
                       err?.message?.includes('network') ||
                       err?.message?.includes('fetch')
      
      if (isTimeout) {
        throw new Error('Esta operação passou do limite de tempo para ser concluída. Por favor, tente novamente.')
      }
      
      throw err
    }
  }

  const updateProduct = async (id: string, updates: Partial<Product>) => {
    try {
      // ✅ AGORA USA EDGE FUNCTION (SEGURO - apenas admins!)
      const { data: response, error } = await (supabase.functions.invoke as any)('manage-products', {
        method: 'PUT',
        body: {
          id,
          ...updates
        }
      })

      if (error) {
        console.error('Edge function error:', error)
        
        // Verificar se é erro de timeout
        const isTimeout = (error as any).message?.includes('timeout') || 
                         (error as any).message?.includes('aborted') || 
                         (error as any).name === 'AbortError' ||
                         (error as any).message?.includes('network') ||
                         (error as any).message?.includes('fetch')
        
        if (isTimeout) {
          throw new Error('Esta operação passou do limite de tempo para ser concluída. Por favor, tente novamente.')
        }
        
        throw new Error((error as any).message || 'Erro ao atualizar produto')
      }

      if (!response?.success) {
        throw new Error((response as any)?.error || 'Erro ao atualizar produto')
      }

      await loadData()
    } catch (err: any) {
      console.error('Erro ao atualizar produto:', err)
      
      // Verificar se é erro de timeout
      const isTimeout = err?.message?.includes('timeout') || 
                       err?.message?.includes('aborted') || 
                       err?.name === 'AbortError' ||
                       err?.message?.includes('network') ||
                       err?.message?.includes('fetch')
      
      if (isTimeout) {
        throw new Error('Esta operação passou do limite de tempo para ser concluída. Por favor, tente novamente.')
      }
      
      throw err
    }
  }

  const deleteProduct = async (id: string) => {
    try {
      // ✅ AGORA USA EDGE FUNCTION (SEGURO - apenas admins!)
      const { data: response, error } = await (supabase.functions.invoke as any)('manage-products', {
        method: 'DELETE',
        body: { id }
      })

      if (error) {
        console.error('Edge function error:', error)
        
        // Verificar se é erro de timeout
        const isTimeout = (error as any).message?.includes('timeout') || 
                         (error as any).message?.includes('aborted') || 
                         (error as any).name === 'AbortError' ||
                         (error as any).message?.includes('network') ||
                         (error as any).message?.includes('fetch')
        
        if (isTimeout) {
          throw new Error('Esta operação passou do limite de tempo para ser concluída. Por favor, tente novamente.')
        }
        
        throw new Error((error as any).message || 'Erro ao deletar produto')
      }

      if (!response?.success) {
        throw new Error((response as any)?.error || 'Erro ao deletar produto')
      }

      await loadData()
    } catch (err: any) {
      console.error('Erro ao deletar produto:', err)
      
      // Verificar se é erro de timeout
      const isTimeout = err?.message?.includes('timeout') || 
                       err?.message?.includes('aborted') || 
                       err?.name === 'AbortError' ||
                       err?.message?.includes('network') ||
                       err?.message?.includes('fetch')
      
      if (isTimeout) {
        throw new Error('Esta operação passou do limite de tempo para ser concluída. Por favor, tente novamente.')
      }
      
      throw err
    }
  }

  const getProducts = (category: 'lojinha' | 'lanchonete'): Product[] => {
    return data.products[category].filter(p => p.active)
  }

  // ✅ Agora usa Edge Function via api-client
  const makeSale = async (userId: string, items: Omit<SaleItem, 'id'>[], category: 'lojinha' | 'lanchonete', coupon: string, discountedTotal: number) => {
    
    // VALIDAÇÕES BÁSICAS
    if (!userId) {
      throw new Error('Usuário não informado')
    }
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new Error('Nenhum item selecionado para venda')
    }
    
    if (!category) {
      throw new Error('Categoria não informada')
    }
    
    try {
      const { api } = await import('../lib/api-client')
      
      const response = await api.createSale({
        userId,
        items: items.map(item => ({
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          price: item.price
        })),
        category,
        coupon: coupon || undefined,
        discountedTotal: discountedTotal || undefined
      })

      if (!response.success) throw new Error((response as any).error || 'Erro ao criar venda')

      await loadData()
      return response.data.saleId || ''
    } catch (err: any) {
      console.error('Erro ao fazer venda:', err)
      throw err
    }
  }

  // ⚠️ DEPRECATED: Use api.listSales() do api-client.ts em vez disso
  // Mantido apenas para compatibilidade com código legado
  const getSales = async (category?: 'lojinha' | 'lanchonete', limit: number = 100): Promise<Sale[]> => {
    console.warn('⚠️ SupabaseDataContext.getSales() está DEPRECATED. Use api.listSales() do api-client.ts')
    
    try {
      const { api } = await import('../lib/api-client')
      const response = await api.listSales(category)
      
      if (!response.success) {
        const errorMsg = (response as any).error || 'Erro ao buscar vendas'
        console.warn('Erro ao buscar vendas:', errorMsg)
        // Retornar array vazio ao invés de lançar erro - não quebrar a UI
        return []
      }

      // Transformar dados da Edge Function para o formato esperado
      const sales = (response.data || []).slice(0, limit).map((sale: any) => {
        // Mapear formato da Edge Function para formato esperado
        return {
          id: sale.id,
          userId: sale.user_id,
          customerName: sale.user_name || sale.customer_name,
          customerEmail: sale.user_email || sale.email,
          sellerId: sale.seller_id,
          saleId: sale.sale_number || sale.id,
          category: sale.category || category || 'lojinha',
          items: (sale.sale_items || []).map((item: any) => ({
            id: item.id,
            productId: item.product_id || '',
            productName: item.product_name,
            quantity: item.quantity,
            price: parseFloat(item.price) || 0
          })),
          total: parseFloat(sale.total) || 0,
          status: sale.status,
          createdAt: sale.created_at,
        } as Sale
      })
      
      return sales
    } catch (error) {
      console.error('Erro ao buscar vendas:', error)
      // Retornar array vazio ao invés de lançar erro - não quebrar a UI
      return []
    }
  }

  // ⚠️ DEPRECATED: Use api.listSales(undefined, userId) do api-client.ts em vez disso
  // Mantido apenas para compatibilidade com código legado
  const getSalesByUserId = async (userId: string, limit: number = 50): Promise<Sale[]> => {
    console.warn('SupabaseDataContext.getSalesByUserId() está obsoleto. Use api.listSales(undefined, userId)')
    
    try {
      const { api } = await import('../lib/api-client')
      const response = await api.listSales(undefined, userId)
      
      if (!response.success) {
        throw new Error((response as any).error || 'Erro ao buscar vendas')
      }

      // Transformar e ordenar
      const sales = (response.data || [])
        .slice(0, limit)
        .sort((a: any, b: any) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
        .map((sale: any) => ({
          id: sale.id,
          userId: sale.user_id,
          customerName: sale.user_name || sale.customer_name,
          customerEmail: sale.user_email || sale.email,
          sellerId: sale.seller_id,
          saleId: sale.sale_number || sale.id,
          category: sale.category || 'lojinha',
          items: (sale.sale_items || []).map((item: any) => ({
            id: item.id,
            productId: item.product_id || '',
            productName: item.product_name,
            quantity: item.quantity,
            price: parseFloat(item.price) || 0
          })),
          total: parseFloat(sale.total) || 0,
          status: sale.status,
          createdAt: sale.created_at,
        } as Sale))
      
      return sales
    } catch (error) {
      console.error('Erro ao buscar vendas da conta:', error)
      return []
    }
  }

  // Funções de pedidos
  // Função helper para gerar código sequencial de pedido
  // ⚠️ REMOVIDO: generateOrderCode() - A geração de código agora é feita pela Edge Function make-sale
  // Este método não é mais usado

 // ⚠️ DEPRECATED: Use api.getOpenOrders() ou api.listOrders('lojinha') do api-client.ts em vez disso
 // Mantido apenas para compatibilidade com código legado
 const getOpenOrders = async (): Promise<Order[]> => {
  console.warn('⚠️ SupabaseDataContext.getOpenOrders() está DEPRECATED. Use api.getOpenOrders() ou api.listOrders() do api-client.ts')
  
  try {
    const { api } = await import('../lib/api-client')
    const response = await api.listSales('lojinha')
    console.log(response)
    
    if (!response.success) {
      throw new Error((response as any).error || 'Erro ao buscar pedidos')
    }

    // Filtrar apenas pedidos completos (não entregues) e formatar
    const orders = (response.data || [])
      .filter((order: any) => order.status === 'completed')
      .map((order: any) => ({
        id: order.id,
        saleId: order.sale_id || order.id,
        saleNumber: order.sale_number,
        orderCode: order.order_code || null,
        userId: order.user_id,
        customerName: order.user_name || order.customer_name || 'Cliente',
        items: (order.sale_items || []).map((item: any) => ({
          productId: item.product_id,
          productName: item.product_name,
          quantity: item.quantity,
          price: parseFloat(item.price) || 0
        })),
        total: parseFloat(order.total) || 0,
        status: 'completed' as const,
        createdAt: order.created_at,
        deliveredAt: order.delivered_at || null
      } as Order))

    return orders

  } catch (err) {
    console.error('Error in getOpenOrders:', err)
    throw err
  }
}

  // ✅ Agora usa Edge Function via api-client
  const markAsDelivered = async (orderId: string) => {
    try {
      const { api } = await import('../lib/api-client')
      const response = await api.markOrderAsDelivered(orderId)

      if (!response.success) throw new Error((response as any).error || 'Erro ao marcar como entregue')

      await loadData()
    } catch (err: any) {
      console.error('Erro ao marcar como entregue:', err)
      
      // Verificar se é erro de timeout
      const isTimeout = err?.message?.includes('timeout') || 
                       err?.message?.includes('aborted') || 
                       err?.name === 'AbortError' ||
                       err?.message?.includes('network') ||
                       err?.message?.includes('fetch')
      
      if (isTimeout) {
        throw new Error('Esta operação passou do limite de tempo para ser concluída. Por favor, tente novamente.')
      }
      
      throw err
    }
  }

  const getAccountByUserId = useCallback(async (userId: string): Promise<UserAccount | null> => {
    const { api } = await import('../lib/api-client')
    const response = await api.getAccountByUserId(userId)
    if (!response.success) throw new Error((response as any).error || 'Erro ao buscar conta')
    return response.data ? mapUserAccount(response.data) : null
  }, [])

  const searchAccountsByName = async (name: string): Promise<UserAccount[]> => {
    if (name.trim().length < 2) return []
    const { api } = await import('../lib/api-client')
    const response = await api.listAccounts(name.trim())
    if (!response.success) throw new Error((response as any).error || 'Erro ao buscar contas')
    if (!response.data) return []
    return response.data.map(mapUserAccount)
  }

  // ✅ Buscar cupons via Edge Function
  const getCoupons = async (category?: 'lojinha' | 'lanchonete'): Promise<Array<{ name: string; discountAmount?: number }>> => {
    try {
      const { api } = await import('../lib/api-client')
      const response = await api.listCoupons(category)
      
      if (!response.success) {
        console.error('Erro ao buscar cupons:', (response as any).error)
        return []
      }
      
      return response.data || []
    } catch (err) {
      console.error('Erro ao buscar cupons:', err)
      // Retornar array vazio em caso de erro (não quebrar a aplicação)
      return []
    }
  }

  const updateUserBalance = async (userId: string, amount: number, type: 'credit' | 'debit', description?: string): Promise<void> => {
    try {
      const { api } = await import('../lib/api-client')
      const response = await api.updateBalance({
        userId,
        amount,
        type,
        description: description || (type === 'credit' ? 'Crédito' : 'Débito'),
      })

      if (!response.success) {
        throw new Error((response as any).error || 'Erro ao atualizar saldo')
      }

      await loadData()
    } catch (err: any) {
      console.error('Erro ao atualizar saldo:', err)
      
      // Verificar se é erro de timeout
      const isTimeout = err?.message?.includes('timeout') || 
                       err?.message?.includes('aborted') || 
                       err?.name === 'AbortError' ||
                       err?.message?.includes('network') ||
                       err?.message?.includes('fetch')
      
      if (isTimeout) {
        throw new Error('Esta operação passou do limite de tempo para ser concluída. Por favor, tente novamente.')
      }
      
      throw err
    }
  }

  // Utilitários
  const resetData = async () => {
    // Não implementar reset em produção
    console.warn('Reset de dados não implementado para Supabase')
  }

  const loadSeedData = async () => {
    try {
      const { api } = await import('../lib/api-client')
      const existingProducts = await api.listProducts()
      if (existingProducts.success && existingProducts.data.length > 0) {
        return // Já tem dados
      }

      // Inserir produtos de exemplo
      const seedProducts = [
        // Produtos Lojinha
        { name: 'Camiseta Encontrão', price: 25.00, category: 'lojinha', description: 'Camiseta oficial', active: true },
        { name: 'Caneca Personalizada', price: 15.00, category: 'lojinha', description: 'Caneca com logo', active: true },
        { name: 'Chaveiro', price: 5.00, category: 'lojinha', description: 'Chaveiro do evento', active: true },
        
        // Produtos Lanchonete
        { name: 'Hambúrguer', price: 12.00, category: 'lanchonete', description: 'Hambúrguer artesanal', active: true },
        { name: 'Refrigerante', price: 4.00, category: 'lanchonete', description: 'Lata 350ml', active: true },
        { name: 'Batata Frita', price: 8.00, category: 'lanchonete', description: 'Porção média', active: true }
      ]

      for (const product of seedProducts) {
        const response = await api.manageProducts(product)
        if (!response.success) throw new Error((response as any).error || 'Erro ao inserir produto')
      }
      await loadData()
    } catch (err) {
      console.error('Erro ao carregar dados seed:', err)
      throw err
    }
  }

  const value: SupabaseDataContextType = {
    data,
    isLoading,
    error,
    addBalance,
    getBalance,
    getTransactions,
    addProduct,
    updateProduct,
    deleteProduct,
    getProducts,
    makeSale,
    getCoupons,
    getSales,
    getSalesByUserId,
    getOpenOrders,
    markAsDelivered,
    getAccountByUserId,
    searchAccountsByName,
    updateUserBalance,
    resetData,
    loadSeedData
  }

  return (
    <SupabaseDataContext.Provider value={value}>
      {children}
    </SupabaseDataContext.Provider>
  )
}
