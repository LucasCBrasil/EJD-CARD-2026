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
  product_name?: string
  quantity: number
  price: number
  image?: string | null
}

export interface Sale {
  id: string
  userId: string
  sellerId: string
  saleId?: string
  sale_id?: string
  category: 'lojinha' | 'lanchonete' | 'sapatinho'
  items: SaleItem[]
  total: number
  status: 'completed' | 'delivered'
  createdAt: string
  created_at?: string
  card?: {
    card_number?: string
    user_name?: string
  }
  seller?: {
    id: string
    name: string
    email: string
  }
}

export interface Order {
  id: string
  saleId: string
  orderCode?: string
  sale?: any
  userId: string
  customerName: string
  customer_name?: string
  items: SaleItem[]
  total: number
  status: 'pending' | 'completed' | 'delivered'
  createdAt: string
  created_at?: string
  deliveredAt?: string
}

export interface Card {
  id: string
  userId: string
  user_id?: string
  userName: string
  user_name?: string
  cardNumber: string
  card_number?: string
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

  const loadData = async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Carregar apenas dados essenciais no início (cards e produtos)
      // Vendas, transações e pedidos serão carregados sob demanda
      
      // Carregar cartões
      const { data: cards, error: cardsError } = await supabase
        .from('cards')
        .select('*')
        .order('created_at', { ascending: false })

      if (cardsError) throw cardsError

      // Carregar produtos
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('*')
        .eq('active', true)
        .order('created_at', { ascending: false })

      if (productsError) throw productsError

      // Carregar cupons
      const { data: coupons, error: couponsError } = await supabase
        .from('coupons')
        .select('name')
        .order('created_at', { ascending: false })

      if (couponsError) throw couponsError

      // Processar apenas dados essenciais carregados
      const balances = new Map<string, { balance: number; transactions: Transaction[] }>()
      
      // Inicializar saldos dos cartões
      cards?.forEach(card => {
        if (!balances.has(card.id)) {
          balances.set(card.id, { balance: card.balance || 0, transactions: [] })
        }
      })

      // Processar produtos
      const productsByCategory = {
        lojinha: products?.filter(p => p.category === 'lojinha') || [],
        lanchonete: products?.filter(p => p.category === 'lanchonete') || []
      }

      // Mapear cartões do formato Supabase (snake_case) para formato Card (camelCase)
      const mappedCards: Card[] = (cards || []).map((card: any) => ({
        id: card.id,
        userId: card.user_id || '',
        userName: card.user_name || '',
        cardNumber: card.card_number || '',
        phoneNumber: card.phone_number || '',
        balance: parseFloat(card.balance) || 0,
        createdAt: card.created_at || '',
        updatedAt: card.updated_at || ''
      }))

