import { useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Header } from '../../components/shared'
import { useToastContext } from '../../contexts/ToastContext'
import { usePermissions } from '../../hooks/usePermissions'
import { productKeys, useProducts } from '../../hooks/useProducts'
import { lanchoneteOrderKeys } from '../../hooks/useLanchoneteOrders'
import { api } from '../../lib/api-client'
import { LANCHONETE_MENU_CATEGORIES, type LanchoneteMenuCategory } from '../../types'

interface ComboComponent {
  productId: string
  quantity: number
}

const CombosPage = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showError, showSuccess, showWarning } = useToastContext()
  const { isAdmin, userRole } = usePermissions()
  const productsQuery = useProducts('lanchonete')
  const canManageCombos = isAdmin || userRole === 'coordLanchonete'

  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [menuCategory, setMenuCategory] = useState<LanchoneteMenuCategory>('Outros')
  const [componentToAdd, setComponentToAdd] = useState('')
  const [components, setComponents] = useState<ComboComponent[]>([])
  const [isSaving, setIsSaving] = useState(false)

  const availableProducts = useMemo(
    () => (productsQuery.data || []).filter((product: any) => product.active !== false && !product.is_combo),
    [productsQuery.data],
  )
  const selectedProducts = components
    .map((component) => ({
      ...component,
      product: availableProducts.find((product: any) => product.id === component.productId),
    }))
    .filter((component) => component.product)

  const addComponent = () => {
    if (!componentToAdd || components.some((component) => component.productId === componentToAdd)) return
    setComponents((current) => [...current, { productId: componentToAdd, quantity: 1 }])
    setComponentToAdd('')
  }

  const updateQuantity = (productId: string, quantity: number) => {
    setComponents((current) => current.map((component) =>
      component.productId === productId ? { ...component, quantity } : component,
    ))
  }

  const removeComponent = (productId: string) => {
    setComponents((current) => current.filter((component) => component.productId !== productId))
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const parsedPrice = Number(price.replace(',', '.'))

    if (name.trim().length === 0 || !Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      showWarning('Dados inválidos', 'Informe o nome e um valor válido para o combo.')
      return
    }

    if (components.length < 2) {
      showWarning('Composição incompleta', 'Adicione pelo menos dois itens diferentes ao combo.')
      return
    }

    setIsSaving(true)
    try {
      const response = await api.createLanchoneteCombo({
        name: name.trim(),
        price: parsedPrice,
        menuCategory,
        components,
      })
      if (!response.success) {
        throw new Error(response.error || 'Não foi possível criar o combo.')
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: productKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: lanchoneteOrderKeys.menu() }),
      ])
      showSuccess('Combo criado', `${name.trim()} já está disponível no cardápio.`)
      void navigate({ to: '/lanchonete' })
    } catch (error) {
      showError('Erro ao criar combo', error instanceof Error ? error.message : 'Tente novamente.')
    } finally {
      setIsSaving(false)
    }
  }

  if (!canManageCombos) {
    return (
      <div className="painel p-8 text-center">
        <h1 className="text-xl font-display font-semibold text-ferro-900">Acesso restrito</h1>
        <p className="mt-2 text-ferro-700">Somente coordenação da lanchonete e administração podem criar combos.</p>
      </div>
    )
  }

  if (productsQuery.isLoading) {
    return <div className="painel p-8 text-center text-ferro-700">Carregando itens do cardápio...</div>
  }

  return (
    <div className="space-y-6">
      <Header title="Criar combo" subtitle="Combine itens do cardápio e defina o preço do conjunto" showLogo={false} />

      {productsQuery.isError ? (
        <div role="alert" className="painel p-6 text-center text-vagao-700">
          Não foi possível carregar os itens.{' '}
          <button type="button" className="underline" onClick={() => void productsQuery.refetch()}>Tentar novamente</button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="painel p-5 md:p-8 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-ferro-800">
              Nome do combo
              <input
                required
                maxLength={120}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ex.: Lanche completo"
                className="mt-1 w-full"
              />
            </label>
            <label className="block text-sm font-medium text-ferro-800">
              Preço do combo (R$)
              <input
                required
                type="number"
                min="0.01"
                max="99999999.99"
                step="0.01"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                placeholder="0,00"
                className="mt-1 w-full"
              />
            </label>
            <label className="block text-sm font-medium text-ferro-800">
              Categoria do cardápio
              <select
                value={menuCategory}
                onChange={(event) => setMenuCategory(event.target.value as LanchoneteMenuCategory)}
                className="mt-1 w-full"
              >
                {LANCHONETE_MENU_CATEGORIES.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </label>
          </div>

          <div>
            <label htmlFor="combo-component" className="block text-sm font-medium text-ferro-800">
              Itens que compõem o combo
            </label>
            <div className="mt-1 flex gap-2">
              <select
                id="combo-component"
                value={componentToAdd}
                onChange={(event) => setComponentToAdd(event.target.value)}
                className="min-w-0 flex-1"
              >
                <option value="">Selecione um item...</option>
                {availableProducts
                  .filter((product: any) => !components.some((component) => component.productId === product.id))
                  .map((product: any) => (
                    <option key={product.id} value={product.id}>{product.name}</option>
                  ))}
              </select>
              <button
                type="button"
                onClick={addComponent}
                disabled={!componentToAdd}
                className="rounded-lg bg-ferro-800 px-4 font-display font-semibold text-creme-100 disabled:opacity-40"
              >
                Adicionar
              </button>
            </div>
          </div>

          {selectedProducts.length > 0 ? (
            <ul className="divide-y divide-ferro-200 rounded-xl border border-ferro-200">
              {selectedProducts.map(({ productId, quantity, product }: any) => (
                <li key={productId} className="flex flex-wrap items-center gap-3 p-3">
                  <span className="min-w-0 flex-1 font-medium text-ferro-900">{product.name}</span>
                  <label className="flex items-center gap-2 text-sm text-ferro-700">
                    Quantidade
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={quantity}
                      onChange={(event) => updateQuantity(productId, Number(event.target.value))}
                      className="w-20"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => removeComponent(productId)}
                    aria-label={`Remover ${product.name} do combo`}
                    className="rounded-lg px-3 py-2 text-vagao-700 hover:bg-vagao-50"
                  >
                    Remover
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl border border-dashed border-ferro-300 p-5 text-center text-ferro-600">
              Adicione pelo menos dois itens para formar o combo.
            </p>
          )}

          {availableProducts.length === 0 && (
            <p className="text-sm text-ferro-600">Cadastre itens comuns na lanchonete antes de criar um combo.</p>
          )}

          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={() => void navigate({ to: '/lanchonete' })}
              className="rounded-lg border border-ferro-300 px-5 py-3 font-display font-semibold text-ferro-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving || components.length < 2 || availableProducts.length === 0}
              className="rounded-lg bg-vagao-600 px-5 py-3 font-display font-semibold text-creme-50 disabled:opacity-40"
            >
              {isSaving ? 'Criando...' : 'Criar combo'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

export default CombosPage
