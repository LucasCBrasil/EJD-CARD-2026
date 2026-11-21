/**
 * Suíte automatizada de regressão e integração:
 * 1. Lojinha (vendas e carrinho compartilhado)
 * 2. Autoatendimento da Lanchonete (estoque geral)
 * 3. Vendas Ambulantes com Bag (retirada, venda, devolução e bloqueios)
 * 4. Controle dos Ambulantes e Permissões (coordLanchonete / admin vs outros perfis)
 *
 * Execução: npx tsx scripts/test-ambulante-regression.ts
 */

import assert from 'node:assert/strict'
import { hasPermission, type UserRole } from '../src/lib/roles'

// Simulador de estado do banco + Edge Functions (ambulante-bag, make-sale, lojinha-carts, create-self-order)
class MockBackend {
  generalStock: Record<string, number> = {
    'prod-brownie': 100,
    'prod-coxinha': 50,
    'prod-camisa': 30, // Lojinha
  }

  bags: Record<string, Record<string, number>> = {}
  balances: Record<string, number> = {
    'cliente-1': 200.0,
    'cliente-sem-saldo': 2.0,
  }

  userRoles: Record<string, UserRole> = {
    'admin-1': 'admin',
    'coord-1': 'coordLanchonete',
    'ambulante-1': 'lanchonete',
    'ambulante-2': 'lanchonete',
    'lojinha-1': 'lojinha',
    'encontrista-1': 'encontrista',
  }

  salesLog: Array<{ category: string; sellerId: string; userId: string; total: number }> = []

  // Simula Edge Function: ambulante-bag
  ambulanteBag(
    callerId: string,
    method: 'GET' | 'POST',
    options: { view?: string; action?: 'take' | 'return'; items?: Array<{ productId: string; quantity: number }>; targetUserId?: string } = {}
  ) {
    const role = this.userRoles[callerId] || 'encontrista'
    const canSell = hasPermission(role, 'canSellLanchonete')
    const canManage = hasPermission(role, 'canManageProductsLanchonete')

    if (!canSell && !canManage) {
      return { status: 403, success: false, error: 'Acesso negado: sem permissão na lanchonete' }
    }

    if (method === 'GET' && options.view === 'all') {
      if (!canManage) {
        return { status: 403, success: false, error: 'Acesso negado: apenas coordenação pode visualizar todas as bags' }
      }

      const sellers = Object.entries(this.bags)
        .map(([sellerId, itemsMap]) => {
          const items = Object.entries(itemsMap)
            .filter(([, qty]) => qty > 0)
            .map(([productId, quantity]) => ({ productId, quantity }))
          const totalUnits = items.reduce((sum, i) => sum + i.quantity, 0)
          return { sellerId, totalUnits, items }
        })
        .filter((s) => s.totalUnits > 0)

      return { status: 200, success: true, data: sellers }
    }

    if (method === 'GET') {
      const myBag = this.bags[callerId] || {}
      const items = Object.entries(myBag)
        .filter(([, qty]) => qty > 0)
        .map(([productId, quantity]) => ({ productId, quantity }))
      return { status: 200, success: true, data: items }
    }

    if (method === 'POST') {
      const sellerId = options.targetUserId || callerId
      if (sellerId !== callerId && !canManage) {
        return { status: 403, success: false, error: 'Acesso negado: apenas coordenação pode movimentar bag de terceiros' }
      }

      const items = options.items || []
      if (items.length === 0) {
        return { status: 400, success: false, error: 'EMPTY_CART' }
      }

      if (options.action === 'take') {
        for (const item of items) {
          if ((this.generalStock[item.productId] ?? 0) < item.quantity) {
            return { status: 400, success: false, error: 'OUT_OF_STOCK' }
          }
        }
        this.bags[sellerId] = this.bags[sellerId] || {}
        for (const item of items) {
          this.generalStock[item.productId] -= item.quantity
          this.bags[sellerId][item.productId] = (this.bags[sellerId][item.productId] || 0) + item.quantity
        }
        return { status: 200, success: true }
      }

      if (options.action === 'return') {
        for (const item of items) {
          const inBag = this.bags[sellerId]?.[item.productId] || 0
          if (inBag < item.quantity) {
            return { status: 400, success: false, error: 'INSUFFICIENT_BAG_STOCK' }
          }
        }
        for (const item of items) {
          this.bags[sellerId][item.productId] -= item.quantity
          this.generalStock[item.productId] = (this.generalStock[item.productId] || 0) + item.quantity
        }
        return { status: 200, success: true }
      }
    }

    return { status: 405, success: false, error: 'Método inválido' }
  }