      setData({
        balances,
        products: productsByCategory,
        sales: [], // Será carregado sob demanda via getSales()
        orders: [], // Será carregado sob demanda via getOpenOrders()
        cards: mappedCards,
        coupons: coupons?.map(c => c.name) || []
      })

    } catch (err) {
      console.error('Erro ao carregar dados:', err)
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setIsLoading(false)
    }
  }

  // Funções de saldo
  const addBalance = async (userId: string, amount: number, description: string, createdBy?: string) => {
    try {
      // Buscar cartão do usuário
      const { data: card, error: cardError } = await supabase
        .from('cards')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (cardError) throw cardError

      // Criar transação
      const { error: transactionError } = await supabase
        .from('transactions')
        .insert({
          card_id: card.id,
          amount,
          type: amount > 0 ? 'credit' : 'debit',
          description,
          created_by: createdBy
        })

      if (transactionError) throw transactionError

      // Atualizar saldo do cartão
      const { error: balanceError } = await supabase
        .from('cards')
        .update({
          balance: card.balance - amount, // TODO: Implementar incremento correto
          updated_at: new Date().toISOString()
        })
        .eq('id', card.id)

      if (balanceError) throw balanceError

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

  // Funções de vendas
  const makeSale = async (userId: string, items: Omit<SaleItem, 'id'>[], category: 'lojinha' | 'lanchonete', coupon: string, discountedTotal: number) => {
    // ✅ AGORA USA EDGE FUNCTION (SEGURO!)
    // Chama função na nuvem que valida tudo antes de criar a venda
    const { data: response, error } = await supabase.functions.invoke('make-sale', {
      body: {
        cardId: userId,
        items: items.map(item => ({
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          price: item.price
        })),
        category,
        coupon,
        discountedTotal
      }
    })

    if (error) {
      console.error('Edge function error:', error)
      throw new Error(error.message || 'Erro ao criar venda')
    }

    if (!response?.success) {
      throw new Error(response?.error || 'Erro ao criar venda')
    }

    // Recarregar dados após venda
    await loadData()

    // Retornar ID da venda criada
    return response.data.saleId
  }

  const getSales = async (category?: 'lojinha' | 'lanchonete' | 'sapatinho', limit: number = 100): Promise<Sale[]> => {
    if (category) {
      // Para sapatinho, usar tabelas diferentes COM JOINs (evita N+1)
      if (category === 'sapatinho') {
        const { data: salesData, error: salesError } = await supabase
          .from('sapatinho_sales')
          .select(`
            *,
            card: cards!sapatinho_sales_card_id_fkey (
              id,
              card_number,
              user_name
            ),
            items: sapatinho_sale_items (
              id,
              product_id,
              product_name,
              quantity,
              price
            ),
            order: sapatinho_veloz_orders!sapatinho_veloz_orders_sale_id_fkey (
              message,
              sender_name,
              sender_team,
              recipient_name,
              recipient_address
            )
          `)
          .order('created_at', { ascending: false })
          .limit(limit)
        
        if (salesError) {
          console.error('Erro ao buscar vendas do sapatinho:', salesError)
          throw salesError
        }
        
        // Processar dados já carregados em 1 query
        const salesWithDetails = (salesData || []).map((sale: any) => ({
          ...sale,
          sale_id: sale.id,
          category: 'sapatinho',
          card: sale.card || null,
          items: (sale.items || []).map((item: any) => ({
            id: item.id,
            productId: item.product_id,
            productName: item.product_name,
            product_name: item.product_name,
            quantity: item.quantity,
            price: parseFloat(item.price) || 0
          })),
          message: sale.order?.message || null,
          senderName: sale.order?.sender_name || null,
          senderTeam: sale.order?.sender_team || null,
          recipientName: sale.order?.recipient_name || null,
          recipientAddress: sale.order?.recipient_address || null,
          seller: {
            id: sale.seller_id,
            name: sale.seller_id,
            email: ''
          }
        }))
        
        return salesWithDetails
      }
      
      // Para lojinha e lanchonete, usar tabela sales normal COM JOIN de seller (evita N+1)
      const { data: salesData, error: salesError } = await supabase
        .from('sales')
        .select(`
          *,
          card: cards!sales_card_id_fkey (
            id,
            card_number,
            user_name
          ),
          items: sale_items (
            id,
            product_id,
            product_name,
            quantity,
            price
          ),
          seller: app_users!sales_seller_id_fkey (
            id,
            name,
            email
          )
        `)
        .eq('category', category)
        .order('created_at', { ascending: false })
        .limit(limit)
      
      if (salesError) {
        console.error('Erro ao buscar vendas:', salesError)
        throw salesError
      }
      
      // Processar dados já carregados em 1 query (sem N+1!)
      const processedSales = (salesData || []).map((sale: any) => ({
        id: sale.id,
        userId: sale.user_id,
        sellerId: sale.seller_id,
        category: sale.category,
        items: (sale.items || []).map((item: any) => ({
          productId: item.product_id || '',
          productName: item.product_name,
          quantity: item.quantity,
          price: parseFloat(item.price) || 0
        })),
        total: parseFloat(sale.total) || 0,
        status: sale.status,
        createdAt: sale.created_at,
        card: sale.card || null,
        seller: sale.seller ? {
          id: sale.seller.id,
          name: sale.seller.name || sale.seller.email || 'Vendedor',
          email: sale.seller.email || ''
        } : undefined
      }))
      
      return processedSales
    }
    
    // Se não especificou categoria, retornar vazio (não carregar tudo)
    console.warn('getSales() chamado sem categoria - retornando array vazio')
    return []
  }

  // Buscar vendas de um cartão específico (todas as categorias)
  const getSalesByCardId = async (cardId: string, limit: number = 50): Promise<Sale[]> => {
    try {
      const allSales: Sale[] = []

      // Buscar vendas normais (lojinha e lanchonete)
      const { data: regularSales, error: regularError } = await supabase
        .from('sales')
        .select(`
          *,
          card: cards!sales_card_id_fkey (
            id,
            card_number,
            user_name
          ),
          items: sale_items (
            id,
            product_id,
            product_name,
            quantity,
            price
          )
        `)
        .eq('card_id', cardId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (regularError) throw regularError

      // Processar vendas normais
      if (regularSales) {
        allSales.push(...regularSales.map((sale: any) => ({
          id: sale.id,
          userId: sale.card_id,
          sellerId: sale.seller_id,
          category: sale.category,
          items: (sale.items || []).map((item: any) => ({
            productId: item.product_id || '',
            productName: item.product_name,
            quantity: item.quantity,
            price: item.price
          })),
          total: sale.total,
          status: sale.status,
          createdAt: sale.created_at,
          card: sale.card
        })))
      }

      // Buscar vendas do sapatinho veloz
      const { data: sapatinhoSales, error: sapatinhoError } = await supabase
        .from('sapatinho_sales')
        .select(`
          *,
          card: cards!sapatinho_sales_card_id_fkey (
            id,
            card_number,
            user_name
          ),
          items: sapatinho_sale_items (
            id,
            product_id,
            product_name,
            quantity,
            price
          )
        `)
        .eq('card_id', cardId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (sapatinhoError) throw sapatinhoError

      // Processar vendas do sapatinho
      if (sapatinhoSales) {
        allSales.push(...sapatinhoSales.map((sale: any) => ({
          id: sale.id,
          userId: sale.card_id,
          sellerId: sale.seller_id,
          category: 'sapatinho' as const,
          items: (sale.items || []).map((item: any) => ({
            productId: item.product_id,
            productName: item.product_name,
            quantity: item.quantity,
            price: parseFloat(item.price) || 0
          })),
          total: sale.total,
          status: sale.status,
          createdAt: sale.created_at,
          card: sale.card
        })))
      }

      // Ordenar todas as vendas por data (mais recentes primeiro)
      return allSales.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ).slice(0, limit)

    } catch (error) {
      console.error('Erro ao buscar vendas do cartão:', error)
      return []
    }
  }

  // Funções de pedidos
  // Função helper para gerar código sequencial de pedido
  const generateOrderCode = async (): Promise<string> => {
    try {
      // Buscar o último código de pedido
      const { data: lastOrder, error } = await supabase
        .from('orders')
        .select('order_code')
        .not('order_code', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      let nextNumber = 1
      
      if (!error && lastOrder?.order_code) {
        // Extrair o número do último código (ex: "00001" -> 1)
        const lastNumber = parseInt(lastOrder.order_code, 10)
        if (!isNaN(lastNumber)) {
          nextNumber = lastNumber + 1
        }
      }

      // Formatar como 5 dígitos com zeros à esquerda
      return nextNumber.toString().padStart(5, '0')
    } catch (err) {
      console.error('Error generating order code:', err)
      // Fallback: usar timestamp se houver erro
      return Date.now().toString().slice(-5)
    }
  }

 const getOpenOrders = async (): Promise<Order[]> => {
  try {
    // Buscar vendas da lojinha com status 'completed' (ainda não entregues)
    const { data: salesData, error: salesError } = await supabase
      .from('sales')
      .select(`
        *,
        card: cards!sales_card_id_fkey (
          id,
          user_name,
          card_number
        )
      `)
      .eq('category', 'lojinha')
      .eq('status', 'completed')
      .order('created_at', { ascending: false })

    if (salesError) {
      console.error('Erro ao buscar pedidos pendentes:', salesError)
      throw salesError
    }
    
    if (!salesData || salesData.length === 0) {
      return []
    }
    
    // Buscar itens e formatar pedidos
    const formattedOrders = await Promise.all((salesData || []).map(async (sale: any) => {
      // Buscar itens da venda
      const { data: saleItems, error: itemsError } = await supabase
        .from('sale_items')
        .select('*')
        .eq('sale_id', sale.id)
      
      if (itemsError) {
        console.error(`Erro ao buscar itens da venda ${sale.id}:`, itemsError)
      }
      
      const items = (!itemsError && saleItems) ? saleItems.map((item: any) => ({
        productId: item.product_id,
        productName: item.product_name,
        quantity: item.quantity,
        price: parseFloat(item.price) || 0
      })) : []

      // Buscar código do pedido na tabela orders (se existir)
      const { data: orderData } = await supabase
        .from('orders')
        .select('order_code, delivered_at')
        .eq('sale_id', sale.id)
        .maybeSingle()

      const customerName = sale.card?.user_name || 'Cliente'

      return {
        id: sale.id,
        saleId: sale.id,
        orderCode: orderData?.order_code || null,
        userId: sale.card_id,
        customerName: customerName,
        items: items,
        total: parseFloat(sale.total) || 0,
        status: 'completed' as const,
        createdAt: sale.created_at,
        deliveredAt: orderData?.delivered_at || null
      }
    }))

    return formattedOrders

  } catch (err) {
    console.error('Error in getOpenOrders:', err)
    throw err
  }
}

  const markAsDelivered = async (orderId: string) => {
    try {
      // orderId é o ID da venda na tabela sales
      // Atualizar status da venda para 'delivered'
      const { error: updateSaleError } = await supabase
        .from('sales')
        .update({
          status: 'delivered'
        })
        .eq('id', orderId)

      if (updateSaleError) {
        console.error('Erro ao atualizar venda:', updateSaleError)
        throw updateSaleError
      }

      // Também atualizar o pedido na tabela orders (se existir) para manter consistência
      const { data: orderData } = await supabase
        .from('orders')
        .select('id')
        .eq('sale_id', orderId)
        .maybeSingle()

      if (orderData) {
        const { error: updateOrderError } = await supabase
          .from('orders')
          .update({
            status: 'delivered',
            delivered_at: new Date().toISOString()
          })
          .eq('id', orderData.id)

        if (updateOrderError) {
          console.warn('Erro ao atualizar pedido (não crítico):', updateOrderError)
        }
      }

      await loadData()
    } catch (err) {
      console.error('Erro ao marcar como entregue:', err)
      throw err
    }
  }

  // Funções de cartão
  const getCardByUserId = (userId: string): Card | null => {
    return data.cards.find(c => c.userId === userId) || null
  }

  const createCard = async (params: { name: string; cardNumber: string; cardCode: string; phoneNumber: string; initialBalance?: number }): Promise<Card> => {
    try {
      // ✅ AGORA USA EDGE FUNCTION (SEGURO - apenas admins/comunicacao!)
      const { data: response, error } = await supabase.functions.invoke('update-balance', {
        body: {
          action: 'create',
          name: params.name,
          cardNumber: params.cardNumber,
          cardCode: params.cardCode,
          phoneNumber: params.phoneNumber,
          initialBalance: params.initialBalance || 0,
          description: params.initialBalance ? `Saldo inicial de R$ ${params.initialBalance.toFixed(2)}` : undefined
        }
      })

      if (error) {
        console.error('Edge function error:', error)
        throw new Error(error.message || 'Erro ao criar cartão')
      }

      if (!response?.success) {
        throw new Error(response?.error || 'Erro ao criar cartão')
      }

      await loadData()
      return response.data.card as any
    } catch (err) {
      console.error('Erro ao criar cartão:', err)
      throw err
    }
  }

  // Associação de cartão existente ao usuário atual
  const associateCard = async (params: { cardNumber: string; cardCode: string }): Promise<Card> => {
    try {
      // Verificar existência e status (valida por card_number + card_code)
      const { data: existing, error: findError } = await supabase
        .from('cards')
        .select('id, is_associated, card_code')
        .eq('card_number', params.cardNumber)
        .maybeSingle()
      if (findError) throw findError
      if (!existing) throw new Error('Cartão inexistente')
      if (existing.card_code !== params.cardCode) throw new Error('Código do cartão inválido')
      if (existing.is_associated) throw new Error('Cartão já associado, fale com a coordenação do encontro se quiser mudar a conta do cartão associado')

      // Obter usuário
      const { data: session } = await supabase.auth.getSession()
      const userId = session.session?.user?.id
      if (!userId) throw new Error('Sessão inválida')

      const { data: authUser } = await supabase.auth.getUser()
      const userName = authUser.user?.user_metadata?.name || null

      // Associar
      const { data: updated, error: updError } = await supabase
        .from('cards')
        .update({
          user_id: userId,
          user_name: userName,
          is_associated: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .eq('is_associated', false)
        .select('*')
        .single()
      if (updError) throw updError

      // Mapear do formato Supabase para Card
      const mappedCard: Card = {
        id: updated.id,
        userId: updated.user_id || '',
        userName: updated.user_name || '',
        cardNumber: updated.card_number || '',
        phoneNumber: updated.phone_number || '',
        balance: parseFloat(updated.balance) || 0,
        createdAt: updated.created_at || '',
        updatedAt: updated.updated_at || ''
      }

      await loadData()
      return mappedCard
    } catch (err) {
      console.error('Erro ao associar cartão:', err)
      throw err
    }
  }

  // Buscar cartão por número
  const getCardByNumber = async (cardNumber: string): Promise<Card | null> => {
    try {
      const { data, error } = await supabase
        .from('cards')
        .select('*')
        .eq('card_number', cardNumber)
        .maybeSingle()
      
      if (error) throw error
      return data as any || null
    } catch (err) {
      console.error('Erro ao buscar cartão:', err)
      throw err
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

  // Atualizar saldo do cartão
  const updateCardBalance = async (cardId: string, amount: number, type: 'credit' | 'debit', description?: string): Promise<void> => {
    try {
      // ✅ AGORA USA EDGE FUNCTION (SEGURO - apenas admins!)
      const { data: response, error } = await supabase.functions.invoke('update-balance', {
        body: {
          cardId,
          amount,
          type,
          description
        }
      })

      if (error) {
        console.error('Edge function error:', error)
        throw new Error(error.message || 'Erro ao atualizar saldo')
      }

      if (!response?.success) {
        throw new Error(response?.error || 'Erro ao atualizar saldo')
      }

      await loadData()
    } catch (err) {
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
