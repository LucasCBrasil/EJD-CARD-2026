import React, { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useSupabaseData } from '../../contexts/SupabaseDataContext'
import { useProducts } from '../../hooks/useProducts'
import { SaleItem } from '../../types'
import { Button, TrainLoader } from '../../components/shared'
import { sapatinhoVelozApi } from '../../api/sapatinho-veloz.api' // ⚠️ Usa apenas create() que já chama Edge Function via api-client
import { useToastContext } from '../../contexts/ToastContext'
import OptimizedImage from '../../components/ui/OptimizedImage'
import { api } from '../../lib/api-client'

const TEAMS = [
  'ADM',
  'Lojinha',
  'Vigília',
  'Lanchonete',
  'Banda',
  'Acolhida',
  'Gênios Card',
  'Comunicação',
  'Teatro',
  'Ambientes',
  'Apresentadoras'
]

const SapatinhoVelozPage: React.FC = () => {
  const { user } = useAuth()
  const { getAccountByUserId } = useSupabaseData()
  const { data: products = [], isLoading: isLoadingProducts, refetch: refetchProducts } = useProducts('sapatinho')
  const { showSuccess, showError } = useToastContext()

  const [senderTeam, setSenderTeam] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [recipientAddress, setRecipientAddress] = useState('')
  const [message, setMessage] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [selectedProducts, setSelectedProducts] = useState<Record<string, number>>({})
  const [isProcessing, setIsProcessing] = useState(false)
  const [userBalance, setUserBalance] = useState<number>(0)

  // Forçar recarregamento dos produtos sempre que a página for montada
  useEffect(() => {
    refetchProducts()
  }, [refetchProducts])

  useEffect(() => {
    let active = true
    const fetchUserBalance = async () => {
      if (user?.id) {
        try {
          const account = await getAccountByUserId(user.id)
          if (active) setUserBalance(account?.balance || 0)
        } catch (error) {
          if (active) {
            showError('Erro ao carregar saldo', error instanceof Error ? error.message : 'Não foi possível carregar o saldo da conta.')
          }
        }
      }
    }
    void fetchUserBalance()
    return () => { active = false }
  }, [user?.id, getAccountByUserId, showError])

  const handleProductToggle = (productId: string) => {
    setSelectedProducts(prev => {
      if (prev[productId]) {
        const { [productId]: removed, ...rest } = prev
        return rest
      } else {
        return { ...prev, [productId]: 1 }
      }
    })
  }

  const handleQuantityChange = (productId: string, quantity: number) => {
    const currentQuantity = selectedProducts[productId] || 0
    
    // Se está diminuindo ou removendo, não precisa validar estoque
    if (quantity <= 0) {
      const { [productId]: removed, ...rest } = selectedProducts
      setSelectedProducts(rest)
      return
    }

    // Se está diminuindo a quantidade, permitir sem validar estoque
    if (quantity < currentQuantity) {
      setSelectedProducts(prev => ({ ...prev, [productId]: quantity }))
      return
    }

    // Só validar estoque quando está AUMENTANDO a quantidade
    const product = products.find(p => p.id === productId)
    if (product && product.stock !== null && product.stock !== undefined) {
      if (product.stock === 0) {
        showError('Produto indisponível', `O produto "${product.name}" não está mais disponível em estoque.`)
        return
      }
      if (product.stock < quantity) {
        showError(
          'Estoque insuficiente', 
          `Temos apenas ${product.stock} unidade${product.stock > 1 ? 's' : ''} disponível${product.stock > 1 ? 'eis' : ''} de "${product.name}".`
        )
        return
      }
    }

    setSelectedProducts(prev => ({ ...prev, [productId]: quantity }))
  }

  const getSelectedItems = (): Omit<SaleItem, 'id'>[] => {
    return Object.entries(selectedProducts)
      .map(([productId, quantity]) => {
        const product = products.find(p => p.id === productId)
        if (!product) return null
        return {
          productId: product.id,
          productName: product.name,
          quantity,
          price: product.price
        }
      })
      .filter((item): item is Omit<SaleItem, 'id'> => item !== null)
  }

  const getTotal = (): number => {
    return getSelectedItems().reduce((sum, item) => sum + (item.price * item.quantity), 0)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validações
    if (!senderTeam) {
      showError('Erro', 'Selecione sua equipe')
      return
    }

    if (!recipientName.trim()) {
      showError('Erro', 'Informe o nome do destinatário')
      return
    }

    if (!recipientAddress) {
      showError('Erro', 'Selecione o endereço/equipe do destinatário')
      return
    }

    const items = getSelectedItems()
    if (items.length === 0) {
      showError('Erro', 'Selecione pelo menos um produto')
      return
    }

    // ✅ Validar estoque ANTES de chamar a função
    const stockErrors: string[] = []
    for (const item of items) {
      const product = products.find(p => p.id === item.productId)
      if (!product) {
        stockErrors.push(`Produto "${item.productName}" não encontrado`)
        continue
      }

      if (product.stock !== null && product.stock !== undefined) {
        if (product.stock === 0) {
          stockErrors.push(`O produto "${product.name}" não está mais disponível em estoque`)
        } else if (product.stock < item.quantity) {
          stockErrors.push(`Estoque insuficiente para "${product.name}". Temos apenas ${product.stock} unidade${product.stock > 1 ? 's' : ''} disponível${product.stock > 1 ? 'eis' : ''}, mas você está tentando comprar ${item.quantity}`)
        }
      }
    }

    if (stockErrors.length > 0) {
      const errorMessage = stockErrors.length === 1 
        ? stockErrors[0]
        : `Não é possível finalizar o pedido:\n${stockErrors.map((e, i) => `${i + 1}. ${e}`).join('\n')}`
      showError('Erro no estoque', errorMessage)
      return
    }

    const total = getTotal()
    if (userBalance < total) {
      showError('Erro', `Saldo insuficiente. Você tem R$ ${userBalance.toFixed(2)}, mas precisa de R$ ${total.toFixed(2)}`)
      return
    }

    if (!user?.id) {
      showError('Erro', 'Usuário não autenticado')
      return
    }

    setIsProcessing(true)

    try {
      const orderId = await sapatinhoVelozApi.create({
        senderUserId: user.id,
        senderTeam,
        recipientName: recipientName.trim(),
        recipientAddress,
        message: message.trim() || undefined,
        isAnonymous,
        items
      })

      // Verificar se realmente recebeu o orderId
      if (!orderId) {
        throw new Error('Pedido criado mas não foi possível confirmar. Por favor, verifique se o pedido foi salvo.')
      }

      // Aguardar um pouco para garantir que o banco processou tudo
      await new Promise(resolve => setTimeout(resolve, 500))

      showSuccess('Sucesso!', 'Pedido Sapatinho Veloz criado com sucesso! Sua encomenda chegará ao destinatário até o final do Encontrão.')

      // Limpar formulário
      setSenderTeam('')
      setRecipientName('')
      setRecipientAddress('')
      setMessage('')
      setIsAnonymous(false)
      setSelectedProducts({})

      // Atualizar saldo e produtos
      const updatedAccount = await getAccountByUserId(user.id)
      setUserBalance(updatedAccount?.balance || 0)
      
      // Recarregar produtos para atualizar estoque
      refetchProducts()
    } catch (error: any) {
      console.error('Erro ao criar pedido:', error)
      const errorMessage = error?.message || 'Erro ao criar pedido. Por favor, verifique se o pedido foi salvo e tente novamente se necessário.'
      showError('Erro', errorMessage)
    } finally {
      setIsProcessing(false)
    }
  }

  const fieldClass = "w-full px-4 py-3 text-base border-2 border-ferro-200 rounded-xl bg-creme-50 text-ferro-900 focus:ring-2 focus:ring-latao-400 focus:border-ferro-500"

  return (
    <div className="painel p-4 sm:p-6 md:p-10 text-ferro-900">
      <div className="mb-6 md:mb-8">
        <p className="text-xs font-display uppercase tracking-[0.2em] text-vagao-600 mb-1">Correio do Encontrão</p>
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-display font-semibold uppercase tracking-wide text-ferro-900 mb-3 md:mb-4">💌 Sapatinho Veloz</h2>
        <div className="trilho w-full mb-5" />
        <div className="bg-latao-50 border border-latao-300 border-l-4 border-l-latao-500 p-3 sm:p-4 md:p-5 mb-4 md:mb-5 rounded-xl">
          <p className="text-sm sm:text-base font-display uppercase tracking-wide font-semibold text-ferro-900 mb-2 md:mb-3">⚠️ Regras de embarque</p>
          <ul className="text-sm sm:text-base text-ferro-700 space-y-1 sm:space-y-2 ml-4 sm:ml-5 list-disc leading-relaxed">
            <li>Só é permitida a venda para o destinatário que não seja você mesmo</li>
            <li>Você pode enviar quantos itens quiser</li>
            <li>A encomenda será entregue na Sala de Apoio do destinatário</li>
            <li>Você pode optar por enviar uma mensagem anônima</li>
          </ul>
        </div>
        {userBalance > 0 && (
          <div className="bg-creme-200 border border-ferro-200 rounded-xl p-3 sm:p-4 mb-4 md:mb-5 flex items-center justify-between gap-3">
            <span className="text-sm font-display uppercase tracking-wide text-ferro-700">Saldo disponível</span>
            <span className="text-lg sm:text-xl font-slab text-ferro-900">R$ {userBalance.toFixed(2)}</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 md:space-y-6">
        {/* Equipe do Remetente */}
        <div>
          <label htmlFor="senderTeam" className="block text-base font-semibold text-ferro-900 mb-2">
            Qual a SUA equipe? <span className="text-vagao-600 font-bold">*</span>
          </label>
          <select
            id="senderTeam"
            value={senderTeam}
            onChange={(e) => setSenderTeam(e.target.value)}
            required
            className={fieldClass}
          >
            <option value="">Selecione sua equipe</option>
            {TEAMS.map(team => (
              <option key={team} value={team}>{team}</option>
            ))}
          </select>
          {isAnonymous && (
            <p className="mt-2 text-sm text-anil-700 font-medium italic">
              ⚠️ Sua equipe não será exibida no pedido (envio anônimo)
            </p>
          )}
        </div>

        {/* Nome do Destinatário */}
        <div>
          <label htmlFor="recipientName" className="block text-base font-semibold text-ferro-900 mb-2">
            Qual nome do destinatário? <span className="text-vagao-600 font-bold">*</span>
          </label>
          <input
            type="text"
            id="recipientName"
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            required
            className={fieldClass}
            placeholder="Nome do destinatário"
          />
        </div>

        {/* Endereço/Equipe do Destinatário */}
        <div>
          <label htmlFor="recipientAddress" className="block text-base font-semibold text-ferro-900 mb-2">
            Qual endereço do destinatário? <span className="text-vagao-600 font-bold">*</span>
          </label>
          <select
            id="recipientAddress"
            value={recipientAddress}
            onChange={(e) => setRecipientAddress(e.target.value)}
            required
            className={fieldClass}
          >
            <option value="">Selecione a equipe do destinatário</option>
            {TEAMS.map(team => (
              <option key={team} value={team}>{team}</option>
            ))}
          </select>
        </div>

        {/* Produtos */}
        <div>
          <label className="block text-base font-semibold text-ferro-900 mb-2">
            O que você quer enviar? <span className="text-vagao-600 font-bold">*</span>
          </label>
          {isLoadingProducts ? (
            <p className="text-ferro-500">Carregando produtos...</p>
          ) : products.length === 0 ? (
            <p className="text-ferro-500">Nenhum produto disponível</p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto border border-ferro-200 rounded-xl p-2 sm:p-4 bg-creme-100">
              {products.map(product => {
                const isSelected = !!selectedProducts[product.id]
                return (
                <div key={product.id} className={`flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 bg-creme-50 rounded-xl border-2 transition-colors gap-3 sm:gap-0 ${isSelected ? 'border-ferro-800' : 'border-ferro-200 hover:border-ferro-400'}`}>
                  <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden border border-ferro-200 bg-creme-200 flex-shrink-0">
                      <OptimizedImage
                        src={product.image_url || (product as any).image || null}
                        alt={product.name}
                        className="w-full h-full"
                        context="sapatinho"
                      />
                    </div>
                    <input
                      type="checkbox"
                      id={`product-${product.id}`}
                      checked={isSelected}
                      onChange={() => handleProductToggle(product.id)}
                      className="w-5 h-5 sm:w-6 sm:h-6 !p-0 accent-ferro-800 border-2 border-ferro-300 rounded cursor-pointer flex-shrink-0 mt-1"
                    />
                    <label htmlFor={`product-${product.id}`} className="flex-1 cursor-pointer min-w-0 !mb-0">
                      <div className="text-base sm:text-lg font-bold text-ferro-900 break-words leading-tight">{product.name}</div>
                      {product.description && (
                        <div className="text-sm text-ferro-600 font-normal mt-1 break-words">{product.description}</div>
                      )}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
                        <div className="text-lg sm:text-xl font-slab text-vagao-600">R$ {product.price.toFixed(2)}</div>
                        {product.stock !== null && product.stock !== undefined && (
                          <div className={`text-sm font-semibold ${
                            product.stock === 0 
                              ? 'text-vagao-600' 
                              : product.stock <= 5 
                                ? 'text-latao-700' 
                                : 'text-ferro-500'
                          }`}>
                            📦 {product.stock === 0 ? 'Indisponível' : `${product.stock} em estoque`}
                          </div>
                        )}
                      </div>
                    </label>
                  </div>
                  {isSelected && (
                    <div className="flex items-center justify-end gap-2 flex-shrink-0">
                      <button
                        type="button"
                        aria-label="Diminuir quantidade"
                        onClick={() => handleQuantityChange(product.id, (selectedProducts[product.id] || 1) - 1)}
                        className="!p-0 w-10 h-10 rounded-lg bg-creme-200 hover:bg-creme-300 text-ferro-800 border-2 border-ferro-200 text-xl font-bold flex items-center justify-center"
                      >
                        −
                      </button>
                      <span className="w-10 text-center font-slab text-lg text-ferro-900">{selectedProducts[product.id]}</span>
                      <button
                        type="button"
                        aria-label="Aumentar quantidade"
                        onClick={() => handleQuantityChange(product.id, (selectedProducts[product.id] || 1) + 1)}
                        className="!p-0 w-10 h-10 rounded-lg bg-ferro-800 hover:bg-ferro-700 text-creme-200 text-xl font-bold flex items-center justify-center"
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Mensagem */}
        <div>
          <label htmlFor="message" className="block text-base font-semibold text-ferro-900 mb-2">
            ✉️ Se desejar, escreva uma mensagem especial.
          </label>
          <textarea
            id="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            className={`${fieldClass} bg-creme-50 leading-relaxed`}
            placeholder="Escreva uma mensagem especial para o destinatário..."
          />
        </div>

        {/* Envio Anônimo */}
        <div className="bg-creme-100 border border-ferro-200 rounded-xl p-3 sm:p-4">
          <label className="flex items-center gap-3 cursor-pointer !mb-0">
            <input
              type="checkbox"
              id="isAnonymous"
              checked={isAnonymous}
              onChange={(e) => setIsAnonymous(e.target.checked)}
              className="w-6 h-6 !p-0 accent-ferro-800 cursor-pointer"
            />
            <span className="text-base font-semibold text-ferro-900">
              Envio anônimo?
            </span>
          </label>
          {isAnonymous && (
            <p className="mt-2 text-sm text-ferro-600 ml-9">
              Seu nome e equipe não serão exibidos no pedido
            </p>
          )}
        </div>

        {/* Total */}
        {Object.keys(selectedProducts).length > 0 && (
          <div className="bilhete p-4 sm:p-5">
            <div className="flex justify-between items-center mb-2">
              <span className="text-lg font-display uppercase tracking-wide text-ferro-800">Total</span>
              <span className="text-2xl sm:text-3xl font-slab text-vagao-600">
                R$ {getTotal().toFixed(2)}
              </span>
            </div>
            {userBalance > 0 && (
              <div className="picote-horizontal pt-2 text-sm sm:text-base text-ferro-700 font-medium flex justify-between">
                <span>Saldo após compra</span>
                <span className="font-slab text-ferro-900">R$ {(userBalance - getTotal()).toFixed(2)}</span>
              </div>
            )}
          </div>
        )}

        {/* Botão de Enviar */}
        <div className="mt-6 sm:mt-8">
          <Button
            type="submit"
            disabled={isProcessing || userBalance < getTotal() || Object.keys(selectedProducts).length === 0}
            className="w-full sm:w-auto !bg-vagao-600 hover:!bg-vagao-700 !text-creme-50 !border-vagao-600 px-6 sm:px-10 py-3 sm:py-4 text-base sm:text-lg uppercase disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            {isProcessing ? '⏳ Processando...' : '💌 Despachar Pedido'}
          </Button>
        </div>
      </form>

      {/* Modal de Loading - Bloqueia a tela durante o processamento */}
      {isProcessing && (
        <TrainLoader
          title="Despachando pedido..."
          message="Aguarde enquanto finalizamos seu pedido do Sapatinho Veloz. Isso pode levar alguns minutos. Não feche esta página!"
        />
      )}
    </div>
  )
}

export default SapatinhoVelozPage
