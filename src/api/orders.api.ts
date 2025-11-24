import { supabase } from '../lib/supabase'
import { Order } from '../types'

export const ordersApi = {
  getAll: async (): Promise<Order[]> => {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) throw error
    
    return (data || []).map((order: any) => ({
      id: order.id,
      saleId: order.sale_id,
      userId: order.card_id,
      customerName: order.customer_name,
      items: [], // TODO: Buscar items separadamente se necessário
      total: parseFloat(order.total) || 0,
      status: order.status,
      createdAt: order.created_at,
      deliveredAt: order.delivered_at
    }))
  },

  getOpenOrders: async (): Promise<Order[]> => {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
    
    if (error) throw error
    
    return (data || []).map((order: any) => ({
      id: order.id,
      saleId: order.sale_id,
      userId: order.card_id,
      customerName: order.customer_name,
      items: [],
      total: parseFloat(order.total) || 0,
      status: order.status,
      createdAt: order.created_at,
      deliveredAt: order.delivered_at
    }))
  },

  markAsDelivered: async (orderId: string): Promise<void> => {
    // Primeiro, buscar o pedido para obter o sale_id
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('sale_id')
      .eq('id', orderId)
      .single()

    if (orderError) throw orderError

    // Atualizar o pedido
    const { error: updateOrderError } = await supabase
      .from('orders')
      .update({
        status: 'delivered',
        delivered_at: new Date().toISOString()
      })
      .eq('id', orderId)

    if (updateOrderError) throw updateOrderError

    // Se houver uma venda relacionada, atualizar seu status também
    if (order?.sale_id) {
      const { error: updateSaleError } = await supabase
        .from('sales')
        .update({
          status: 'delivered'
        })
        .eq('id', order.sale_id)

      if (updateSaleError) {
        console.warn('Erro ao atualizar status da venda:', updateSaleError)
        // Não lançar erro aqui, pois o pedido já foi atualizado com sucesso
      }
    }
  }
}




