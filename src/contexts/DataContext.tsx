import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'

// Interfaces para os dados
export interface Transaction {
  id: string
  userId: string
  amount: number
  type: 'credit' | 'debit'
  description: string
  createdBy?: string
  createdAt: string
}

type ProductCategory = 'lojinha' | 'lanchonete' | 'sapatinho'

export interface Product {
  id: string
  name: string
  price: number
  category: ProductCategory
  description?: string
  stock?: number
  active: boolean
  createdAt: string
}

export interface SaleItem {
  id: string
  productId: string
  productName: string
  quantity: number
  price: number
}

export interface Sale {
  id: string
  userId: string // quem comprou
  sellerId: string // quem vendeu
  category: ProductCategory
  items: SaleItem[]
  total: number
  status: 'completed' | 'delivered'
  createdAt: string
}

export interface Order {
  id: string
  saleId: string
  userId: string
  customerName: string
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
    sapatinho: Product[]
  }
  sales: Sale[]
  orders: Order[]
}

interface DataContextType {
  data: AppData
  // Funções de saldo
  addBalance: (userId: string, amount: number, description: string, createdBy?: string) => void
  getBalance: (userId: string) => number
  getTransactions: (userId: string) => Transaction[]
  
  // Funções de produtos
  addProduct: (product: Omit<Product, 'id' | 'createdAt'>) => void
  updateProduct: (id: string, updates: Partial<Product>) => void
  deleteProduct: (id: string) => void
  getProducts: (category: ProductCategory) => Product[]
  
  // Funções de vendas
  makeSale: (userId: string, sellerId: string, items: Omit<SaleItem, 'id'>[], category: ProductCategory) => string
  getSales: (category?: ProductCategory) => Sale[]
  
  // Funções de pedidos
  getOpenOrders: () => Order[]
  markAsDelivered: (orderId: string) => void
  
  // Utilitários
  resetData: () => void
  loadSeedData: () => void
}

const DataContext = createContext<DataContextType | undefined>(undefined)

export const useData = () => {
  const context = useContext(DataContext)
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider')
  }
  return context
}

interface DataProviderProps {
  children: ReactNode
}

