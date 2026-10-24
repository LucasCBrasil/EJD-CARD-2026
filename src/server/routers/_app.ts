/**
 * App Router - Root
 * 
 * Combina todos os routers da aplicação
 */

import { router } from '../trpc'
import { salesRouter } from './sales'

/**
 * Root router
 * 
 * Para adicionar mais routers:
 * export const appRouter = router({
 *   sales: salesRouter,
 *   products: productsRouter,
 * })
 */
export const appRouter = router({
  sales: salesRouter,
  // Adicione mais routers aqui conforme necessário
})

// Exportar tipo do router para o cliente
export type AppRouter = typeof appRouter
