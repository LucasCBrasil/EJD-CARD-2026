import React, { useMemo, useState } from 'react'
import { TrainLoader } from '../../components/shared'
import OptimizedImage from '../../components/ui/OptimizedImage'
import { useLojinhaCatalog } from '../../hooks/useProducts'
import { filterLojinhaCatalogItems, type LojinhaCatalogItem } from '../../lib/lojinhaCatalog'

const formatPrice = (price: number): string =>
  price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/**
 * Aviso informativo: deixa explícito que a vitrine é somente visualização
 * e que a compra acontece presencialmente na lojinha (sem ação de compra no site).
 */
const InPersonPurchaseNotice: React.FC = () => (
  <div
    role="note"
    aria-label="Aviso sobre compras na lojinha"
    className="flex items-start gap-3 rounded-xl border-2 border-ferro-900 bg-anil-700 text-creme-50 px-4 py-3 shadow-bilhete"
  >
    <span className="text-2xl leading-none mt-0.5" aria-hidden="true">📍</span>
    <div>
      <p className="font-display font-semibold uppercase tracking-wide">
        Compra presencial na lojinha
      </p>
      <p className="text-sm text-creme-100">
        Aqui você só confere os itens e valores. A compra não é feita pelo site — passe na lojinha para escolher e pagar com seu saldo.
      </p>
    </div>
  </div>
)

const CatalogProductCard: React.FC<{ item: LojinhaCatalogItem }> = ({ item }) => {
  const isOutOfStock = item.outOfStock

  return (
    <article
      aria-label={isOutOfStock ? `${item.name} — Em falta` : item.name}
      className={`rounded-xl border-2 overflow-hidden flex flex-col transition-shadow duration-300 ${
        isOutOfStock
          ? 'bg-creme-100/90 border-ferro-400/80 shadow-none'
          : 'bg-creme-50 border-ferro-800 shadow-sm hover:shadow-bilhete'
      }`}
    >
      <div className="relative bg-creme-200">
        <div className={isOutOfStock ? 'opacity-45 grayscale-[35%]' : undefined}>
          <OptimizedImage
            src={item.imageUrl}
            alt={item.name}
            className="h-44 bg-creme-200"
            context="lojinha"
          />
        </div>

        {isOutOfStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-ferro-900/15 pointer-events-none">
            <span className="carimbo bg-creme-50/95 text-vagao-700 border-2 border-vagao-600 text-xs px-3 py-1 shadow-sm -rotate-3">
              Em falta
            </span>
          </div>
        )}
      </div>

      <div className="picote-horizontal p-4 flex-1 flex flex-col justify-between gap-3">
        <div className="space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <h3
              className={`min-w-0 flex-1 text-lg font-display font-semibold leading-snug break-words ${
                isOutOfStock ? 'text-ferro-600' : 'text-ferro-900'
              }`}
              title={item.name}
            >
              {item.name}
            </h3>
            {isOutOfStock && (
              <span className="inline-flex shrink-0 rounded-full bg-vagao-50 border border-vagao-300 px-2.5 py-0.5 text-[11px] font-display font-semibold uppercase tracking-wide text-vagao-700">
                Em falta
              </span>
            )}
          </div>

          {item.description && (
            <p className={`text-sm leading-snug break-words ${isOutOfStock ? 'text-ferro-500' : 'text-ferro-600'}`}>
              {item.description}
            </p>
          )}
        </div>

        <div
          className={`rounded-xl px-3 py-2 border flex items-center justify-between ${
            isOutOfStock
              ? 'bg-creme-200/70 border-ferro-200'
              : 'bg-creme-100 border-ferro-200'
          }`}
        >
          <span className="text-sm text-ferro-500">Preço</span>
          <span
            className={`font-slab text-lg ${
              isOutOfStock ? 'text-ferro-500' : 'text-vagao-600'
            }`}
          >
            {formatPrice(item.price)}
          </span>
        </div>
      </div>
    </article>
  )
}

const LojinhaCatalogPage: React.FC = () => {
  const { data: items = [], isLoading, isError, refetch } = useLojinhaCatalog()
  const [search, setSearch] = useState('')

  const filteredItems = useMemo(
    () => filterLojinhaCatalogItems(items, search),
    [items, search],
  )

  return (
    <div className="painel p-4 md:p-8 text-ferro-900">
      <div className="mb-5">
        <span className="carimbo text-vagao-600 text-xs">🏪 Vitrine da estação</span>
        <h2 className="mt-3 text-2xl md:text-3xl font-display font-semibold uppercase tracking-wide text-ferro-900">
          Lojinha
        </h2>
        <p className="text-base text-ferro-700">
          Confira os itens disponíveis na lojinha do encontrão
        </p>
        <div className="trilho w-full mt-4" />
      </div>

      <InPersonPurchaseNotice />

      {isLoading ? (
        <TrainLoader fullScreen={false} title="Carregando..." message="Buscando os itens da lojinha" />
      ) : isError ? (
        <div
          role="alert"
          className="mt-5 bg-creme-100 rounded-xl border border-ferro-200 p-8 text-center text-vagao-700"
        >
          Não foi possível carregar os itens da lojinha.{' '}
          <button type="button" className="underline font-semibold" onClick={() => void refetch()}>
            Tentar de novo
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="mt-5 bg-creme-100 rounded-xl border border-ferro-200 p-8 text-center">
          <div className="text-5xl mb-3" aria-hidden="true">🚉</div>
          <p className="text-ferro-600">
            Nenhum item cadastrado na lojinha ainda. Volte mais tarde!
          </p>
        </div>
      ) : (
        <>
          <div className="mt-5 relative">
            <label htmlFor="lojinha-catalog-search" className="sr-only">
              Buscar item na lojinha
            </label>
            <input
              id="lojinha-catalog-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar item na lojinha..."
              className="w-full rounded-xl border-2 border-ferro-300 bg-creme-50 px-4 py-2.5 pr-10 text-sm text-ferro-900 placeholder:text-ferro-400 focus:border-ferro-800 focus:outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                aria-label="Limpar busca"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-sm font-semibold text-ferro-500 hover:bg-creme-200 hover:text-ferro-900"
              >
                ✕
              </button>
            )}
          </div>

          {filteredItems.length === 0 ? (
            <div className="mt-5 bg-creme-100 rounded-xl border border-ferro-200 p-8 text-center">
              <p className="text-ferro-600">
                Nenhum item encontrado para <strong>"{search.trim()}"</strong>.
              </p>
            </div>
          ) : (
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredItems.map((item) => (
                <CatalogProductCard key={item.id} item={item} />
              ))}
            </div>
          )}

          <p className="mt-6 rounded-xl border border-dashed border-ferro-400 bg-creme-100 px-4 py-3 text-sm text-ferro-700 text-center">
            🏪 Gostou de algo? Passe na <strong>Lojinha</strong> durante o encontrão para comprar com seu saldo.
          </p>
        </>
      )}
    </div>
  )
}

export default LojinhaCatalogPage