  // Simula Edge Function: make-sale (Lojinha usa estoque geral; Lanchonete usa bag do vendedor)
  makeSale(
    sellerId: string,
    buyerId: string,
    category: 'lojinha' | 'lanchonete',
    items: Array<{ productId: string; quantity: number; price: number }>
  ) {
    const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0)
    if ((this.balances[buyerId] ?? 0) < total) {
      return { status: 400, success: false, error: 'INSUFFICIENT_BALANCE' }
    }

    if (category === 'lojinha') {
      for (const item of items) {
        if ((this.generalStock[item.productId] ?? 0) < item.quantity) {
          return { status: 400, success: false, error: 'OUT_OF_STOCK' }
        }
      }
      for (const item of items) {
        this.generalStock[item.productId] -= item.quantity
      }
    } else {
      // Lanchonete ambulante debita exclusivamente da bag do vendedor
      for (const item of items) {
        const inBag = this.bags[sellerId]?.[item.productId] || 0
        if (inBag < item.quantity) {
          return { status: 400, success: false, error: 'INSUFFICIENT_BAG_STOCK' }
        }
      }
      for (const item of items) {
        this.bags[sellerId][item.productId] -= item.quantity
      }
    }

    this.balances[buyerId] -= total
    this.salesLog.push({ category, sellerId, userId: buyerId, total })
    return { status: 200, success: true }
  }

  // Simula Edge Function: create-self-order (Autoatendimento usa estoque geral)
  createSelfOrder(buyerId: string, items: Array<{ productId: string; quantity: number; price: number }>) {
    const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0)
    if ((this.balances[buyerId] ?? 0) < total) {
      return { status: 400, success: false, error: 'INSUFFICIENT_BALANCE' }
    }
    for (const item of items) {
      if ((this.generalStock[item.productId] ?? 0) < item.quantity) {
        return { status: 400, success: false, error: 'OUT_OF_STOCK' }
      }
    }
    for (const item of items) {
      this.generalStock[item.productId] -= item.quantity
    }
    this.balances[buyerId] -= total
    return { status: 200, success: true }
  }
}

