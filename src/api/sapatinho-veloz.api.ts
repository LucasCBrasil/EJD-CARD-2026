/**
 * ⚠️ DEPRECATED - Este arquivo está DEPRECATED!
 * 
 * Use api-client.ts em vez disso:
 * - api.listOrders('sapatinho') - para listar pedidos
 * - api.markOrderAsDelivered(orderId) - para marcar como entregue
 * - api.createSapatinhoOrder(data) - para criar pedido (já usa Edge Function)
 */
import { supabase } from '../lib/supabase'
import { SaleItem } from '../types'

export const sapatinhoVelozApi = {
  // ⚠️ REMOVIDO: getAll() - Use api.listOrders('sapatinho') do api-client.ts
  
  // ⚠️ REMOVIDO: getOpenOrders() - Use api.listOrders('sapatinho') e filtre por status no frontend

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
      // ✅ Migrado para usar api-client em vez de supabase.functions.invoke
      const { api } = await import('../lib/api-client')
      const response = await api.createSapatinhoOrder({
        senderUserId: params.senderUserId,
        senderTeam: params.senderTeam,
        recipientName: params.recipientName,
        recipientAddress: params.recipientAddress,
        message: params.message,
        isAnonymous: params.isAnonymous || false,
        items: params.items.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
        }))
      })

      if (!response.success) {
        throw new Error(response.error || 'Erro ao criar pedido')
      }

      // api.createSapatinhoOrder retorna orderId diretamente em response.data
      return response.data || ''
    } catch (err: any) {
      console.error('Erro ao criar pedido:', err)
      throw err
    }
  },

  // ⚠️ REMOVIDO: markAsDelivered() - Use api.markOrderAsDelivered(orderId) do api-client.ts
}

