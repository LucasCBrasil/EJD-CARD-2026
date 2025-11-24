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
    // Buscar vendas da lojinha com status 'completed' (ainda não entregues) da tabela sales
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
      .eq('category', 'lojinha')      // Apenas lojinha
      .eq('status', 'completed')       // Status 'completed' (ainda não entregue)
      .order('created_at', { ascending: false })
    
    if (salesError) throw salesError
    
    if (!salesData || salesData.length === 0) {
      return []
    }
    
    // Buscar itens de cada venda e formatar
    const orders = await Promise.all((salesData || []).map(async (sale: any) => {
      // Buscar itens da venda
      const { data: saleItems } = await supabase
        .from('sale_items')
        .select('*')
        .eq('sale_id', sale.id)
      
      const items = (saleItems || []).map((item: any) => ({
        productId: item.product_id,
        productName: item.product_name,
        quantity: item.quantity,
        price: parseFloat(item.price) || 0
      }))

      // Buscar código do pedido na tabela orders (se existir)
      const { data: orderData } = await supabase
        .from('orders')
        .select('order_code, delivered_at')
        .eq('sale_id', sale.id)
        .maybeSingle()

      return {
        id: sale.id,  // Usar ID da venda como ID do pedido
        saleId: sale.id,
        userId: sale.card_id,
        customerName: sale.card?.user_name || 'Cliente',
        items: items,
        total: parseFloat(sale.total) || 0,
        status: 'completed' as const,
        createdAt: sale.created_at,
        deliveredAt: orderData?.delivered_at || null
      }
    }))
    
    return orders
  },

  markAsDelivered: async (orderId: string): Promise<void> => {
    // orderId agora é o ID da venda na tabela sales
    // Atualizar status da venda para 'delivered'
    const { error: updateSaleError } = await supabase
      .from('sales')
      .update({
        status: 'delivered'
      })
      .eq('id', orderId)

    if (updateSaleError) throw updateSaleError

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
  }
}




