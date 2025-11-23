import { supabase } from '../lib/supabase'
import { SapatinhoVelozOrder, SaleItem } from '../types'

export const sapatinhoVelozApi = {
  getAll: async (): Promise<SapatinhoVelozOrder[]> => {
    const { data, error } = await supabase
      .from('sapatinho_veloz_orders')
      .select(`
        *,
        sapatinho_veloz_order_items (*)
      `)
      .order('created_at', { ascending: false })
    
    if (error) throw error
    
    return (data || []).map((order: any) => ({
      id: order.id,
      saleId: order.sale_id,
      senderUserId: order.sender_user_id,
      senderName: order.sender_name,
      senderTeam: order.sender_team,
      recipientName: order.recipient_name,
      recipientAddress: order.recipient_address,
      message: order.message,
      items: (order.sapatinho_veloz_order_items || []).map((item: any) => ({
        id: item.id,
        orderId: item.order_id,
        productId: item.product_id,
        productName: item.product_name,
        quantity: item.quantity,
        price: parseFloat(item.price) || 0,
        createdAt: item.created_at
      })),
      total: parseFloat(order.total) || 0,
      status: order.status,
      createdAt: order.created_at,
      deliveredAt: order.delivered_at
    }))
  },

  getOpenOrders: async (): Promise<SapatinhoVelozOrder[]> => {
    const { data, error } = await supabase
      .from('sapatinho_veloz_orders')
      .select(`
        *,
        sapatinho_veloz_order_items (*)
      `)
      .in('status', ['pending', 'completed'])
      .order('created_at', { ascending: false })
    
    if (error) throw error
    
    // Buscar informações dos remetentes quando necessário
    const ordersWithSenders = await Promise.all((data || []).map(async (order: any) => {
      let senderName = order.sender_name
      let isAnonymous = false
      
      // Se não tem sender_name, buscar do card pelo sender_user_id
      if (!senderName && order.sender_user_id) {
        const { data: card } = await supabase
          .from('cards')
          .select('user_name')
          .eq('user_id', order.sender_user_id)
          .maybeSingle()
        
        if (card?.user_name) {
          senderName = card.user_name
        }
      }
      
      // Verificar se é anônimo (sender_name null)
      if (!order.sender_name) {
        isAnonymous = true
      }
      
      return {
        id: order.id,
        saleId: order.sale_id,
        senderUserId: order.sender_user_id,
        senderName: senderName || null,
        senderTeam: order.sender_team || null,
        recipientName: order.recipient_name,
        recipientAddress: order.recipient_address,
        message: order.message,
        isAnonymous,
        items: (order.sapatinho_veloz_order_items || []).map((item: any) => ({
          id: item.id,
          orderId: item.order_id,
          productId: item.product_id,
          productName: item.product_name,
          quantity: item.quantity,
          price: parseFloat(item.price) || 0,
          createdAt: item.created_at
        })),
        total: parseFloat(order.total) || 0,
        status: order.status,
        createdAt: order.created_at,
        deliveredAt: order.delivered_at
      }
    }))
    
    return ordersWithSenders
  },

  create: async (params: {
    senderUserId: string
    senderTeam: string
    recipientName: string
    recipientAddress: string
    message?: string
    isAnonymous?: boolean
    items: Omit<SaleItem, 'id'>[]
  }): Promise<string> => {
    // ✅ AGORA USA EDGE FUNCTION (SEGURO!)
    const { data: response, error } = await supabase.functions.invoke('sapatinho-order-', {
      body: {
        senderTeam: params.senderTeam,
        recipientName: params.recipientName,
        recipientAddress: params.recipientAddress,
        message: params.message,
        isAnonymous: params.isAnonymous,
        items: params.items.map(item => ({
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          price: item.price
        }))
      }
    })

    if (error) {
      console.error('Edge function error:', error)
      throw new Error(error.message || 'Erro ao criar pedido')
    }

    if (!response?.success) {
      throw new Error(response?.error || 'Erro ao criar pedido')
    }

    return response.data.orderId
  },

  markAsDelivered: async (orderId: string): Promise<void> => {
    const { error } = await supabase
      .from('sapatinho_veloz_orders')
      .update({
        status: 'delivered',
        delivered_at: new Date().toISOString()
      })
      .eq('id', orderId)

    if (error) throw error
  }
}

