/**
 * Tipos compartilhados entre todas as Edge Functions
 * Mantém consistência com o frontend
 */

export interface SaleItem {
  productId: string
  productName: string
  quantity: number
  price: number
}

export interface Card {
  id: string
  user_id: string
  user_name: string
  card_number: string
  phone_number: string
  balance: number
}

export interface Product {
  id: string
  name: string
  price: number
  category: 'lojinha' | 'lanchonete'
  active: boolean
}

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
}

