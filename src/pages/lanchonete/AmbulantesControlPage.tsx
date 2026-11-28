import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { api, type AmbulanteSellerSummary } from '../../lib/api-client'
import { useToastContext } from '../../contexts/ToastContext'
import { normalizeSearch } from '../../lib/search'

const AmbulantesControlPage: React.FC = () => {
  const { showSuccess, showError, showWarning } = useToastContext()

  const [sellers, setSellers] = useState<AmbulanteSellerSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchFilter, setSearchFilter] = useState('')
  const [selectedSeller, setSelectedSeller] = useState<AmbulanteSellerSummary | null>(null)
  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const loadAllBags = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await api.listAllAmbulanteBags()
      if (!response.success) {
        throw new Error(response.error || 'Não foi possível carregar as bags dos ambulantes.')
      }
      setSellers(response.data || [])
    } catch (err) {
      showError('Erro ao carregar bags', err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setIsLoading(false)
    }
  }, [showError])

  useEffect(() => {
    void loadAllBags()
  }, [loadAllBags])

  const filteredSellers = useMemo(() => {
    const query = normalizeSearch(searchFilter)
    if (!query) return sellers
    return sellers.filter(
      (s) =>
        normalizeSearch(s.sellerName).includes(query) ||
        normalizeSearch(s.sellerEmail).includes(query) ||
        s.items.some((item) => normalizeSearch(item.productName).includes(query))
    )
  }, [sellers, searchFilter])

  const totals = useMemo(() => {
    return sellers.reduce(
      (acc, s) => ({
        sellersCount: acc.sellersCount + 1,
        totalUnits: acc.totalUnits + s.totalUnits,
        totalValue: acc.totalValue + s.totalValue,
      }),
      { sellersCount: 0, totalUnits: 0, totalValue: 0 }
    )
  }, [sellers])

  const openReturnModal = (seller: AmbulanteSellerSummary, prefillAll = false) => {
    setSelectedSeller(seller)
    if (prefillAll) {
      const all: Record<string, number> = {}
      for (const item of seller.items) {
        all[item.productId] = item.quantity
      }
      setReturnQuantities(all)
    } else {
      setReturnQuantities({})
    }
  }

  const handleChangeQty = (productId: string, delta: number, maxQty: number) => {
    setReturnQuantities((prev) => {
      const current = prev[productId] || 0
      const next = Math.min(maxQty, Math.max(0, current + delta))
      const copy = { ...prev }
      if (next === 0) {
        delete copy[productId]
      } else {
        copy[productId] = next
      }
      return copy
    })
  }

  const handleConfirmReturn = async () => {
    if (!selectedSeller) return
    const itemsToReturn = Object.entries(returnQuantities)
      .filter(([, qty]) => qty > 0)
      .map(([productId, quantity]) => ({ productId, quantity }))

    if (itemsToReturn.length === 0) {
      showWarning('Nenhum item selecionado', 'Selecione ao menos uma unidade para devolver ao estoque.')
      return
    }

    setIsSubmitting(true)
    try {
      const response = await api.returnFromAmbulanteBag(itemsToReturn, selectedSeller.sellerId)
      if (!response.success) {
        throw new Error(response.error || 'Erro ao devolver sobras ao estoque geral.')
      }

      showSuccess(
        'Devolução concluída!',
        `Os itens de ${selectedSeller.sellerName} foram devolvidos ao estoque geral.`
      )
      setSelectedSeller(null)
      setReturnQuantities({})
      await loadAllBags()
    } catch (err) {
      showError('Erro na devolução', err instanceof Error ? err.message : 'Erro ao processar devolução')
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatMoney = (value: number) =>
    value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const smallBtn = 'p-0 flex items-center justify-center rounded-lg font-bold transition-colors leading-none'

  return (
    <div className="painel p-4 md:p-8 space-y-6">
      {/* Cabeçalho */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <span className="carimbo text-vagao-600 text-xs">☕ Vagão-restaurante · Coordenação</span>
            <h2 className="mt-3 text-2xl md:text-3xl font-display font-semibold uppercase tracking-wide text-ferro-900">
              Controle dos Ambulantes
            </h2>
            <p className="text-base text-ferro-700">
              Acompanhe o estoque em cada bag e faça a devolução de sobras ao final do turno
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadAllBags()}
            disabled={isLoading}
            className="self-start sm:self-auto px-4 py-2 bg-ferro-800 hover:bg-ferro-700 text-creme-100 font-display font-semibold text-sm rounded-lg transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Atualizando...' : '🔄 Atualizar'}
          </button>
        </div>
        <div className="trilho w-full mt-4" />
      </div>

      {/* Resumo Geral */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-creme-100 rounded-xl border border-ferro-200 p-4">
          <p className="text-xs uppercase tracking-wider text-ferro-500 font-display">Ambulantes com bag</p>
          <p className="text-2xl font-slab text-ferro-900 mt-1">{totals.sellersCount}</p>
        </div>
        <div className="bg-creme-100 rounded-xl border border-ferro-200 p-4">
          <p className="text-xs uppercase tracking-wider text-ferro-500 font-display">Total de itens em campo</p>
          <p className="text-2xl font-slab text-ferro-900 mt-1">
            {totals.totalUnits} {totals.totalUnits === 1 ? 'unidade' : 'unidades'}
          </p>
        </div>
        <div className="bg-creme-100 rounded-xl border border-ferro-200 p-4">
          <p className="text-xs uppercase tracking-wider text-ferro-500 font-display">Valor em mercadoria</p>
          <p className="text-2xl font-slab text-vagao-600 mt-1">R$ {formatMoney(totals.totalValue)}</p>
        </div>
      </div>

      {/* Busca */}
      <input
        type="text"
        value={searchFilter}
        onChange={(e) => setSearchFilter(e.target.value)}
        placeholder="🔍 Buscar por nome do ambulante, e-mail ou produto..."
        className="w-full"
      />

      {/* Lista de Ambulantes */}
      {isLoading ? (
        <div className="text-center py-10 text-ferro-600 font-medium">Carregando bags dos ambulantes...</div>
      ) : filteredSellers.length === 0 ? (
        <div className="bg-creme-100 rounded-xl border border-ferro-200 p-8 text-center space-y-2">
          <div className="text-5xl">🎒</div>
          <p className="text-ferro-800 font-semibold">
            {searchFilter ? 'Nenhum ambulante encontrado para esta busca.' : 'Nenhuma bag ativa no momento.'}
          </p>
          <p className="text-sm text-ferro-600">
            Assim que um vendedor abastecer a bag, os itens aparecerão aqui automaticamente.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredSellers.map((seller) => (
            <div
              key={seller.sellerId}
              className="flex flex-col bg-creme-50 rounded-xl border-2 border-ferro-800 shadow-sm overflow-hidden"
            >
              {/* Topo do Card */}
              <div className="p-4 bg-creme-100 border-b border-ferro-200 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-display font-semibold text-lg text-ferro-900 truncate">
                    {seller.sellerName}
                  </h3>
                  <p className="text-xs text-ferro-600 truncate">{seller.sellerEmail}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className="inline-block px-2.5 py-1 rounded-full bg-ferro-800 text-creme-100 text-xs font-semibold">
                    {seller.totalUnits} {seller.totalUnits === 1 ? 'un.' : 'uns.'}
                  </span>
                  <p className="font-slab text-sm text-vagao-600 mt-1">
                    R$ {formatMoney(seller.totalValue)}
                  </p>
                </div>
              </div>

              {/* Lista de Produtos na Bag */}
              <div className="p-4 flex-1 space-y-2">
                {seller.items.map((item) => (
                  <div
                    key={item.productId}
                    className="flex items-center justify-between text-sm bg-creme-100/70 px-3 py-2 rounded-lg border border-ferro-200"
                  >
                    <span className="font-medium text-ferro-900 truncate pr-2">{item.productName}</span>
                    <span className="font-slab text-ferro-800 flex-shrink-0">
                      {item.quantity}x <span className="text-xs text-ferro-500">(R$ {formatMoney(item.price)})</span>
                    </span>
                  </div>
                ))}
              </div>

              {/* Ações de Devolução */}
              <div className="p-3 bg-creme-100 border-t border-ferro-200 flex gap-2">
                <button
                  type="button"
                  onClick={() => openReturnModal(seller, false)}
                  className="flex-1 py-2 px-3 rounded-lg bg-creme-200 hover:bg-creme-300 text-ferro-900 border border-ferro-300 font-display font-semibold text-xs uppercase tracking-wide transition-colors"
                >
                  Devolução Parcial
                </button>
                <button
                  type="button"
                  onClick={() => openReturnModal(seller, true)}
                  className="flex-1 py-2 px-3 rounded-lg bg-vagao-600 hover:bg-vagao-700 text-creme-50 font-display font-semibold text-xs uppercase tracking-wide transition-colors"
                >
                  ↩️ Devolver Tudo
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Confirmação / Ajuste de Devolução */}
      {selectedSeller && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-creme-50 rounded-2xl border-2 border-ferro-800 shadow-bilhete w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
            <div className="p-5 border-b border-ferro-200 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-display font-semibold uppercase text-ferro-900">
                  ↩️ Devolver Sobras · {selectedSeller.sellerName}
                </h3>
                <p className="text-xs text-ferro-600 mt-0.5">
                  Confirme as quantidades que estão voltando para o estoque geral da lanchonete.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSeller(null)}
                disabled={isSubmitting}
                className="text-ferro-600 hover:text-ferro-900 font-bold text-lg px-2"
              >
                ✕
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-2.5 flex-1">
              {selectedSeller.items.map((item) => {
                const selectedQty = returnQuantities[item.productId] || 0
                return (
                  <div
                    key={item.productId}
                    className="flex items-center justify-between gap-3 bg-creme-100 p-3 rounded-xl border border-ferro-200"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm text-ferro-900 truncate">{item.productName}</p>
                      <p className="text-xs text-ferro-600">
                        Na bag do vendedor: <strong>{item.quantity} un.</strong>
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleChangeQty(item.productId, -1, item.quantity)}
                        disabled={isSubmitting || selectedQty === 0}
                        className={`${smallBtn} w-8 h-8 bg-creme-200 hover:bg-creme-300 border border-ferro-300 text-ferro-900 text-base disabled:opacity-40`}
                      >
                        −
                      </button>
                      <span className="w-7 text-center font-semibold text-sm text-ferro-900">{selectedQty}</span>
                      <button
                        type="button"
                        onClick={() => handleChangeQty(item.productId, 1, item.quantity)}
                        disabled={isSubmitting || selectedQty >= item.quantity}
                        className={`${smallBtn} w-8 h-8 bg-ferro-800 hover:bg-ferro-700 text-creme-100 text-base disabled:opacity-40`}
                      >
                        +
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="p-4 border-t border-ferro-200 bg-creme-100 flex gap-2">
              <button
                type="button"
                onClick={() => setSelectedSeller(null)}
                disabled={isSubmitting}
                className="flex-1 py-2.5 px-3 rounded-lg bg-creme-200 hover:bg-creme-300 text-ferro-800 border border-ferro-300 font-display font-semibold text-sm disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmReturn()}
                disabled={isSubmitting || Object.keys(returnQuantities).length === 0}
                className="flex-1 py-2.5 px-3 rounded-lg bg-vagao-600 hover:bg-vagao-700 text-creme-50 font-display font-semibold text-sm disabled:opacity-50"
              >
                {isSubmitting ? 'Devolvendo...' : 'Confirmar Devolução'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AmbulantesControlPage