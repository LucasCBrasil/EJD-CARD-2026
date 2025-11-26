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
    
    // ✅ OTIMIZAÇÃO: Buscar todos os cards de uma vez (evita N+1 queries)
    const userIdsNeedingCards = (data || [])
      .filter((order: any) => !order.sender_name && order.sender_user_id)
      .map((order: any) => order.sender_user_id)
      .filter((id: string, index: number, self: string[]) => self.indexOf(id) === index) // Remove duplicatas
    
    let cardsMap = new Map<string, string>()
    
    if (userIdsNeedingCards.length > 0) {
      const { data: cards, error: cardsError } = await supabase
        .from('cards')
        .select('user_id, user_name')
        .in('user_id', userIdsNeedingCards)
      
      if (!cardsError && cards) {
        cards.forEach((card: any) => {
          if (card.user_name) {
            cardsMap.set(card.user_id, card.user_name)
          }
        })
      }
    }
    
    // Processar pedidos com os cards já carregados
    const ordersWithSenders = (data || []).map((order: any) => {
      let senderName = order.sender_name
      let isAnonymous = false
      
      // Se não tem sender_name, buscar do map de cards
      if (!senderName && order.sender_user_id) {
        senderName = cardsMap.get(order.sender_user_id) || null
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
    })
    
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
    // Timeout de 5 minutos (300 segundos) - limite máximo do Supabase Pro/Team
    // Se você estiver no plano Free, o limite é 60 segundos
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 300000) // 300 segundos (5 minutos)

    try {
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
        },
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (error) {
        console.error('Edge function error:', error)
        // Verificar se é erro de timeout
        if (error.message?.includes('timeout') || error.message?.includes('aborted') || error.name === 'AbortError') {
          throw new Error('A operação demorou mais de 5 minutos. O pedido pode ter sido criado mesmo assim. Por favor, verifique seus pedidos antes de tentar novamente.')
        }
        throw new Error(error.message || 'Erro ao criar pedido')
      }

      // Validação mais robusta da resposta
      if (!response) {
        console.error('Resposta vazia da edge function')
        throw new Error('Não foi possível processar a resposta do servidor. Por favor, verifique se o pedido foi criado.')
      }

      if (!response.success) {
        console.error('Edge function retornou erro:', response.error)
        throw new Error(response.error || 'Erro ao criar pedido')
      }

      // Verificar se realmente tem o orderId
      if (!response.data?.orderId) {
        console.error('Resposta sem orderId:', response)
        throw new Error('Pedido criado mas não foi possível obter o ID. Por favor, verifique se o pedido foi salvo.')
      }

      return response.data.orderId
    } catch (err: any) {
      clearTimeout(timeoutId)
      
      // Tratamento específico para timeout
      if (err.name === 'AbortError' || err.message?.includes('timeout') || err.message?.includes('aborted')) {
        throw new Error('A operação demorou mais de 5 minutos. O pedido pode ter sido criado mesmo assim. Por favor, verifique seus pedidos antes de tentar novamente.')
      }
      
      // Re-throw outros erros
      throw err
    }
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

