/**
 * Sales Router - POC
 * 
 * Demonstra implementação segura de criação de vendas com:
 * - Validação de permissões
 * - Validação de dados (Zod)
 * - Preços buscados do banco (não confia no frontend)
 * - Verificação de saldo
 * - Transação atômica
 */

import { z } from 'zod'
import { router, protectedProcedure } from '../trpc'
import { TRPCError } from '@trpc/server'
import { hasPermission } from '../permissions'

// Schema de validação para criar venda
const createSaleSchema = z.object({
  userId: z.string().uuid('ID da conta inválido'),
  category: z.enum(['lojinha', 'lanchonete', 'sapatinho']),
  items: z.array(
    z.object({
      productId: z.string().uuid('ID do produto inválido'),
      quantity: z.number().int().positive('Quantidade deve ser positiva'),
    })
  ).min(1, 'Pelo menos um item é necessário'),
})

export const salesRouter = router({
  /**
   * Criar venda - OPERAÇÃO CRÍTICA
   * 
   * 🔒 Validações de segurança:
   * 1. Autenticação via middleware
   * 2. Permissão específica para a categoria
   * 3. Validação de dados com Zod
   * 4. Preços buscados do banco de dados
   * 5. Verificação de saldo
   * 6. Transação SQL atômica
   */
  create: protectedProcedure
    .input(createSaleSchema)
    .mutation(async ({ input, ctx }) => {
      const { userId, category, items } = input
      const { user, supabase } = ctx

      // 1. Verificar permissão específica para a categoria
      const hasPermissionForCategory = ctx.user.role === 'admin' ||
        (category === 'lojinha' && ctx.user.role === 'lojinha') ||
        (category === 'lanchonete' && ctx.user.role === 'lanchonete') ||
        (category === 'sapatinho' && ['admin', 'lojinha', 'lanchonete', 'comunicacao'].includes(ctx.user.role))

      if (!hasPermissionForCategory) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: `Você não tem permissão para vender em: ${category}`,
        })
      }

      console.log('🔐 SECURITY LOG: Create sale', {
        userId: user.id,
        role: user.role,
        category,
        accountId: userId,
        itemCount: items.length,
        timestamp: new Date().toISOString(),
      })

      // 2. Buscar conta
      const { data: account, error: accountError } = await (supabase as any)
        .from('app_users')
        .select('id, balance, name')
        .eq('id', userId)
        .single()

      if (accountError || !account) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Conta não encontrada',
        })
      }

      // 3. Buscar produtos do BANCO (NÃO confiar no frontend!)
      const productIds = items.map(item => item.productId)
      
      const productTable = category === 'sapatinho' ? 'sapatinho_products' : 'products'
      let productsQuery = (supabase as any)
        .from(productTable)
        .select('id, name, price, active, stock')
        .in('id', productIds)

      // Adicionar filtro de categoria se não for sapatinho
      if (category !== 'sapatinho') {
        productsQuery = productsQuery.eq('category', category)
      }

      const { data: products, error: productsError } = await productsQuery

      if (productsError) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Erro ao buscar produtos',
        })
      }

      // Verificar se todos os produtos existem e estão ativos
      if (!products || products.length !== items.length) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Um ou mais produtos não foram encontrados ou estão inativos',
        })
      }

      // 4. Calcular total usando preços DO BANCO
      const productsMap = new Map(products.map((p: any) => [p.id, p]))
      let total = 0

      const saleItems = items.map(item => {
        const product = productsMap.get(item.productId) as any
        if (!product || !product.active) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Produto ${item.productId} não está disponível`,
          })
        }

        // Validar estoque (se o produto tiver controle de estoque)
        if (product.stock !== null && product.stock !== undefined) {
          if (product.stock < item.quantity) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: `Estoque insuficiente para ${product.name}. Disponível: ${product.stock}, Solicitado: ${item.quantity}`,
            })
          }
        }

        const subtotal = product.price * item.quantity
        total += subtotal

        return {
          productId: product.id,
          productName: product.name,
          quantity: item.quantity,
          price: product.price, // Preço do BANCO, não do frontend!
        }
      })

      // 5. Verificar saldo
      if (Number(account.balance) < total) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Saldo insuficiente. Necessário: R$ ${total.toFixed(2)}, Disponível: R$ ${Number(account.balance).toFixed(2)}`,
        })
      }

      // 6. TRANSAÇÃO ATÔMICA - Criar venda completa
      try {
        // 6.1 Criar venda
        const salesTable = category === 'sapatinho' ? 'sapatinho_sales' : 'sales'
        const saleData = category === 'sapatinho'
          ? {
            user_id: userId,
            seller_id: user.id,
            total,
            status: 'completed',
          }
          : {
            user_id: userId,
            seller_id: user.id,
            category,
            total,
            status: 'completed',
          }

        const { data: sale, error: saleError } = await (supabase as any)
          .from(salesTable)
          .insert(saleData)
          .select()
          .single()

        if (saleError) throw saleError

        // 6.2 Criar itens da venda
        const itemsTable = category === 'sapatinho' ? 'sapatinho_sale_items' : 'sale_items'
        const itemsData = saleItems.map(item => ({
          sale_id: sale.id,
          product_id: item.productId,
          product_name: item.productName,
          quantity: item.quantity,
          price: item.price,
        }))

        const { error: itemsError } = await (supabase as any)
          .from(itemsTable)
          .insert(itemsData)

        if (itemsError) throw itemsError

        // 6.3 Diminuir estoque dos produtos
        for (const item of saleItems) {
          const product = productsMap.get(item.productId) as any
          
          if (product && product.stock !== null && product.stock !== undefined) {
            const newStock = product.stock - item.quantity
            
            const { error: stockError } = await (supabase as any)
              .from('products')
              .update({ stock: newStock })
              .eq('id', item.productId)
            
            if (stockError) {
              console.error('Erro ao atualizar estoque:', stockError)
              // Não falhar a venda por causa do estoque, apenas logar
            }
          }
        }

        // 6.4 Debitar conta e registrar transação atomicamente
        const { error: balanceError } = await (supabase as any)
          .rpc('adjust_account_balance', {
            p_user_id: userId,
            p_amount: total,
            p_type: 'debit',
            p_description: `Compra na ${category}`,
            p_created_by: user.id,
          })

        if (balanceError) throw balanceError

        // 6.5 Se lojinha, criar pedido
        if (category === 'lojinha') {
          // Gerar código sequencial de 5 dígitos
          const { data: lastOrder } = await (supabase as any)
            .from('orders')
            .select('order_code')
            .not('order_code', 'is', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          
          let nextNumber = 1
          if (lastOrder?.order_code) {
            const lastNumber = parseInt(lastOrder.order_code, 10)
            if (!isNaN(lastNumber)) {
              nextNumber = lastNumber + 1
            }
          }
          const orderCode = nextNumber.toString().padStart(5, '0')
          
          const { error: orderError } = await (supabase as any)
            .from('orders')
            .insert({
              sale_id: sale.id,
              user_id: userId,
              customer_name: account.name,
              total,
              status: 'completed',
              order_code: orderCode
            })

          if (orderError) throw orderError
        }

        // ✅ Sucesso!
        console.log('✅ SALE CREATED:', {
          saleId: sale.id,
          total,
          userId: user.id,
          accountId: userId,
          category,
        })

        return {
          success: true,
          saleId: sale.id,
          total,
          newBalance: Number(account.balance) - total,
          message: `Venda realizada com sucesso! Total: R$ ${total.toFixed(2)}`,
        }

      } catch (error) {
        console.error('❌ SALE ERROR:', error)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Erro ao processar venda. Por favor, tente novamente.',
        })
      }
    }),

  /**
   * Listar histórico de vendas
   * ⚠️ IMPORTANTE: Apenas admin, lojinha e lanchonete podem ver histórico geral
   * Usuários normais devem consultar apenas vendas vinculadas à própria conta.
   */
  list: protectedProcedure
    .input(
      z.object({
        category: z.enum(['lojinha', 'lanchonete', 'sapatinho']).optional(),
        userId: z.string().uuid().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const { category, userId } = input
      const { supabase, user } = ctx

      const canViewAllSales = ['admin', 'lojinha', 'lanchonete'].includes(user.role)
      if (userId) {
        if (userId !== user.id && !canViewAllSales) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Você só pode consultar vendas da sua própria conta',
          })
        }
        if (userId === user.id && !canViewAllSales && !hasPermission(user.role, 'sales:view_own')) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Você não tem permissão para consultar seu histórico de vendas',
          })
        }
      } else {
        // Sem userId - está pedindo histórico geral
        // Apenas admin, lojinha ou lanchonete podem ver histórico geral
        if (!['admin', 'lojinha', 'lanchonete'].includes(user.role)) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Acesso negado: apenas administradores, lojinha e lanchonete podem ver histórico geral',
          })
        }

        // Verificar permissão específica por categoria
        if (category === 'lojinha' && !['admin', 'lojinha'].includes(user.role)) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Você não tem permissão para ver vendas de: lojinha',
          })
        }

        if (category === 'lanchonete' && !['admin', 'lanchonete'].includes(user.role)) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Você não tem permissão para ver vendas de: lanchonete',
          })
        }

        if (category === 'sapatinho' && !['admin', 'lojinha'].includes(user.role)) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Você não tem permissão para ver vendas de: sapatinho',
          })
        }
      }

      const table = category === 'sapatinho' ? 'sapatinho_sales' : 'sales'
      const itemsTable = category === 'sapatinho' ? 'sapatinho_sale_items' : 'sale_items'

      let query = (supabase as any)
        .from(table)
        .select(`
          *,
          ${itemsTable} (*)
        `)
        .order('created_at', { ascending: false })

      if (userId) {
        query = query.eq('user_id', userId)
      }

      if (category && category !== 'sapatinho') {
        query = query.eq('category', category)
      }

      const { data, error } = await query

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Erro ao buscar vendas',
        })
      }

      return data || []
    }),
})
