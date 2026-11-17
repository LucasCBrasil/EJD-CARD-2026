import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Button, ConfirmationModal, CurrencyInput, TrainLoader } from '../../components/shared'
import { usePermissions } from '../../hooks/usePermissions'
import { useFoodTrucks, useManageFoodTrucks } from '../../hooks/useFoodTrucks'
import { useToastContext } from '../../contexts/ToastContext'
import { uploadFoodTruckImage, validateFoodTruckImage, FOOD_TRUCK_IMAGE_TYPES } from '../../services/foodTruckImages'
import { groupMenuBySection } from '../../lib/foodTrucks'
import type { FoodTruck, FoodTruckMenuItem } from '../../types'

const labelClass = 'block text-sm font-display font-semibold uppercase tracking-wide text-ferro-800 mb-2'
const hintClass = 'text-xs text-ferro-500 mt-1'

const formatPrice = (price: number) =>
  price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// ---------------------------------------------------------------------------
// Seletor de imagem (preview + trocar + remover)
// ---------------------------------------------------------------------------

interface ImageState {
  file: File | null
  removed: boolean
  /** URL do arquivo já enviado; evita reenviar se a gravação falhar e o admin tentar de novo */
  uploadedUrl?: string
}

/**
 * Resolve a imagem no momento de salvar:
 * - arquivo novo: envia (uma vez só) e retorna a URL
 * - removida: null
 * - sem mudança: undefined (o campo não é enviado no PUT)
 */
async function resolveImage(
  state: ImageState,
  kind: 'logo' | 'item',
  onUploaded: (url: string) => void
): Promise<string | null | undefined> {
  if (state.file) {
    if (state.uploadedUrl) return state.uploadedUrl
    const url = await uploadFoodTruckImage(state.file, kind)
    onUploaded(url)
    return url
  }
  if (state.removed) return null
  return undefined
}

/** Ao abrir o formulário (novo ou "Editar"), rola até ele e foca o primeiro campo. */
function useRevealOnMount() {
  const ref = useRef<HTMLFormElement>(null)
  useEffect(() => {
    const form = ref.current
    if (!form) return
    form.scrollIntoView({ behavior: 'smooth', block: 'start' })
    form.querySelector<HTMLInputElement>('input:not([type="file"])')?.focus({ preventScroll: true })
  }, [])
  return ref
}