function runTests() {
  console.log('🧪 Iniciando suíte de testes de regressão e controle dos ambulantes...\n')
  const backend = new MockBackend()

  // =========================================================================
  // PONTO CRÍTICO 1: Regressão da Lojinha (não deve tocar em bag)
  // =========================================================================
  const lojinhaRes = backend.makeSale('lojinha-1', 'cliente-1', 'lojinha', [
    { productId: 'prod-camisa', quantity: 2, price: 45 },
  ])
  assert.equal(lojinhaRes.success, true, 'Venda da lojinha deve funcionar normalmente')
  assert.equal(backend.generalStock['prod-camisa'], 28, 'Estoque geral da lojinha deve baixar de 30 para 28')
  assert.equal(backend.balances['cliente-1'], 110, 'Saldo do cliente deve baixar de 200 para 110')
  console.log('✅ [1/5] Regressão Lojinha: OK')

  // =========================================================================
  // PONTO CRÍTICO 2: Regressão do Autoatendimento da Lanchonete
  // =========================================================================
  const selfOrderRes = backend.createSelfOrder('cliente-1', [
    { productId: 'prod-coxinha', quantity: 2, price: 10 },
  ])
  assert.equal(selfOrderRes.success, true, 'Autoatendimento deve continuar usando estoque geral')
  assert.equal(backend.generalStock['prod-coxinha'], 48, 'Estoque geral de coxinha deve baixar de 50 para 48')
  assert.equal(backend.balances['cliente-1'], 90, 'Saldo do cliente deve baixar para 90')
  console.log('✅ [2/5] Regressão Autoatendimento Lanchonete: OK')

  // =========================================================================
  // PONTO CRÍTICO 3: Fluxo da Bag dos Ambulantes (Retirada -> Venda -> Bloqueios)
  // =========================================================================
  // Tentar vender sem abastecer a bag deve falhar
  const saleWithoutBag = backend.makeSale('ambulante-1', 'cliente-1', 'lanchonete', [
    { productId: 'prod-brownie', quantity: 1, price: 8 },
  ])
  assert.equal(saleWithoutBag.success, false)
  assert.equal(saleWithoutBag.error, 'INSUFFICIENT_BAG_STOCK')

  // Abastecer bag com 10 brownies
  const takeRes = backend.ambulanteBag('ambulante-1', 'POST', {
    action: 'take',
    items: [{ productId: 'prod-brownie', quantity: 10 }],
  })
  assert.equal(takeRes.success, true)
  assert.equal(backend.generalStock['prod-brownie'], 90, 'Estoque geral deve baixar de 100 para 90')
  assert.equal(backend.bags['ambulante-1']['prod-brownie'], 10, 'Bag do ambulante deve ter 10 brownies')

  // Vender 3 brownies da bag
  const ambulanteSale = backend.makeSale('ambulante-1', 'cliente-1', 'lanchonete', [
    { productId: 'prod-brownie', quantity: 3, price: 8 },
  ])
  assert.equal(ambulanteSale.success, true)
  assert.equal(backend.bags['ambulante-1']['prod-brownie'], 7, 'Bag deve cair de 10 para 7 brownies')
  assert.equal(backend.generalStock['prod-brownie'], 90, 'Estoque geral NÃO deve mudar na venda ambulante')
  assert.equal(backend.balances['cliente-1'], 66, 'Saldo do cliente deve baixar de 90 para 66')
  console.log('✅ [3/5] Fluxo de Bag e Vendas Ambulantes: OK')

  // =========================================================================
  // PONTO CRÍTICO 4: Controle dos Ambulantes (Visão Global + Devolução Coordenação)
  // =========================================================================
  // Segundo ambulante abastece 5 coxinhas
  backend.ambulanteBag('ambulante-2', 'POST', {
    action: 'take',
    items: [{ productId: 'prod-coxinha', quantity: 5 }],
  })

  // Coordenação consulta todas as bags ativas (?view=all)
  const allBagsRes = backend.ambulanteBag('coord-1', 'GET', { view: 'all' })
  assert.equal(allBagsRes.success, true)
  assert.equal(allBagsRes.data?.length, 2, 'Devem existir 2 ambulantes com itens ativos')

  // Coordenação realiza devolução parcial de 4 brownies do ambulante-1
  const coordReturnRes = backend.ambulanteBag('coord-1', 'POST', {
    action: 'return',
    targetUserId: 'ambulante-1',
    items: [{ productId: 'prod-brownie', quantity: 4 }],
  })
  assert.equal(coordReturnRes.success, true)
  assert.equal(backend.bags['ambulante-1']['prod-brownie'], 3, 'Ambulante 1 deve ficar com 3 brownies')
  assert.equal(backend.generalStock['prod-brownie'], 94, 'Estoque geral deve subir de 90 para 94')
  console.log('✅ [4/5] Painel Controle dos Ambulantes e Devolução pela Coordenação: OK')

  // =========================================================================
  // PONTO CRÍTICO 5: Segurança e Matriz de Permissões por Perfil
  // =========================================================================
  // Vendedor comum (lanchonete) NÃO pode listar todas as bags nem devolver bag de colega
  const unauthorizedViewAll = backend.ambulanteBag('ambulante-1', 'GET', { view: 'all' })
  assert.equal(unauthorizedViewAll.status, 403, 'Vendedor comum não pode ver todas as bags')

  const unauthorizedReturnOther = backend.ambulanteBag('ambulante-1', 'POST', {
    action: 'return',
    targetUserId: 'ambulante-2',
    items: [{ productId: 'prod-coxinha', quantity: 1 }],
  })
  assert.equal(unauthorizedReturnOther.status, 403, 'Vendedor comum não pode devolver bag de outro vendedor')

  // Encontrista NÃO pode acessar nada de bag
  const encontristaBlocked = backend.ambulanteBag('encontrista-1', 'GET')
  assert.equal(encontristaBlocked.status, 403, 'Encontrista deve ser bloqueado na API de bag')

  // Verificar permissões reais de src/lib/roles.ts para o menu "Controle dos Ambulantes"
  const rolesWithDashboardAccess: UserRole[] = ['admin', 'coordLanchonete']
  const rolesWithoutDashboardAccess: UserRole[] = [
    'lanchonete',
    'lojinha',
    'coordLojinha',
    'comunicacao',
    'servico',
    'encontrista',
  ]

  for (const r of rolesWithDashboardAccess) {
    assert.equal(
      hasPermission(r, 'canManageProductsLanchonete'),
      true,
      `Role ${r} DEVE ter acesso ao Controle dos Ambulantes`
    )
  }
  for (const r of rolesWithoutDashboardAccess) {
    assert.equal(
      hasPermission(r, 'canManageProductsLanchonete'),
      false,
      `Role ${r} NÃO deve ter acesso ao Controle dos Ambulantes`
    )
  }
  console.log('✅ [5/5] Segurança e Matriz de Permissões (roles.ts): OK')

  console.log('\n🎉 Todos os 5 cenários críticos passaram com sucesso!')
}

runTests()