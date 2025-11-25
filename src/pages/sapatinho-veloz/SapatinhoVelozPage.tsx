import React, { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useSupabaseData } from '../../contexts/SupabaseDataContext'
import { useProducts } from '../../hooks/useProducts'
import { SaleItem } from '../../types'
import { Button, LoadingSpinner } from '../../components/shared'
import { sapatinhoVelozApi } from '../../api/sapatinho-veloz.api'
import { useToastContext } from '../../contexts/ToastContext'
import OptimizedImage from '../../components/ui/OptimizedImage'

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
  const { getBalance } = useSupabaseData()
  const { data: products = [], isLoading: isLoadingProducts } = useProducts('sapatinho')
  const { showSuccess, showError } = useToastContext()

  const [senderTeam, setSenderTeam] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [recipientAddress, setRecipientAddress] = useState('')
  const [message, setMessage] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [selectedProducts, setSelectedProducts] = useState<Record<string, number>>({})
  const [isProcessing, setIsProcessing] = useState(false)
  const [userBalance, setUserBalance] = useState<number>(0)

  useEffect(() => {
    if (user?.id) {
      const balance = getBalance(user.id)
      setUserBalance(balance)
    }
  }, [user?.id, getBalance])

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
      await sapatinhoVelozApi.create({
        senderUserId: user.id,
        senderTeam,
        recipientName: recipientName.trim(),
        recipientAddress,
        message: message.trim() || undefined,
        isAnonymous,
        items
      })

      showSuccess('Sucesso!', 'Pedido Sapatinho velOz criado com sucesso! Sua encomenda chegará ao destinatário até o final do Encontrão.')

      // Limpar formulário
      setSenderTeam('')
      setRecipientName('')
      setRecipientAddress('')
      setMessage('')
      setIsAnonymous(false)
      setSelectedProducts({})

      // Atualizar saldo
      const newBalance = getBalance(user.id)
      setUserBalance(newBalance)
    } catch (error: any) {
      showError('Erro', error?.message || 'Erro ao criar pedido')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border-2 border-yellow-300 p-4 sm:p-6 md:p-10">
      <div className="mb-6 md:mb-8">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-black mb-3 md:mb-4">👠 Sapatinho velOz</h2>
        <div className="bg-yellow-50 border-l-4 border-yellow-500 p-3 sm:p-4 md:p-5 mb-4 md:mb-5 rounded-r-lg">
          <p className="text-sm sm:text-base font-bold text-gray-900 mb-2 md:mb-3">⚠️ Regras importantes:</p>
          <ul className="text-sm sm:text-base text-gray-800 space-y-1 sm:space-y-2 ml-4 sm:ml-5 list-disc leading-relaxed">
            <li>Só é permitida a venda para o destinatário que não seja você mesmo</li>
            <li>Você pode enviar quantos itens quiser</li>
            <li>A encomenda será entregue na Sala de Apoio do destinatário</li>
            <li>Você pode optar por enviar uma mensagem anônima</li>
          </ul>
        </div>
        {userBalance > 0 && (
          <div className="bg-emerald-100 border-2 border-emerald-400 rounded-lg p-3 sm:p-4 mb-4 md:mb-5">
            <p className="text-base sm:text-lg font-bold text-emerald-900">
              💳 Saldo disponível: R$ {userBalance.toFixed(2)}
            </p>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5 md:space-y-6">
        {/* Equipe do Remetente */}
        <div>
          <label htmlFor="senderTeam" className="block text-base font-semibold text-gray-900 mb-3">
            Qual a SUA equipe? <span className="text-red-600 font-bold">*</span>
          </label>
          <select
            id="senderTeam"
            value={senderTeam}
            onChange={(e) => setSenderTeam(e.target.value)}
            required
            className="w-full px-3 sm:px-4 md:px-5 py-2 sm:py-2.5 md:py-3 text-sm sm:text-base border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white text-gray-900"
          >
            <option value="">Selecione sua equipe</option>
            {TEAMS.map(team => (
              <option key={team} value={team}>{team}</option>
            ))}
          </select>
          {isAnonymous && (
            <p className="mt-2 text-sm text-purple-700 font-medium italic">
              ⚠️ Sua equipe não será exibida no pedido (envio anônimo)
            </p>
          )}
        </div>

        {/* Nome do Destinatário */}
        <div>
          <label htmlFor="recipientName" className="block text-base font-semibold text-gray-900 mb-3">
            Qual nome do destinatário? <span className="text-red-600 font-bold">*</span>
          </label>
          <input
            type="text"
            id="recipientName"
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            required
            className="w-full px-3 sm:px-4 md:px-5 py-2 sm:py-2.5 md:py-3 text-sm sm:text-base border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white text-gray-900"
            placeholder="Nome do destinatário"
          />
        </div>

        {/* Endereço/Equipe do Destinatário */}
        <div>
          <label htmlFor="recipientAddress" className="block text-base font-semibold text-gray-900 mb-3">
            Qual endereço do destinatário? <span className="text-red-600 font-bold">*</span>
          </label>
          <select
            id="recipientAddress"
            value={recipientAddress}
            onChange={(e) => setRecipientAddress(e.target.value)}
            required
            className="w-full px-3 sm:px-4 md:px-5 py-2 sm:py-2.5 md:py-3 text-sm sm:text-base border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white text-gray-900"
          >
            <option value="">Selecione a equipe do destinatário</option>
            {TEAMS.map(team => (
              <option key={team} value={team}>{team}</option>
            ))}
          </select>
        </div>

        {/* Produtos */}
        <div>
          <label className="block text-base font-semibold text-gray-900 mb-3">
            O que você quer enviar? <span className="text-red-600 font-bold">*</span>
          </label>
          {isLoadingProducts ? (
            <p className="text-gray-500">Carregando produtos...</p>
          ) : products.length === 0 ? (
            <p className="text-gray-500">Nenhum produto disponível</p>
          ) : (
            <div className="space-y-3 sm:space-y-4 max-h-96 overflow-y-auto border-2 border-gray-300 rounded-lg p-3 sm:p-4 md:p-5 bg-white">
              {products.map(product => (
                <div key={product.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 bg-gray-50 rounded-lg border-2 border-gray-200 hover:border-emerald-300 transition-colors gap-3 sm:gap-0">
                  <div className="flex items-start space-x-3 sm:space-x-4 flex-1 min-w-0">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden border border-emerald-200 bg-white flex-shrink-0">
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
                      checked={!!selectedProducts[product.id]}
                      onChange={() => handleProductToggle(product.id)}
                      className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-600 border-2 border-gray-400 rounded focus:ring-emerald-500 cursor-pointer flex-shrink-0 mt-1"
                    />
                    <label htmlFor={`product-${product.id}`} className="flex-1 cursor-pointer min-w-0">
                      <div className="text-base sm:text-lg font-bold text-gray-900 break-words">{product.name}</div>
                      {product.description && (
                        <div className="text-sm sm:text-base text-gray-700 mt-1 break-words">{product.description}</div>
                      )}
                      <div className="flex items-center gap-3 mt-2">
                        <div className="text-xl sm:text-2xl font-bold text-emerald-700">R$ {product.price.toFixed(2)}</div>
                        {product.stock !== null && product.stock !== undefined && (
                          <div className={`text-sm font-semibold ${
                            product.stock === 0 
                              ? 'text-red-600' 
                              : product.stock <= 5 
                                ? 'text-yellow-600' 
                                : 'text-emerald-600'
                          }`}>
                            📦 {product.stock === 0 ? 'Indisponível' : `${product.stock} em estoque`}
                          </div>
                        )}
                      </div>
                    </label>
                  </div>
                  {selectedProducts[product.id] && (
                    <div className="flex items-center justify-end sm:justify-start space-x-1.5 sm:space-x-3 flex-shrink-0">
                      <Button
                        type="button"
                        onClick={() => handleQuantityChange(product.id, (selectedProducts[product.id] || 1) - 1)}
                        className="bg-red-500 hover:bg-red-600 text-white px-1.5 sm:px-4 py-1 sm:py-2 text-xs sm:text-lg font-bold rounded-md sm:rounded-lg min-w-[32px] sm:min-w-0 h-8 sm:h-auto flex items-center justify-center"
                      >
                        ➖
                      </Button>
                      <span className="w-7 sm:w-12 text-center font-bold text-sm sm:text-xl text-gray-900 flex items-center justify-center">{selectedProducts[product.id]}</span>
                      <Button
                        type="button"
                        onClick={() => handleQuantityChange(product.id, (selectedProducts[product.id] || 1) + 1)}
                        className="bg-green-500 hover:bg-green-600 text-white px-1.5 sm:px-4 py-1 sm:py-2 text-xs sm:text-lg font-bold rounded-md sm:rounded-lg min-w-[32px] sm:min-w-0 h-8 sm:h-auto flex items-center justify-center"
                      >
                        ➕
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Mensagem */}
        <div>
          <label htmlFor="message" className="block text-base font-semibold text-gray-900 mb-3">
            Se desejar, escreva uma mensagem especial.
          </label>
          <textarea
            id="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            className="w-full px-3 sm:px-4 md:px-5 py-2 sm:py-2.5 md:py-3 text-sm sm:text-base border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white text-gray-900"
            placeholder="Escreva uma mensagem especial para o destinatário..."
          />
        </div>

        {/* Envio Anônimo */}
        <div>
          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              id="isAnonymous"
              checked={isAnonymous}
              onChange={(e) => setIsAnonymous(e.target.checked)}
              className="w-6 h-6 text-emerald-600 border-2 border-gray-400 rounded focus:ring-emerald-500 cursor-pointer"
            />
            <span className="text-base font-semibold text-gray-900">
              Envio anônimo?
            </span>
          </label>
          {isAnonymous && (
            <p className="mt-2 text-sm text-gray-600 ml-9">
              Seu nome e equipe não serão exibidos no pedido
            </p>
          )}
        </div>

        {/* Total */}
        {Object.keys(selectedProducts).length > 0 && (
          <div className="bg-emerald-100 border-2 border-emerald-400 rounded-lg p-4 sm:p-5">
            <div className="flex justify-between items-center mb-2 sm:mb-3">
              <span className="text-lg sm:text-xl font-bold text-gray-900">Total:</span>
              <span className="text-2xl sm:text-3xl font-bold text-emerald-700">
                R$ {getTotal().toFixed(2)}
              </span>
            </div>
            {userBalance > 0 && (
              <div className="text-sm sm:text-base text-gray-800 font-medium">
                Saldo após compra: R$ {(userBalance - getTotal()).toFixed(2)}
              </div>
            )}
          </div>
        )}

        {/* Botão de Enviar */}
        <div className="flex space-x-4 mt-6 sm:mt-8">
          <Button
            type="submit"
            disabled={isProcessing || userBalance < getTotal() || Object.keys(selectedProducts).length === 0}
            className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-600 text-white px-6 sm:px-10 py-3 sm:py-4 text-base sm:text-lg font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            {isProcessing ? '⏳ Processando...' : '✅ Finalizar Pedido'}
          </Button>
        </div>
      </form>

      {/* Modal de Loading - Bloqueia a tela durante o processamento */}
      {isProcessing && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/80 backdrop-blur-md">
          <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-3xl shadow-2xl p-10 max-w-md w-full mx-4 border-4 border-yellow-300/50">
            <div className="text-center">
              <div className="mb-6 flex justify-center">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-yellow-200/50 animate-ping"></div>
                  <div className="relative">
                    <LoadingSpinner size="lg" />
                  </div>
                </div>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3 font-cardinal">
                👠 Processando pedido...
              </h3>
              <p className="text-gray-700 text-base font-farmhand">
                Por favor, aguarde enquanto finalizamos seu pedido do Sapatinho velOz
              </p>
              <div className="mt-4 flex justify-center space-x-1">
                <div className="w-2 h-2 bg-yellow-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-yellow-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-yellow-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SapatinhoVelozPage

