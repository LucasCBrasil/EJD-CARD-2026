import type { FoodTruckMenuItem } from '../types'

export interface MenuSection {
  section: string
  items: FoodTruckMenuItem[]
}

/**
 * Agrupa os itens do cardápio por seção, numa ordem previsível para o admin:
 * - seções pela menor "ordem" entre os seus itens; empate em ordem alfabética
 * - itens dentro da seção pela "ordem"; empate em ordem alfabética
 */
export function groupMenuBySection(items: FoodTruckMenuItem[]): MenuSection[] {
  const byName = (a: string, b: string) => a.localeCompare(b, 'pt-BR')
  const groups = new Map<string, FoodTruckMenuItem[]>()
  for (const item of items) {
    const list = groups.get(item.section) || []
    list.push(item)
    groups.set(item.section, list)
  }
  return Array.from(groups, ([section, sectionItems]) => ({
    section,
    items: [...sectionItems].sort((a, b) => a.sortOrder - b.sortOrder || byName(a.name, b.name)),
  })).sort(
    (a, b) =>
      Math.min(...a.items.map((i) => i.sortOrder)) - Math.min(...b.items.map((i) => i.sortOrder)) ||
      byName(a.section, b.section)
  )
}