const ImagePicker: React.FC<{
  id: string
  label: string
  currentUrl: string | null
  state: ImageState
  onChange: (state: ImageState) => void
  onInvalid: (message: string) => void
}> = ({ id, label, currentUrl, state, onChange, onInvalid }) => {
  const preview = useMemo(() => (state.file ? URL.createObjectURL(state.file) : null), [state.file])

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  const shown = preview || (state.removed ? null : currentUrl)

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const invalid = validateFoodTruckImage(file)
    if (invalid) {
      onInvalid(invalid)
      return
    }
    onChange({ file, removed: false })
  }

  return (
    <div>
      <span className={labelClass}>
        {label} <span className="text-ferro-500 font-body font-normal normal-case tracking-normal text-xs">(opcional)</span>
      </span>
      <div className="flex items-center gap-3">
        <div className="w-20 h-20 rounded-xl border-2 border-ferro-300 bg-creme-200 flex items-center justify-center overflow-hidden shrink-0">
          {shown ? (
            <img src={shown} alt={`Prévia: ${label}`} className="w-full h-full object-cover" />
          ) : (
            <span className="text-3xl" aria-hidden="true">🖼️</span>
          )}
        </div>
        <div className="flex flex-col gap-2">
          {/* input antes do label para o label mostrar o foco do teclado (peer) */}
          <input
            id={id}
            type="file"
            accept={FOOD_TRUCK_IMAGE_TYPES.join(',')}
            onChange={handleFile}
            aria-label={`${label}: ${shown ? 'trocar imagem' : 'escolher imagem'}`}
            className="sr-only peer"
          />
          <label
            htmlFor={id}
            className="cursor-pointer text-center px-4 py-2 text-sm font-display font-semibold tracking-wide rounded-xl bg-creme-200 hover:bg-creme-300 text-ferro-800 border-2 border-ferro-200 peer-focus-visible:ring-2 peer-focus-visible:ring-latao-400 peer-focus-visible:ring-offset-2"
          >
            {shown ? 'Trocar imagem' : 'Escolher imagem'}
          </label>
          {shown && (
            <button
              type="button"
              onClick={() => onChange({ file: null, removed: true })}
              className="text-sm text-vagao-700 underline"
            >
              Remover imagem
            </button>
          )}
        </div>
      </div>
      <p className={hintClass}>JPG, PNG ou WEBP, até 5MB.</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Formulário do food truck
// ---------------------------------------------------------------------------

const TruckForm: React.FC<{ initial: FoodTruck | null; onDone: () => void }> = ({ initial, onDone }) => {
  const manage = useManageFoodTrucks()
  const { showError } = useToastContext()
  const [name, setName] = useState(initial?.name || '')
  const [description, setDescription] = useState(initial?.description || '')
  const [sortOrder, setSortOrder] = useState(String(initial?.sortOrder ?? 0))
  const [logo, setLogo] = useState<ImageState>({ file: null, removed: false })
  const formRef = useRevealOnMount()
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      showError('Campo obrigatório', 'Informe o nome do food truck.')
      return
    }
    setSaving(true)
    let logoUrl: string | null | undefined
    try {
      logoUrl = await resolveImage(logo, 'logo', (url) => setLogo((s) => ({ ...s, uploadedUrl: url })))
    } catch (err) {
      showError('Erro na imagem', (err as Error).message)
      setSaving(false)
      return
    }
    try {
      const data: Record<string, unknown> = {
        entity: 'truck',
        name: name.trim(),
        description: description.trim() || null,
        sortOrder: Number(sortOrder) || 0,
      }
      if (logoUrl !== undefined) data.logoUrl = logoUrl
      if (initial) data.id = initial.id

      await manage.mutateAsync({
        method: initial ? 'PUT' : 'POST',
        data,
        successMessage: initial ? 'Food truck atualizado.' : 'Food truck cadastrado.',
      })
      onDone()
    } catch {
      // Erro de gravação já vira toast no hook useManageFoodTrucks
    } finally {
      setSaving(false)
    }
  }

  return (
    <form ref={formRef} onSubmit={submit} className="bilhete p-4 sm:p-5 space-y-4 scroll-mt-4">
      <h4 className="font-display font-semibold uppercase tracking-wide text-ferro-900">
        {initial ? `Editar ${initial.name}` : 'Novo food truck'}
      </h4>
      <div>
        <label htmlFor="truck-name" className={labelClass}>Nome</label>
        <input id="truck-name" type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required className="w-full" placeholder="Ex.: Burguer do Trem" />
      </div>
      <div>
        <label htmlFor="truck-description" className={labelClass}>
          Descrição <span className="text-ferro-500 font-body font-normal normal-case tracking-normal text-xs">(opcional)</span>
        </label>
        <textarea id="truck-description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} rows={2} className="w-full" placeholder="Ex.: Hambúrgueres artesanais e batata rústica" />
      </div>
      <div>
        <label htmlFor="truck-order" className={labelClass}>Ordem de exibição</label>
        <input id="truck-order" type="number" inputMode="numeric" step={1} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="w-28" />
        <p className={hintClass}>Menor aparece primeiro. Empate: ordem alfabética.</p>
      </div>
      <ImagePicker
        id="truck-logo"
        label="Logo"
        currentUrl={initial?.logoUrl || null}
        state={logo}
        onChange={setLogo}
        onInvalid={(msg) => showError('Imagem inválida', msg)}
      />
      <div className="flex flex-col sm:flex-row gap-2 pt-2">
        <Button type="submit" disabled={saving} className="sm:flex-1">
          {saving ? 'Salvando...' : 'Salvar food truck'}
        </Button>
        <Button type="button" variant="secondary" onClick={onDone} disabled={saving}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Formulário do item do cardápio
// ---------------------------------------------------------------------------

const ItemForm: React.FC<{
  truckId: string
  initial: FoodTruckMenuItem | null
  sections: string[]
  onDone: () => void
}> = ({ truckId, initial, sections, onDone }) => {
  const manage = useManageFoodTrucks()
  const { showError } = useToastContext()
  const [section, setSection] = useState(initial?.section || sections[0] || '')
  const [name, setName] = useState(initial?.name || '')
  const [description, setDescription] = useState(initial?.description || '')
  const [price, setPrice] = useState(initial?.price || 0)
  const [sortOrder, setSortOrder] = useState(String(initial?.sortOrder ?? 0))
  const [photo, setPhoto] = useState<ImageState>({ file: null, removed: false })
  const formRef = useRevealOnMount()
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      showError('Campo obrigatório', 'Informe o nome do item.')
      return
    }
    if (!(price > 0)) {
      showError('Preço inválido', 'O preço deve ser maior que zero.')
      return
    }
    setSaving(true)
    let imageUrl: string | null | undefined
    try {
      imageUrl = await resolveImage(photo, 'item', (url) => setPhoto((s) => ({ ...s, uploadedUrl: url })))
    } catch (err) {
      showError('Erro na imagem', (err as Error).message)
      setSaving(false)
      return
    }
    try {
      const data: Record<string, unknown> = {
        entity: 'item',
        section: section.trim() || 'Cardápio',
        name: name.trim(),
        description: description.trim() || null,
        price,
        sortOrder: Number(sortOrder) || 0,
      }
      if (imageUrl !== undefined) data.imageUrl = imageUrl
      if (initial) data.id = initial.id
      else data.foodTruckId = truckId

      await manage.mutateAsync({
        method: initial ? 'PUT' : 'POST',
        data,
        successMessage: initial ? 'Item atualizado.' : 'Item adicionado ao cardápio.',
      })
      onDone()
    } catch {
      // Erro de gravação já vira toast no hook useManageFoodTrucks
    } finally {
      setSaving(false)
    }
  }

  return (
    <form ref={formRef} onSubmit={submit} className="bilhete p-4 sm:p-5 space-y-4 scroll-mt-4">
      <h4 className="font-display font-semibold uppercase tracking-wide text-ferro-900">
        {initial ? `Editar ${initial.name}` : 'Novo item do cardápio'}
      </h4>
      <div>
        <label htmlFor="item-section" className={labelClass}>Seção</label>
        <input id="item-section" type="text" list="item-sections" value={section} onChange={(e) => setSection(e.target.value)} maxLength={40} className="w-full" placeholder="Ex.: Lanches, Bebidas, Sobremesas" />
        <datalist id="item-sections">
          {sections.map((s) => <option key={s} value={s} />)}
        </datalist>
        <p className={hintClass}>Em branco vira "Cardápio".</p>
      </div>
      <div>
        <label htmlFor="item-name" className={labelClass}>Nome</label>
        <input id="item-name" type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required className="w-full" placeholder="Ex.: X-Salada" />
      </div>
      <div>
        <label htmlFor="item-description" className={labelClass}>
          Descrição <span className="text-ferro-500 font-body font-normal normal-case tracking-normal text-xs">(opcional)</span>
        </label>
        <textarea id="item-description" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} rows={2} className="w-full" placeholder="Ex.: Pão brioche, 180g, queijo e salada" />
      </div>
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="sm:flex-1">
          <label htmlFor="item-price" className={labelClass}>Preço</label>
          <CurrencyInput id="item-price" value={price} onChange={setPrice} max={10000} placeholder="0,00" />
        </div>
        <div>
          <label htmlFor="item-order" className={labelClass}>Ordem</label>
          <input id="item-order" type="number" inputMode="numeric" step={1} value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="w-28" aria-describedby="item-order-hint" />
          <p id="item-order-hint" className={hintClass}>Menor vem primeiro. A seção segue o item de menor ordem.</p>
        </div>
      </div>
      <ImagePicker
        id="item-photo"
        label="Foto do item"
        currentUrl={initial?.imageUrl || null}
        state={photo}
        onChange={setPhoto}
        onInvalid={(msg) => showError('Imagem inválida', msg)}
      />
      <div className="flex flex-col sm:flex-row gap-2 pt-2">
        <Button type="submit" disabled={saving} className="sm:flex-1">
          {saving ? 'Salvando...' : 'Salvar item'}
        </Button>
        <Button type="button" variant="secondary" onClick={onDone} disabled={saving}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------

