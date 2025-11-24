import { supabase } from '../lib/supabase'
import { Sale, SaleItem, ProductCategory } from '../types'

const SALES_TABLE_MAP: Record<ProductCategory, { sales: string; items: string; createOrder: boolean }> = {
  lojinha: { sales: 'sales', items: 'sale_items', createOrder: true },
  lanchonete: { sales: 'sales', items: 'sale_items', createOrder: false },
  sapatinho: { sales: 'sapatinho_sales', items: 'sapatinho_sale_items', createOrder: false },
}

export const salesApi = {
  getAll: async (category?: ProductCategory): Promise<Sale[]> => {
    if (!category) {
      const [lojinha, lanchonete, sapatinho] = await Promise.all([
        salesApi.getAll('lojinha'),
        salesApi.getAll('lanchonete'),
        salesApi.getAll('sapatinho'),
      ])
      return [...lojinha, ...lanchonete, ...sapatinho].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    }

    const config = SALES_TABLE_MAP[category]
    const selectRelation = config.items === 'sale_items' ? 'sale_items (*)' : 'sapatinho_sale_items (*)'

    const { data, error } = await supabase
      .from(config.sales)
      .select(`
        *,
        ${selectRelation}
      `)
      .order('created_at', { ascending: false })
    if (error) throw error

    return (data || []).map((sale: any) => ({
      id: sale.id,
      userId: sale.card_id,
      sellerId: sale.seller_id,
      category,
      items: ((sale.sale_items || sale.sapatinho_sale_items) || []).map((item: any) => ({
        id: item.id,
        productId: item.product_id,
        productName: item.product_name,
        quantity: item.quantity,
        price: parseFloat(item.price) || 0
      })),
      total: parseFloat(sale.total) || 0,
      status: sale.status,
      createdAt: sale.created_at
    }))
  },

  create: async (params: {
    userId: string
    sellerId: string
    items: Omit<SaleItem, 'id'>[]
    category: ProductCategory
  }): Promise<string> => {
    // Buscar cartão do usuário
    const { data: card, error: cardError } = await supabase
      .from('cards')
      .select('id, balance')
      .eq('user_id', params.userId)
      .single()

    if (cardError) throw cardError

    const total = params.items.reduce((sum, item) => sum + (item.price * item.quantity), 0)

    // Verificar saldo
    if (card.balance < total) {
      throw new Error('Saldo insuficiente')
    }

    // Criar venda
    const config = SALES_TABLE_MAP[params.category]
    const salesInsert = {
      card_id: card.id,
      seller_id: params.sellerId,
      total,
      status: 'completed',
      ...(config.sales === 'sales' ? { category: params.category } : {})
    }

    const { data: sale, error: saleError } = await supabase
      .from(config.sales)
      .insert(salesInsert)
      .select()
      .single()

    if (saleError) throw saleError

    // Criar itens da venda
    const saleItems = params.items.map(item => ({
      sale_id: sale.id,
      product_id: item.productId,
      product_name: item.productName,
      quantity: item.quantity,
      price: item.price
    }))

    const { error: itemsError } = await supabase
      .from(config.items)
      .insert(saleItems)

    if (itemsError) throw itemsError

    // Debitar saldo usando a API de cards
    const { cardsApi } = await import('./cards.api')
    await cardsApi.updateBalance({
      cardId: card.id,
      amount: total,
      type: 'debit',
      description: `Compra na ${params.category}`
    })

    // Criar pedido se for lojinha
    if (config.createOrder) {
      const { generateOrderCode } = await import('../utils/orderCode')
      const orderCode = await generateOrderCode()
      
      await supabase
        .from('orders')
        .insert({
          sale_id: sale.id,
          card_id: card.id,
          customer_name: `Cliente ${params.userId}`,
          total,
          status: 'completed',
          order_code: orderCode
        })
    }

    return sale.id
  }
}