export const DataProvider: React.FC<DataProviderProps> = ({ children }) => {
  const [data, setData] = useState<AppData>({
    balances: new Map(),
    products: {
      lojinha: [],
      lanchonete: [],
      sapatinho: []
    },
    sales: [],
    orders: []
  })

  // Carregar dados do localStorage na inicialização
  useEffect(() => {
    const savedData = localStorage.getItem('encontrao_data')
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData)
        // Converter Map de volta
        const balances = new Map(parsed.balances || [])
        setData({
          ...parsed,
          balances
        })
      } catch (error) {
        console.error('Erro ao carregar dados do localStorage:', error)
      }
    } else {
      // Carregar dados de seed se não houver dados salvos
      loadSeedData()
    }
  }, [])

  // Salvar dados no localStorage sempre que mudar
  useEffect(() => {
    const dataToSave = {
      ...data,
      balances: Array.from(data.balances.entries()) // Converter Map para Array
    }
    localStorage.setItem('encontrao_data', JSON.stringify(dataToSave))
  }, [data])

  // Funções de saldo
  const addBalance = (userId: string, amount: number, description: string, createdBy?: string) => {
    setData(prev => {
      const newBalances = new Map(prev.balances)
      const currentBalance = newBalances.get(userId) || { balance: 0, transactions: [] }
      
      const transaction: Transaction = {
        id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId,
        amount,
        type: amount > 0 ? 'credit' : 'debit',
        description,
        createdBy,
        createdAt: new Date().toISOString()
      }
      
      newBalances.set(userId, {
        balance: currentBalance.balance + amount,
        transactions: [transaction, ...currentBalance.transactions]
      })
      
      return {
        ...prev,
        balances: newBalances
      }
    })
  }

  const getBalance = (userId: string): number => {
    return data.balances.get(userId)?.balance || 0
  }

  const getTransactions = (userId: string): Transaction[] => {
    return data.balances.get(userId)?.transactions || []
  }

  // Funções de produtos
  const addProduct = (product: Omit<Product, 'id' | 'createdAt'>) => {
    const newProduct: Product = {
      ...product,
      id: `prod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString()
    }
    
    setData(prev => ({
      ...prev,
      products: {
        ...prev.products,
        [product.category]: [...prev.products[product.category], newProduct]
      }
    }))
  }

  const updateProduct = (id: string, updates: Partial<Product>) => {
    setData(prev => {
      const updatedProducts = Object.entries(prev.products).reduce((acc, [categoryKey, productList]) => {
        acc[categoryKey as ProductCategory] = productList.map(p => p.id === id ? { ...p, ...updates } : p)
        return acc
      }, {} as Record<ProductCategory, Product[]>)

      return {
        ...prev,
        products: updatedProducts
      }
    })
  }

  const deleteProduct = (id: string) => {
    setData(prev => {
      const updatedProducts = Object.entries(prev.products).reduce((acc, [categoryKey, productList]) => {
        acc[categoryKey as ProductCategory] = productList.filter(p => p.id !== id)
        return acc
      }, {} as Record<ProductCategory, Product[]>)

      return {
        ...prev,
        products: updatedProducts
      }
    })
  }

  const getProducts = (category: ProductCategory): Product[] => {
    return data.products[category].filter(p => p.active)
  }

  // Funções de vendas
  const makeSale = (userId: string, sellerId: string, items: Omit<SaleItem, 'id'>[], category: ProductCategory): string => {
    const saleId = `sale_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
    
    // Verificar se tem saldo suficiente
    const currentBalance = getBalance(userId)
    if (currentBalance < total) {
      throw new Error('Saldo insuficiente')
    }
    
    // Criar itens da venda com IDs
    const saleItems: SaleItem[] = items.map(item => ({
      ...item,
      id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }))
    
    const sale: Sale = {
      id: saleId,
      userId,
      sellerId,
      category,
      items: saleItems,
      total,
      status: 'completed',
      createdAt: new Date().toISOString()
    }
    
    // Debitar do saldo
    addBalance(userId, -total, `Compra na ${category}`, sellerId)
    
    // Adicionar venda
    setData(prev => ({
      ...prev,
      sales: [sale, ...prev.sales]
    }))
    
    // Criar pedido se for lojinha (para entregador)
    if (category === 'lojinha') {
      const order: Order = {
        id: `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        saleId,
        userId,
        customerName: `Cliente ${userId}`, // TODO: buscar nome real
        items: saleItems,
        total,
        status: 'completed',
        createdAt: new Date().toISOString()
      }
      
      setData(prev => ({
        ...prev,
        orders: [order, ...prev.orders]
      }))
    }
    
    return saleId
  }

  const getSales = (category?: ProductCategory): Sale[] => {
    if (category) {
      return data.sales.filter(sale => sale.category === category)
    }
    return data.sales
  }

  // Funções de pedidos
  const getOpenOrders = (): Order[] => {
    return data.orders.filter(order => order.status === 'completed')
  }

  const markAsDelivered = (orderId: string) => {
    setData(prev => ({
      ...prev,
      orders: prev.orders.map(order => 
        order.id === orderId 
          ? { ...order, status: 'delivered' as const, deliveredAt: new Date().toISOString() }
          : order
      )
    }))
  }

  // Utilitários
  const resetData = () => {
    setData({
      balances: new Map(),
      products: {
        lojinha: [],
        lanchonete: [],
        sapatinho: []
      },
      sales: [],
      orders: []
    })
    localStorage.removeItem('encontrao_data')
  }

  const loadSeedData = () => {
    // Dados de exemplo para teste
    const seedBalances = new Map()
    const seedProducts: Product[] = [
      // Produtos Lojinha
      { id: 'prod1', name: 'Camiseta Encontrão', price: 25.00, category: 'lojinha', description: 'Camiseta oficial', active: true, createdAt: new Date().toISOString() },
      { id: 'prod2', name: 'Caneca Personalizada', price: 15.00, category: 'lojinha', description: 'Caneca com logo', active: true, createdAt: new Date().toISOString() },
      { id: 'prod3', name: 'Chaveiro', price: 5.00, category: 'lojinha', description: 'Chaveiro do evento', active: true, createdAt: new Date().toISOString() },
      
      // Produtos Lanchonete
      { id: 'prod4', name: 'Hambúrguer', price: 12.00, category: 'lanchonete', description: 'Hambúrguer artesanal', active: true, createdAt: new Date().toISOString() },
      { id: 'prod5', name: 'Refrigerante', price: 4.00, category: 'lanchonete', description: 'Lata 350ml', active: true, createdAt: new Date().toISOString() },
      { id: 'prod6', name: 'Batata Frita', price: 8.00, category: 'lanchonete', description: 'Porção média', active: true, createdAt: new Date().toISOString() },

      // Produtos Sapatinho
      { id: 'prod7', name: 'Bilhete de Viagem', price: 7.50, category: 'sapatinho', description: 'Mensagem especial para quem vai embarcar', active: true, createdAt: new Date().toISOString() },
      { id: 'prod8', name: 'Docinho da Estação', price: 5.00, category: 'sapatinho', description: 'Delícia exclusiva do Sapatinho', active: true, createdAt: new Date().toISOString() }
    ]
    
    // Adicionar saldo inicial para alguns usuários
    seedBalances.set('user_1761188017655_wl0moue5g', { 
      balance: 50.00, 
      transactions: [
        {
          id: 'tx1',
          userId: 'user_1761188017655_wl0moue5g',
          amount: 50.00,
          type: 'credit',
          description: 'Saldo inicial',
          createdAt: new Date().toISOString()
        }
      ]
    })
    
    setData({
      balances: seedBalances,
      products: {
        lojinha: seedProducts.filter(p => p.category === 'lojinha'),
        lanchonete: seedProducts.filter(p => p.category === 'lanchonete'),
        sapatinho: seedProducts.filter(p => p.category === 'sapatinho')
      },
      sales: [],
      orders: []
    })
  }

  const value: DataContextType = {
    data,
    addBalance,
    getBalance,
    getTransactions,
    addProduct,
    updateProduct,
    deleteProduct,
    getProducts,
    makeSale,
    getSales,
    getOpenOrders,
    markAsDelivered,
    resetData,
    loadSeedData
  }

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  )
}



