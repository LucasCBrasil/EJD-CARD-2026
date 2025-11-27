import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

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
  category: 'lojinha' | 'lanchonete' | 'sapatinho'
  items: SaleItem[]
  total: number
  status: 'completed' | 'delivered'
  createdAt: string
  card?: {
    cardNumber?: string
    userName?: string
  }
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

export interface Card {
  id: string
  userId: string
  userName: string
  cardNumber: string
  phoneNumber: string
  balance: number
  createdAt: string
  updatedAt: string
}

export interface AppData {
  balances: Map<string, { balance: number; transactions: Transaction[] }>
  products: {
    lojinha: Product[]
    lanchonete: Product[]
  }
  sales: Sale[]
  orders: Order[]
  cards: Card[]
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
  getSales: (category?: 'lojinha' | 'lanchonete' | 'sapatinho', limit?: number) => Promise<Sale[]>
  getSalesByCardId: (cardId: string, limit?: number) => Promise<Sale[]>
  
  // Funções de pedidos
  getOpenOrders: () => Promise<Order[]>
  markAsDelivered: (orderId: string) => Promise<void>

  // Funções de cupons
  getCoupons: (category?: 'lojinha' | 'lanchonete') => Promise<Array<{ name: string; discountAmount?: number }>>
  
  // Funções de cartão
  getCardByUserId: (userId: string) => Card | null
  createCard: (params: { name: string; cardNumber: string; cardCode: string; phoneNumber: string; initialBalance?: number }) => Promise<Card>
  associateCard: (params: { cardNumber: string; cardCode: string }) => Promise<Card>
  getCardByNumber: (cardNumber: string) => Promise<Card | null>
  updateCardBalance: (cardId: string, amount: number, type: 'credit' | 'debit', description?: string) => Promise<void>
  
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

export const SupabaseDataProvider: React.FC<SupabaseDataProviderProps> = ({ children }) => {
  const [data, setData] = useState<AppData>({
    balances: new Map(),
    products: { lojinha: [], lanchonete: [] },
    sales: [],
    orders: [],
    cards: [],
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

  // ⚠️ DEPRECATED: loadData ainda faz queries diretas - idealmente deveria usar Edge Functions
  // Mantido para compatibilidade, mas carrega apenas dados básicos
  // Dados completos devem ser carregados via getSales(), getOpenOrders(), etc. (que usam Edge Functions)
  const loadData = async () => {
    try {
      setIsLoading(true)
      setError(null)

      // ⚠️ NOTA: Esta função ainda usa queries diretas para compatibilidade
      // Idealmente deveria usar Edge Functions, mas isso quebraria código legado
      // Dados críticos (sales, orders, transactions) já são carregados via Edge Functions em outros métodos
      
      // Carregar apenas dados básicos (cards e produtos) - exposição limitada
      // Para dados sensíveis, use os métodos específicos que usam Edge Functions
      const { api } = await import('../lib/api-client')
      
      // Carregar cartões via Edge Function
      const cardsResponse = await api.listCards()
      if (!cardsResponse.success) throw new Error(cardsResponse.error || 'Erro ao carregar cartões')
      const cards = cardsResponse.data || []

      // Carregar produtos via Edge Function (apenas lojinha e lanchonete para compatibilidade)
      const [lojinhaResponse, lanchoneteResponse] = await Promise.all([
        api.listProducts('lojinha').catch(() => ({ success: false, data: [] })),
        api.listProducts('lanchonete').catch(() => ({ success: false, data: [] }))
      ])
      
      const lojinhaProducts = lojinhaResponse.success ? lojinhaResponse.data || [] : []
      const lanchoneteProducts = lanchoneteResponse.success ? lanchoneteResponse.data || [] : []

      // Processar apenas dados essenciais carregados
      const balances = new Map<string, { balance: number; transactions: Transaction[] }>()
      
      // Inicializar saldos dos cartões
      cards.forEach((card: any) => {
        if (!balances.has(card.id)) {
          balances.set(card.id, { balance: parseFloat(card.balance) || 0, transactions: [] })
        }
      })

      // Processar produtos
      const productsByCategory = {
        lojinha: lojinhaProducts.map((p: any) => ({
          id: p.id,
          name: p.name,
          price: parseFloat(p.price) || 0,
          category: 'lojinha',
          description: p.description,
          stock: p.stock || 0,
          active: p.active !== false,
          createdAt: p.created_at,
        })),
        lanchonete: lanchoneteProducts.map((p: any) => ({
          id: p.id,
          name: p.name,
          price: parseFloat(p.price) || 0,
          category: 'lanchonete',
          description: p.description,
          stock: p.stock || 0,
          active: p.active !== false,
          createdAt: p.created_at,
        }))
      }

      // Mapear cartões
      const mappedCards: Card[] = cards.map((card: any) => ({
        id: card.id,
        userId: card.user_id || '',
        userName: card.user_name || '',
        cardNumber: card.card_number || '',
        phoneNumber: card.phone_number || '',
        balance: parseFloat(card.balance) || 0,
        createdAt: card.created_at || '',
        updatedAt: card.updated_at || ''
      }))

      // Cupons ainda precisam ser carregados (não temos Edge Function ainda)
      // Por enquanto retornar array vazio - cupons devem ser carregados via getCoupons()
      setData({
        balances,
        products: productsByCategory,
        sales: [], // Será carregado sob demanda via getSales() (Edge Function)
        orders: [], // Será carregado sob demanda via getOpenOrders() (Edge Function)
        cards: mappedCards,
        coupons: [] // Será carregado sob demanda via getCoupons()
      })

    } catch (err) {
      console.error('Erro ao carregar dados:', err)
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setIsLoading(false)
    }
  }

  // ✅ Agora usa Edge Function via api-client
  const addBalance = async (userId: string, amount: number, description: string, createdBy?: string) => {
    try {
      // Buscar cartão do usuário primeiro
      const { api } = await import('../lib/api-client')
      const cardResponse = await api.getCardByUserId(userId)
      
      if (!cardResponse.success || !cardResponse.data) {
        throw new Error('Cartão não encontrado')
      }

      const card = cardResponse.data

      // Usar Edge Function para atualizar saldo (seguro!)
      const response = await api.updateBalance({
        action: amount > 0 ? 'credit' : 'debit',
        cardId: card.id,
        amount: Math.abs(amount),
        description: description || (amount > 0 ? 'Crédito' : 'Débito'),
      })

      if (!response.success) {
        throw new Error(response.error || 'Erro ao atualizar saldo')
      }

      // Recarregar dados
      await loadData()
    } catch (err) {
      console.error('Erro ao adicionar saldo:', err)
      throw err
    }
  }

  const getBalance = (userId: string): number => {
    const card = data.cards.find(c => c.userId === userId)
    return card?.balance || 0
  }

  const getTransactions = (userId: string): Transaction[] => {
    const card = data.cards.find(c => c.userId === userId)
    if (!card) return []
    return data.balances.get(card.id)?.transactions || []
  }

  // Funções de produtos
  const addProduct = async (product: Omit<Product, 'id' | 'createdAt'>) => {
    try {
      // ✅ AGORA USA EDGE FUNCTION (SEGURO - apenas admins!)
      const { data: response, error } = await supabase.functions.invoke('manage-products', {
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
        throw new Error(error.message || 'Erro ao adicionar produto')
      }

      if (!response?.success) {
        throw new Error(response?.error || 'Erro ao adicionar produto')
      }

      await loadData()
    } catch (err) {
      console.error('Erro ao adicionar produto:', err)
      throw err
    }
  }

  const updateProduct = async (id: string, updates: Partial<Product>) => {
    try {
      // ✅ AGORA USA EDGE FUNCTION (SEGURO - apenas admins!)
      const { data: response, error } = await supabase.functions.invoke('manage-products', {
        method: 'PUT',
        body: {
          id,
          ...updates
        }
      })

      if (error) {
        console.error('Edge function error:', error)
        throw new Error(error.message || 'Erro ao atualizar produto')
      }

      if (!response?.success) {
        throw new Error(response?.error || 'Erro ao atualizar produto')
      }

      await loadData()
    } catch (err) {
      console.error('Erro ao atualizar produto:', err)
      throw err
    }
  }

  const deleteProduct = async (id: string) => {
    try {
      // ✅ AGORA USA EDGE FUNCTION (SEGURO - apenas admins!)
      const { data: response, error } = await supabase.functions.invoke('manage-products', {
        method: 'DELETE',
        body: { id }
      })

      if (error) {
        console.error('Edge function error:', error)
        throw new Error(error.message || 'Erro ao deletar produto')
      }

      if (!response?.success) {
        throw new Error(response?.error || 'Erro ao deletar produto')
      }

      await loadData()
    } catch (err) {
      console.error('Erro ao deletar produto:', err)
      throw err
    }
  }

  const getProducts = (category: 'lojinha' | 'lanchonete'): Product[] => {
    return data.products[category].filter(p => p.active)
  }

  // ✅ Agora usa Edge Function via api-client
  const makeSale = async (userId: string, items: Omit<SaleItem, 'id'>[], category: 'lojinha' | 'lanchonete', coupon: string, discountedTotal: number) => {
    console.log('userId:', userId);
    console.log('items:', items);
    console.log('category:', category);
    try {
      // Buscar cartão do usuário primeiro
      const { api } = await import('../lib/api-client')
      const cardResponse = await api.getCardByUserId(userId)
      
      if (!cardResponse.success || !cardResponse.data) {
        throw new Error('Cartão não encontrado')
      }

      // Chamar Edge Function para fazer venda
      const response = await api.createSale({
        cardId: cardResponse.data.id,
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

      if (!response.success) throw new Error(response.error || 'Erro ao criar venda')

      await loadData()
      return response.data.saleId || ''
    } catch (err: any) {
      console.error('Erro ao fazer venda:', err)
      throw err
    }
  }

  // ⚠️ DEPRECATED: Use api.listSales() do api-client.ts em vez disso
  // Mantido apenas para compatibilidade com código legado
  const getSales = async (category?: 'lojinha' | 'lanchonete' | 'sapatinho', limit: number = 100): Promise<Sale[]> => {
    console.warn('⚠️ SupabaseDataContext.getSales() está DEPRECATED. Use api.listSales() do api-client.ts')
    
    try {
      const { api } = await import('../lib/api-client')
      const response = await api.listSales(category)
      
      if (!response.success) {
        throw new Error(response.error || 'Erro ao buscar vendas')
      }

      // Transformar dados da Edge Function para o formato esperado
      const sales = (response.data || []).slice(0, limit).map((sale: any) => {
        // Mapear formato da Edge Function para formato esperado
        return {
          id: sale.id,
          userId: sale.card_id,
          sellerId: sale.seller_id,
          saleId: sale.sale_number || sale.id,
          category: sale.category || category || 'lojinha',
          items: ((sale.sale_items || sale.sapatinho_sale_items) || []).map((item: any) => ({
            id: item.id,
            productId: item.product_id || '',
            productName: item.product_name,
            quantity: item.quantity,
            price: parseFloat(item.price) || 0
          })),
          total: parseFloat(sale.total) || 0,
          status: sale.status,
          createdAt: sale.created_at,
          card: sale.cards || null,
        } as Sale
      })
      
      return sales
    } catch (error) {
      console.error('Erro ao buscar vendas:', error)
      throw error
    }
  }

  // ⚠️ DEPRECATED: Use api.listSales(undefined, cardId) do api-client.ts em vez disso
  // Mantido apenas para compatibilidade com código legado
  const getSalesByCardId = async (cardId: string, limit: number = 50): Promise<Sale[]> => {
    console.warn('⚠️ SupabaseDataContext.getSalesByCardId() está DEPRECATED. Use api.listSales(undefined, cardId) do api-client.ts')
    
    try {
      const { api } = await import('../lib/api-client')
      const response = await api.listSales(undefined, cardId)
      
      if (!response.success) {
        throw new Error(response.error || 'Erro ao buscar vendas')
      }

      // Transformar e ordenar
      const sales = (response.data || [])
        .slice(0, limit)
        .sort((a: any, b: any) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
        .map((sale: any) => ({
          id: sale.id,
          userId: sale.card_id,
          sellerId: sale.seller_id,
          saleId: sale.sale_number || sale.id,
          category: sale.category || 'lojinha',
          items: ((sale.sale_items || sale.sapatinho_sale_items) || []).map((item: any) => ({
            id: item.id,
            productId: item.product_id || '',
            productName: item.product_name,
            quantity: item.quantity,
            price: parseFloat(item.price) || 0
          })),
          total: parseFloat(sale.total) || 0,
          status: sale.status,
          createdAt: sale.created_at,
          card: sale.card || null,
        } as Sale))
      
      return sales
    } catch (error) {
      console.error('Erro ao buscar vendas do cartão:', error)
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
      throw new Error(response.error || 'Erro ao buscar pedidos')
    }

    // Filtrar apenas pedidos completos (não entregues) e formatar
    const orders = (response.data || [])
      .filter((order: any) => order.status === 'completed')
      .map((order: any) => ({
        id: order.id,
        saleId: order.sale_id || order.id,
        saleNumber: order.sale_number,
        orderCode: order.order_code || null,
        userId: order.card_id,
        customerName: order.cards.user_name || 'Cliente',
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

      if (!response.success) throw new Error(response.error || 'Erro ao marcar como entregue')

      await loadData()
    } catch (err: any) {
      console.error('Erro ao marcar como entregue:', err)
      throw err
    }
  }

  // Funções de cartão
  const getCardByUserId = (userId: string): Card | null => {
    return data.cards.find(c => c.userId === userId) || null
  }

  // ✅ Agora usa Edge Function via api-client
  const createCard = async (params: { name: string; cardNumber: string; cardCode: string; phoneNumber: string; initialBalance?: number }): Promise<Card> => {
    try {
      const { api } = await import('../lib/api-client')
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

      await loadData()
      const cardData = response.data.card || response.data
      return {
        id: cardData.id,
        userId: cardData.user_id || '',
        userName: cardData.user_name || '',
        cardNumber: cardData.card_number || '',
        phoneNumber: cardData.phone_number || '',
        balance: parseFloat(cardData.balance) || 0,
        createdAt: cardData.created_at || '',
        updatedAt: cardData.updated_at || ''
      } as Card
    } catch (err: any) {
      console.error('Erro ao criar cartão:', err)
      throw err
    }
  }

  // Associação de cartão existente ao usuário atual
  // ✅ Agora usa Edge Function via api-client
  const associateCard = async (params: { cardNumber: string; cardCode: string }): Promise<Card> => {
    try {
      const { api } = await import('../lib/api-client')
      const response = await api.associateCard(params)
      
      if (!response.success) {
        throw new Error(response.error || 'Erro ao associar cartão')
      }

      // Transformar resposta para formato esperado
      const cardData = response.data
      const mappedCard: Card = {
        id: cardData.id,
        userId: cardData.user_id || '',
        userName: cardData.user_name || '',
        cardNumber: cardData.card_number || '',
        phoneNumber: cardData.phone_number || '',
        balance: parseFloat(cardData.balance) || 0,
        createdAt: cardData.created_at || '',
        updatedAt: cardData.updated_at || ''
      }

      await loadData()
      return mappedCard
    } catch (err: any) {
      console.error('Erro ao associar cartão:', err)
      throw err
    }
  }

  // ✅ Agora usa Edge Function via api-client
  const getCardByNumber = async (cardNumber: string): Promise<Card | null> => {
    try {
      const { api } = await import('../lib/api-client')
      const response = await api.getCardByNumber(cardNumber)
      
      if (!response.success || !response.data) {
        return null
      }

      const cardData = response.data
      console.log('card:', cardData);
      return {
        id: cardData.id,
        userId: cardData.user_id || '',
        userName: cardData.user_name || '',
        cardNumber: cardData.card_number || '',
        phoneNumber: cardData.phone_number || '',
        balance: parseFloat(cardData.balance) || 0,
        createdAt: cardData.created_at || '',
        updatedAt: cardData.updated_at || ''
      }
    } catch (err) {
      console.error('Erro ao buscar cartão:', err)
      return null
    }
  }

  // Buscar cupons
  const getCoupons = async (category?: 'lojinha' | 'lanchonete'): Promise<Array<{ name: string; discountAmount?: number }>> => {
    try {
      if (category === 'lanchonete') {
        // Buscar cupons da lanchonete (com valor fixo)
        const { data, error } = await supabase
          .from('lanchonete_coupons')
          .select('name, discount_amount')
          .eq('active', true)
          .order('created_at', { ascending: false })
        
        if (error) throw error
        
        return (data || []).map((item: { name: string; discount_amount: number }) => ({
          name: item.name,
          discountAmount: parseFloat(item.discount_amount.toString())
        }))
      } else {
        // Buscar cupons da lojinha (percentual)
        const { data, error } = await supabase
          .from('coupons')
          .select('name')
          .order('created_at', { ascending: false })
        
        if (error) throw error
        
        return (data || []).map((item: { name: string }) => ({
          name: item.name
        }))
      }
    } catch (err) {
      console.error('Erro ao buscar cupons:', err)
      throw err
    }
  }

  // ✅ Agora usa Edge Function via api-client
  const updateCardBalance = async (cardId: string, amount: number, type: 'credit' | 'debit', description?: string): Promise<void> => {
    try {

      console.log('cardId:', cardId)
      console.log('amount:', amount)
      console.log('type:', type)
      const { api } = await import('../lib/api-client')
      const response = await api.updateBalance({
        cardId,
        amount,
        type: type,
        description: description || (type === 'credit' ? 'Crédito' : 'Débito'),
      })

      if (!response.success) {
        throw new Error(response.error || 'Erro ao atualizar saldo')
      }

      await loadData()
    } catch (err: any) {
      console.error('Erro ao atualizar saldo:', err)
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
      // Verificar se já existem produtos
      const { data: existingProducts } = await supabase
        .from('products')
        .select('id')
        .limit(1)

      if (existingProducts && existingProducts.length > 0) {
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

      const { error } = await supabase
        .from('products')
        .insert(seedProducts)

      if (error) throw error
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
    getSalesByCardId,
    getOpenOrders,
    markAsDelivered,
    getCardByUserId,
    createCard,
    associateCard,
    getCardByNumber,
    updateCardBalance,
    resetData,
    loadSeedData
  }

  return (
    <SupabaseDataContext.Provider value={value}>
      {children}
    </SupabaseDataContext.Provider>
  )
}
