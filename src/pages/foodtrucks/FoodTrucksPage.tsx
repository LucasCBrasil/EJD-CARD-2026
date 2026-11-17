import React, { useMemo, useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { TrainLoader } from '../../components/shared'
import { useFoodTrucks } from '../../hooks/useFoodTrucks'
import type { FoodTruck, FoodTruckMenuItem } from '../../types'

const formatPrice = (price: number) =>
  price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

/** Agrupa os itens por seção, mantendo a ordem em que cada seção aparece. */
function groupBySection(items: FoodTruckMenuItem[]) {
  const groups = new Map<string, FoodTruckMenuItem[]>()
  for (const item of items) {
    const list = groups.get(item.section) || []
    list.push(item)
    groups.set(item.section, list)
  }
  return Array.from(groups, ([section, sectionItems]) => ({ section, items: sectionItems }))
}

interface ThumbProps {
  src: string | null
  alt: string
  fallback: string
  className: string
}

/** Imagem com fallback temático (emoji) quando não há foto ou ela falha. */
const Thumb: React.FC<ThumbProps> = (props) => <ThumbImage key={props.src ?? 'none'} {...props} />

// O key acima remonta este componente quando a URL muda (ex.: logo trocada),
// zerando o estado de falha.
const ThumbImage: React.FC<ThumbProps> = ({
  src,
  alt,
  fallback,
  className,
}) => {
  const [failed, setFailed] = useState(false)
  if (!src || failed) {
    return (
      <div className={`${className} flex items-center justify-center bg-creme-200 border border-ferro-200`} aria-hidden="true">
        <span className="text-2xl">{fallback}</span>
      </div>
    )
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={`${className} object-cover border border-ferro-200`}
    />
  )
}

/**
 * Aviso de que a venda não é feita pelo site.
 * Cor e ícone diferentes de tudo que é ação de compra no app (efeito Von
 * Restorff), sem nenhum botão: é informação, não chamada para ação.
 */
const NoSaleNotice: React.FC = () => (
  <div
    role="note"
    aria-label="Aviso sobre a compra nos food trucks"
    className="flex items-start gap-3 rounded-xl border-2 border-ferro-900 bg-anil-700 text-creme-50 px-4 py-3 shadow-bilhete"
  >
    <span className="text-2xl leading-none mt-0.5" aria-hidden="true">📍</span>
    <div>
      <p className="font-display font-semibold uppercase tracking-wide">Compra direto no food truck</p>
      <p className="text-sm text-creme-100">
        Aqui você só confere o cardápio. Pedido e pagamento são feitos no próprio food truck, não pelo site.
      </p>
    </div>
  </div>
)

const TruckMenu: React.FC<{ truck: FoodTruck }> = ({ truck }) => {
  const sections = useMemo(() => groupBySection(truck.items), [truck.items])
  // Só reserva espaço para foto se algum item do food truck tiver foto
  const showThumbs = truck.items.some((item) => !!item.imageUrl)

  return (
    <section aria-label={`Cardápio do ${truck.name}`} className="mt-5">
      <div className="bilhete flex items-center gap-4 px-4 py-4">
        <Thumb src={truck.logoUrl} alt={`Logo do ${truck.name}`} fallback="🚚" className="w-16 h-16 rounded-xl shrink-0" />
        <div className="min-w-0">
          <h3 className="text-xl font-display font-semibold uppercase tracking-wide text-ferro-900 break-words">
            {truck.name}
          </h3>
          {truck.description && <p className="text-sm text-ferro-600">{truck.description}</p>}
        </div>
      </div>

      {sections.length === 0 ? (
        <div className="mt-4 bg-creme-100 rounded-xl border border-ferro-200 p-6 text-center text-ferro-600">
          O cardápio deste food truck ainda não foi cadastrado.
        </div>
      ) : (
        <div className="mt-4 space-y-6">
          {sections.map(({ section, items }) => (
            <div key={section}>
              <h4 className="font-display font-semibold uppercase tracking-[0.15em] text-sm text-vagao-600">
                {section}
              </h4>
              <div className="trilho w-full mt-1 mb-2" />
              <ul className="divide-y divide-ferro-200">
                {items.map((item) => (
                  <li key={item.id} className="flex items-start gap-3 py-3 cursor-default">
                    {showThumbs && (
                      <Thumb src={item.imageUrl} alt="" fallback="🍽️" className="w-16 h-16 rounded-lg shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-ferro-900 break-words">{item.name}</p>
                      {item.description && <p className="text-sm text-ferro-600 break-words">{item.description}</p>}
                    </div>
                    <p className="font-slab text-lg text-ferro-900 whitespace-nowrap">{formatPrice(item.price)}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* Lembrete no fim do cardápio: a última coisa lida é como comprar */}
      <p className="mt-6 rounded-xl border border-dashed border-ferro-400 bg-creme-100 px-4 py-3 text-sm text-ferro-700 text-center">
        🚚 Gostou? Faça o pedido e pague direto no <strong>{truck.name}</strong>.
        Preços e disponibilidade são definidos pelo food truck.
      </p>
    </section>
  )
}

const FoodTrucksPage: React.FC = () => {
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as { truck?: string }
  const { data: trucks = [], isLoading, isError, refetch } = useFoodTrucks()

  const selected = trucks.find((t) => t.id === search.truck) || trucks[0]

  const selectTruck = (id: string) => {
    navigate({ to: '/food-trucks', search: { truck: id }, replace: true })
  }

  return (
    <div className="painel p-4 md:p-8 text-ferro-900">
      <div className="mb-5">
        <span className="carimbo text-anil-700 text-xs">🚚 Parceiros do encontro</span>
        <h2 className="mt-3 text-2xl md:text-3xl font-display font-semibold uppercase tracking-wide text-ferro-900">
          Food Trucks
        </h2>
        <p className="text-base text-ferro-700">Confira os cardápios dos food trucks parceiros</p>
        <div className="trilho w-full mt-4" />
      </div>

      <NoSaleNotice />

      {isLoading ? (
        <TrainLoader fullScreen={false} title="Carregando..." message="Buscando os cardápios" />
      ) : isError ? (
        <div role="alert" className="mt-5 bg-creme-100 rounded-xl border border-ferro-200 p-8 text-center text-vagao-700">
          Não foi possível carregar os cardápios.{' '}
          <button type="button" className="underline" onClick={() => void refetch()}>
            Tentar de novo
          </button>
        </div>
      ) : trucks.length === 0 || !selected ? (
        <div className="mt-5 bg-creme-100 rounded-xl border border-ferro-200 p-8 text-center">
          <div className="text-5xl mb-3" aria-hidden="true">🚉</div>
          <p className="text-ferro-600">Nenhum food truck cadastrado ainda. Volte mais perto do encontro!</p>
        </div>
      ) : (
        <>
          {trucks.length > 1 && (
            <div className="mt-5">
              <p id="food-truck-picker-label" className="text-sm font-semibold text-ferro-800 mb-2">
                Escolha o food truck
              </p>
              <div
                role="group"
                aria-labelledby="food-truck-picker-label"
                className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1"
              >
                {trucks.map((truck) => {
                  const active = truck.id === selected.id
                  return (
                    <button
                      key={truck.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => selectTruck(truck.id)}
                      className={`flex items-center gap-2 shrink-0 min-h-[44px] rounded-xl border-2 px-3 py-2 font-display text-sm uppercase tracking-wide transition-colors touch-manipulation ${
                        active
                          ? 'bg-latao-400 border-ferro-900 text-ferro-900 shadow-md'
                          : 'bg-creme-50 border-ferro-300 text-ferro-700 hover:bg-creme-200'
                      }`}
                    >
                      <Thumb src={truck.logoUrl} alt="" fallback="🚚" className="w-8 h-8 rounded-lg" />
                      {truck.name}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <TruckMenu key={selected.id} truck={selected} />
        </>
      )}
    </div>
  )
}

export default FoodTrucksPage
