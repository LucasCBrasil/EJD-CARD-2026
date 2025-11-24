import { supabase } from '../lib/supabase'

/**
 * Gera um código sequencial único de 5 dígitos para pedidos
 * Formato: 00001, 00002, 00003, etc.
 */
export async function generateOrderCode(): Promise<string> {
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