type PendingDelete =
  | { kind: 'truck'; truck: FoodTruck }
  | { kind: 'item'; item: FoodTruckMenuItem }

const smallBtn = 'px-3 py-1.5 text-xs font-display font-semibold uppercase tracking-wide rounded-lg border-2 transition-colors'

const FoodTrucksAdminPage: React.FC = () => {
  const { canManageFoodTrucks } = usePermissions()
  const { data: trucks = [], isLoading, isError, refetch } = useFoodTrucks(canManageFoodTrucks)
  const manage = useManageFoodTrucks()

  const [truckForm, setTruckForm] = useState<{ open: boolean; truck: FoodTruck | null }>({ open: false, truck: null })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [itemForm, setItemForm] = useState<{ open: boolean; item: FoodTruckMenuItem | null }>({ open: false, item: null })
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null)

  const selected = trucks.find((t) => t.id === selectedId) || null
  const itemsBySection = useMemo(() => groupMenuBySection(selected?.items || []), [selected])
  const sections = itemsBySection.map((g) => g.section)

  if (!canManageFoodTrucks) {
    return (
      <div className="painel border-2 !border-vagao-600/40 p-6 sm:p-8 text-center">
        <div className="text-5xl mb-4">🚫</div>
        <h2 className="text-2xl font-display font-semibold uppercase text-vagao-600 mb-3">Acesso Negado</h2>
        <p className="text-ferro-700">Você não tem permissão para acessar esta área.</p>
      </div>
    )
  }

  const toggleActive = (truck: FoodTruck) =>
    manage.mutate({
      method: 'PUT',
      data: { entity: 'truck', id: truck.id, active: !truck.active },
      successMessage: truck.active ? `${truck.name} ocultado da página.` : `${truck.name} visível na página.`,
    })

  const confirmDelete = async () => {
    if (!pendingDelete) return
    try {
      if (pendingDelete.kind === 'truck') {
        await manage.mutateAsync({
          method: 'DELETE',
          data: { entity: 'truck', id: pendingDelete.truck.id },
          successMessage: 'Food truck excluído.',
        })
        const id = pendingDelete.truck.id
        if (selectedId === id) {
          setSelectedId(null)
          setItemForm({ open: false, item: null })
        }
        if (truckForm.truck?.id === id) setTruckForm({ open: false, truck: null })
      } else {
        await manage.mutateAsync({
          method: 'DELETE',
          data: { entity: 'item', id: pendingDelete.item.id },
          successMessage: 'Item excluído.',
        })
        if (itemForm.item?.id === pendingDelete.item.id) setItemForm({ open: false, item: null })
      }
    } catch {
      // toast já exibido pelo hook
    } finally {
      setPendingDelete(null)
    }
  }

  return (
    <div className="painel text-ferro-900 p-4 sm:p-8 space-y-8">
      <div>
        <Link to="/admin" className="text-sm text-ferro-600 underline">← Painel administrativo</Link>
        <h2 className="mt-2 text-2xl sm:text-3xl font-display font-semibold uppercase text-ferro-900 leading-tight">
          Food Trucks
        </h2>
        <p className="text-sm text-ferro-500 mt-1">
          Cadastre os food trucks parceiros e seus cardápios. Os usuários só visualizam: a compra é feita direto no food truck.
        </p>
        <div className="trilho w-full mt-4" />
      </div>

      {/* Food trucks */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-display font-semibold uppercase tracking-wide text-ferro-800">Food trucks</h3>
          {!truckForm.open && (
            <Button size="sm" onClick={() => setTruckForm({ open: true, truck: null })}>+ Novo food truck</Button>
          )}
        </div>

        {truckForm.open && (
          <TruckForm
            key={truckForm.truck?.id || 'new'}
            initial={truckForm.truck}
            onDone={() => setTruckForm({ open: false, truck: null })}
          />
        )}

        {isLoading ? (
          <TrainLoader fullScreen={false} title="Carregando..." message="Buscando food trucks" />
        ) : isError ? (
          <div role="alert" className="bg-creme-100 rounded-xl border border-ferro-200 p-6 text-center text-vagao-700">
            Não foi possível carregar os food trucks.{' '}
            <button type="button" className="underline" onClick={() => void refetch()}>Tentar de novo</button>
          </div>
        ) : trucks.length === 0 ? (
          <p className="bg-creme-100 rounded-xl border border-ferro-200 p-6 text-center text-ferro-600">
            Nenhum food truck cadastrado ainda.
          </p>
        ) : (
          <ul className="space-y-3">
            {trucks.map((truck) => (
              <li
                key={truck.id}
                className={`rounded-xl border-2 bg-creme-50 p-3 sm:p-4 ${
                  truck.id === selectedId ? 'border-latao-500 ring-2 ring-latao-300' : 'border-ferro-800/80'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-creme-200 border border-ferro-200 overflow-hidden flex items-center justify-center shrink-0">
                    {truck.logoUrl ? (
                      <img src={truck.logoUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xl" aria-hidden="true">🚚</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-display font-semibold uppercase tracking-wide break-words">{truck.name}</p>
                    <p className="text-xs text-ferro-500">
                      {truck.items.length} {truck.items.length === 1 ? 'item' : 'itens'} · ordem {truck.sortOrder}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-xs font-display uppercase tracking-wide px-2 py-1 rounded-md border ${
                      truck.active ? 'bg-green-50 text-green-800 border-green-300' : 'bg-creme-200 text-ferro-600 border-ferro-300'
                    }`}
                  >
                    {truck.active ? 'Visível' : 'Oculto'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(truck.id)
                      setItemForm({ open: false, item: null })
                    }}
                    className={`${smallBtn} bg-ferro-800 text-creme-200 border-ferro-800 hover:bg-ferro-700`}
                  >
                    Cardápio
                  </button>
                  <button
                    type="button"
                    onClick={() => setTruckForm({ open: true, truck })}
                    className={`${smallBtn} bg-creme-200 text-ferro-800 border-ferro-200 hover:bg-creme-300`}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleActive(truck)}
                    disabled={manage.isPending}
                    className={`${smallBtn} bg-creme-200 text-ferro-800 border-ferro-200 hover:bg-creme-300 disabled:opacity-50`}
                  >
                    {truck.active ? 'Ocultar' : 'Mostrar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingDelete({ kind: 'truck', truck })}
                    className={`${smallBtn} bg-creme-50 text-vagao-700 border-vagao-300 hover:bg-vagao-50`}
                  >
                    Excluir
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Cardápio do food truck selecionado */}
      {selected && (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-display font-semibold uppercase tracking-wide text-ferro-800 break-words">
              Cardápio: {selected.name}
            </h3>
            {!itemForm.open && (
              <Button size="sm" onClick={() => setItemForm({ open: true, item: null })}>+ Novo item</Button>
            )}
          </div>

          {itemForm.open && (
            <ItemForm
              key={itemForm.item?.id || `new-${selected.id}`}
              truckId={selected.id}
              initial={itemForm.item}
              sections={sections}
              onDone={() => setItemForm({ open: false, item: null })}
            />
          )}

          {itemsBySection.length === 0 ? (
            <p className="bg-creme-100 rounded-xl border border-ferro-200 p-6 text-center text-ferro-600">
              Nenhum item no cardápio ainda.
            </p>
          ) : (
            itemsBySection.map(({ section, items }) => (
              <div key={section}>
                <h4 className="font-display font-semibold uppercase tracking-[0.15em] text-sm text-vagao-600">{section}</h4>
                <ul className="mt-2 divide-y divide-ferro-200 rounded-xl border border-ferro-200 bg-creme-50">
                  {items.map((item) => (
                    <li key={item.id} className="flex items-center gap-3 p-3">
                      <div className="w-12 h-12 rounded-lg bg-creme-200 border border-ferro-200 overflow-hidden flex items-center justify-center shrink-0">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-lg" aria-hidden="true">🍽️</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold break-words">{item.name}</p>
                        <p className="text-sm text-ferro-600">{formatPrice(item.price)} · ordem {item.sortOrder}</p>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setItemForm({ open: true, item })}
                          className={`${smallBtn} bg-creme-200 text-ferro-800 border-ferro-200 hover:bg-creme-300`}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDelete({ kind: 'item', item })}
                          className={`${smallBtn} bg-creme-50 text-vagao-700 border-vagao-300 hover:bg-vagao-50`}
                        >
                          Excluir
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </section>
      )}

      <ConfirmationModal
        isOpen={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => void confirmDelete()}
        isLoading={manage.isPending}
        icon="🗑️"
        title={pendingDelete?.kind === 'truck' ? 'Excluir food truck?' : 'Excluir item?'}
        message={
          pendingDelete?.kind === 'truck'
            ? `"${pendingDelete.truck.name}" e todos os ${pendingDelete.truck.items.length} itens do cardápio serão apagados. Para tirar da página sem apagar, use "Ocultar".`
            : pendingDelete
              ? `"${pendingDelete.item.name}" será removido do cardápio.`
              : ''
        }
      />
    </div>
  )
}

export default FoodTrucksAdminPage
