// Types centralizados para o projeto
// Este arquivo evita duplicação de tipos e melhora a manutenibilidade

export interface Transaction {
  id: string
  userId: string
  amount: number
  type: 'credit' | 'debit'
  description: string
  createdBy?: string
  createdAt: string
}

export type ProductCategory = 'lojinha' | 'lanchonete'

export interface Product {
  id: string
  name: string
  price: number
  category: ProductCategory
  description?: string
  stock?: number
  active: boolean
  createdAt: string
  image?: string | null
  image_url?: string | null
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
  saleId?: string
  sale_id?: string
  userId: string
  sellerId: string
  category: ProductCategory
  items: SaleItem[]
  total: number
  status: 'completed' | 'delivered'
  createdAt: string
  created_at?: string
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

export interface UserAccount {
  id: string
  email: string
  name: string
  role: string
  balance: number
  createdAt: string
}
