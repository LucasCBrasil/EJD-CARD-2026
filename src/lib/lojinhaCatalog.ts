import { normalizeSearch } from './search'

export interface LojinhaCatalogItem {
  id: string
  name: string
  price: number
  description: string | null
  imageUrl: string | null
  outOfStock: boolean
}

export interface RawLojinhaProduct {
  id?: string | null
  name?: string | null
  price?: number | string | null
  description?: string | null
  image_url?: string | null
  image?: string | null
  active?: boolean | null
  out_of_stock?: boolean | null
  stock?: number | string | null
}

/**
 * Usa o booleano `out_of_stock` vindo da Edge Function quando presente.
 * Caso a função remota ainda não tenha sido atualizada, faz fallback pelo `stock`
 * sem nunca expor a quantidade na vitrine.
 */
export const isLojinhaItemOutOfStock = (product: RawLojinhaProduct): boolean => {
  if (typeof product.out_of_stock === 'boolean') {
    return product.out_of_stock
  }
  if (product.stock === null || product.stock === undefined || product.stock === '') {
    return false
  }
  const numericStock = Number(product.stock)
  return Number.isFinite(numericStock) && numericStock <= 0
}

export const toLojinhaCatalogItems = (rawProducts: RawLojinhaProduct[] = []): LojinhaCatalogItem[] => {
  return rawProducts
    .filter((product) => product && product.id && product.name && product.active !== false)
    .map((product) => ({
      id: String(product.id),
      name: String(product.name).trim(),
      price: Number(product.price) || 0,
      description: product.description ? String(product.description).trim() || null : null,
      imageUrl: product.image_url || product.image || null,
      outOfStock: isLojinhaItemOutOfStock(product),
    }))
    .sort((a, b) => {
      if (a.outOfStock !== b.outOfStock) {
        return a.outOfStock ? 1 : -1
      }
      return a.name.localeCompare(b.name, 'pt-BR')
    })
}

export const filterLojinhaCatalogItems = (
  items: LojinhaCatalogItem[],
  query: string,
): LojinhaCatalogItem[] => {
  const term = normalizeSearch(query)
  if (!term) return items

  return items.filter((item) => {
    const nameMatch = normalizeSearch(item.name).includes(term)
    const descriptionMatch = item.description ? normalizeSearch(item.description).includes(term) : false
    return nameMatch || descriptionMatch
  })
}
