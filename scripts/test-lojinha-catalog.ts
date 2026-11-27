/**
 * Testes da vitrine da Lojinha e sanitização de estoque por perfil:
 * 1. Permissões: todos os perfis veem a vitrine; apenas equipe da lojinha/admin vê estoque e vende
 * 2. Sanitização no backend: remove estoques e `is_consigned` da lojinha para não-equipe, mantendo `out_of_stock`
 * 3. Lanchonete preservada: não altera produtos da lanchonete (autoatendimento usa `stock`)
 * 4. Catálogo no front: ordenação (disponíveis primeiro), fallback antes do deploy da Edge Function e busca sem acento
 *
 * Execução: npx tsx scripts/test-lojinha-catalog.ts
 */

import assert from 'node:assert/strict'
import { hasPermission, ROLE_PERMISSIONS, type UserRole } from '../src/lib/roles'
import {
  filterLojinhaCatalogItems,
  isLojinhaItemOutOfStock,
  toLojinhaCatalogItems,
} from '../src/lib/lojinhaCatalog'
import {
  canViewLojinhaStock,
  sanitizeProductForRole,
} from '../supabase/functions/_shared/lojinha-catalog.ts'

const ALL_ROLES = Object.keys(ROLE_PERMISSIONS) as UserRole[]
const LOJINHA_STOCK_ROLES: UserRole[] = ['admin', 'lojinha', 'coordLojinha']
const NON_LOJINHA_ROLES: UserRole[] = ['encontrista', 'servico', 'comunicacao', 'lanchonete', 'coordLanchonete']

