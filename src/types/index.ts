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
export const LANCHONETE_MENU_CATEGORIES = ['Salgados', 'Sobremesas', 'Bebidas', 'Outros'] as const
export type LanchoneteMenuCategory = typeof LANCHONETE_MENU_CATEGORIES[number]

export interface Product {
  id: string
  name: string
  price: number
  category: ProductCategory
  menu_category?: LanchoneteMenuCategory
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
  status: 'completed' | 'delivered' | 'pending' | 'preparing' | 'ready' | 'cancelled'
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

// Food trucks parceiros: só cardápio, a compra é feita direto no food truck
export interface FoodTruckMenuItem {
  id: string
  section: string
  name: string
  description: string | null
  price: number
  imageUrl: string | null
  sortOrder: number
}

export interface FoodTruck {
  id: string
  name: string
  description: string | null
  logoUrl: string | null
  sortOrder: number
  active: boolean
  items: FoodTruckMenuItem[]
}
