import { hasPermission, type UserRole } from './roles.ts'

export const canViewLojinhaStock = (role: UserRole): boolean =>
  hasPermission(role, 'canSellLojinha') || hasPermission(role, 'canManageProductsLojinha')

/**
 * Remove campos internos de estoque/consignação dos produtos da lojinha para
 * perfis que não pertencem à equipe da lojinha, expondo apenas `out_of_stock`.
 * Produtos da lanchonete não são alterados (o autoatendimento usa o limite de estoque).
 */
export const sanitizeProductForRole = <T extends Record<string, unknown>>(
  product: T,
  role: UserRole,
): T & { out_of_stock?: boolean } => {
  if (product.category !== 'lojinha' || canViewLojinhaStock(role)) {
    return product
  }

  const rawStock = product.stock
  const numericStock = rawStock === null || rawStock === undefined || rawStock === '' ? NaN : Number(rawStock)
  const outOfStock = Number.isFinite(numericStock) && numericStock <= 0
  const { stock: _stock, is_consigned: _isConsigned, ...safeProduct } = product

  return {
    ...safeProduct,
    out_of_stock: outOfStock,
  } as T & { out_of_stock?: boolean }
}