const tests: Array<{ name: string; run: () => void }> = [
  {
    name: 'Todos os perfis têm permissão de visualizar a vitrine da lojinha',
    run: () => {
      for (const role of ALL_ROLES) {
        assert.equal(hasPermission(role, 'canViewLojinhaCatalog'), true, `${role} deve ver a vitrine`)
      }
      assert.equal(hasPermission('encontrista', 'canSellLojinha'), false)
      assert.equal(hasPermission('encontrista', 'canManageProductsLojinha'), false)
    },
  },
  {
    name: 'Sanitização remove stock e is_consigned da lojinha para perfis fora da equipe da lojinha',
    run: () => {
      const availableProduct = {
        id: 'p1',
        name: 'Camiseta EJD',
        price: 55,
        category: 'lojinha',
        stock: 12,
        is_consigned: true,
        size_stock: { M: 5, G: 7 },
        active: true,
      }
      const zeroStockProduct = {
        id: 'p2',
        name: 'Caneca',
        price: 30,
        category: 'lojinha',
        stock: 0,
        is_consigned: false,
        active: true,
      }
      const unlimitedProduct = {
        id: 'p3',
        name: 'Adesivo',
        price: 5,
        category: 'lojinha',
        stock: null,
        is_consigned: false,
        active: true,
      }

      for (const role of NON_LOJINHA_ROLES) {
        assert.equal(canViewLojinhaStock(role), false, `${role} não deve ver estoque da lojinha`)

        const sanitizedAvailable = sanitizeProductForRole(availableProduct, role)
        assert.equal('stock' in sanitizedAvailable, false, `stock não deve ir para ${role}`)
        assert.equal('is_consigned' in sanitizedAvailable, false, `is_consigned não deve ir para ${role}`)
        assert.equal('size_stock' in sanitizedAvailable, false, `estoque por tamanho não deve ir para ${role}`)
        assert.equal(sanitizedAvailable.out_of_stock, false)

        const sanitizedZero = sanitizeProductForRole(zeroStockProduct, role)
        assert.equal('stock' in sanitizedZero, false)
        assert.equal(sanitizedZero.out_of_stock, true)

        const sanitizedUnlimited = sanitizeProductForRole(unlimitedProduct, role)
        assert.equal('stock' in sanitizedUnlimited, false)
        assert.equal(sanitizedUnlimited.out_of_stock, false)
      }
    },
  },
  {
    name: 'Equipe da lojinha e admin continuam recebendo stock e is_consigned intactos',
    run: () => {
      const product = {
        id: 'p1',
        name: 'Camiseta EJD',
        price: 55,
        category: 'lojinha',
        stock: 12,
        is_consigned: true,
        size_stock: { M: 5, G: 7 },
        active: true,
      }

      for (const role of LOJINHA_STOCK_ROLES) {
        assert.equal(canViewLojinhaStock(role), true, `${role} deve ver estoque da lojinha`)
        const result = sanitizeProductForRole(product, role)
        assert.equal(result.stock, 12)
        assert.equal(result.is_consigned, true)
        assert.deepEqual(result.size_stock, { M: 5, G: 7 })
      }
    },
  },
  {
    name: 'Produtos da lanchonete não perdem stock para encontrista (autoatendimento preservado)',
    run: () => {
      const snack = {
        id: 'l1',
        name: 'Coxinha',
        price: 8,
        category: 'lanchonete',
        stock: 25,
        active: true,
      }
      const result = sanitizeProductForRole(snack, 'encontrista')
      assert.equal(result.stock, 25)
      assert.equal('out_of_stock' in result, false)
    },
  },
  {
    name: 'Catálogo usa out_of_stock do servidor e faz fallback seguro antes do deploy da Edge Function',
    run: () => {
      assert.equal(isLojinhaItemOutOfStock({ out_of_stock: true, stock: 10 }), true)
      assert.equal(isLojinhaItemOutOfStock({ out_of_stock: false, stock: 0 }), false)
      assert.equal(isLojinhaItemOutOfStock({ stock: 0 }), true)
      assert.equal(isLojinhaItemOutOfStock({ stock: -2 }), true)
      assert.equal(isLojinhaItemOutOfStock({ stock: 5 }), false)
      assert.equal(isLojinhaItemOutOfStock({ stock: null }), false)
      assert.equal(isLojinhaItemOutOfStock({}), false)
    },
  },
  {
    name: 'toLojinhaCatalogItems omite stock, filtra inativos e ordena disponíveis antes dos em falta',
    run: () => {
      const items = toLojinhaCatalogItems([
        { id: '1', name: 'Boné', price: 40, stock: 0, active: true },
        { id: '2', name: 'Pulseira', price: 10, out_of_stock: false, active: true },
        { id: '3', name: 'Camiseta', price: 60, stock: 8, active: true },
        { id: '4', name: 'Adesivo antigo', price: 5, stock: 3, active: false },
        { id: '5', name: 'Abadá', price: 45, out_of_stock: true, active: true },
      ])

      assert.deepEqual(
        items.map((item) => ({ id: item.id, name: item.name, outOfStock: item.outOfStock })),
        [
          { id: '3', name: 'Camiseta', outOfStock: false },
          { id: '2', name: 'Pulseira', outOfStock: false },
          { id: '5', name: 'Abadá', outOfStock: true },
          { id: '1', name: 'Boné', outOfStock: true },
        ],
      )
      for (const item of items) {
        assert.equal('stock' in item, false)
        assert.equal('is_consigned' in item, false)
      }
    },
  },
  {
    name: 'Busca na vitrine ignora acentos, maiúsculas e encontra por nome ou descrição',
    run: () => {
      const items = toLojinhaCatalogItems([
        { id: '1', name: 'Boné Trilhos', price: 40, description: 'Edição especial 25 anos', out_of_stock: false },
        { id: '2', name: 'Caneca Esmaltada', price: 35, description: 'Para café quente', out_of_stock: false },
      ])

      assert.deepEqual(
        filterLojinhaCatalogItems(items, 'bone').map((i) => i.id),
        ['1'],
      )
      assert.deepEqual(
        filterLojinhaCatalogItems(items, 'CAFE').map((i) => i.id),
        ['2'],
      )
      assert.deepEqual(
        filterLojinhaCatalogItems(items, '').map((i) => i.id),
        ['1', '2'],
      )
    },
  },
]

let passed = 0
for (const test of tests) {
  test.run()
  passed += 1
  console.log(`✅ ${test.name}`)
}

console.log(`\n🎉 ${passed}/${tests.length} cenários da vitrine da lojinha passaram!`)
