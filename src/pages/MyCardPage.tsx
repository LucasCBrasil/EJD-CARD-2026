import React, { useState, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Button } from '../components/shared'
import { useAuth } from '../contexts/AuthContext'
import { useData } from '../contexts/DataContext'
import { useSupabaseData } from '../contexts/SupabaseDataContext'
import { pixService, PixPayment } from '../services/pixService'
import { isSupabaseConfigured } from '../lib/supabase'

interface Card {
  id: string
  name: string
  cardNumber: string
  balance: number
  phoneNumber: string
}

interface Purchase {
  id: string
  date: string
  store: string
  product: string
  amount: number
  type: 'lojinha' | 'lanchonete' | 'sapatinho'
}

const MyCardPage: React.FC = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  
  // Usar apenas o contexto apropriado
  let localData: any = null
  let supabaseData: any = null
  
  try {
    if (isSupabaseConfigured()) {
      supabaseData = useSupabaseData()
    } else {
      localData = useData()
    }
  } catch (error) {
    // Fallback para dados locais se Supabase falhar
    localData = useData()
  }
  
  const [card, setCard] = useState<Card | null>(null)
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [amount, setAmount] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showPixInfo, setShowPixInfo] = useState(false)
  const [pixPayment, setPixPayment] = useState<PixPayment | null>(null)
  const [isCheckingPayment, setIsCheckingPayment] = useState(false)
  const [isLoadingData, setIsLoadingData] = useState(false)

  // Carregar dados do usuário
  useEffect(() => {
    if (!user?.id) return

    loadUserData()
    
    // ✅ Recarregar quando a página ficar visível novamente
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadUserData()
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]) // Recarregar sempre que o user mudar

  const loadUserData = async () => {
    if (isLoadingData) return // Evita chamadas duplicadas
    
    try {
      setIsLoadingData(true)
      
      if (supabaseData && isSupabaseConfigured()) {
        // ✅ Agora usa Edge Function via api-client (seguro!)
        try {
          const { api } = await import('../lib/api-client')
          
          if (!user?.id) {
            console.warn('MyCardPage: user.id não disponível')
            setCard(null)
            setPurchases([]) // Não mostrar histórico se não há usuário autenticado
            return
          }
          
          // Buscar cartão associado ao usuário atual
          // Se o cartão não estiver associado a este usuário, não será retornado
          const response = await api.getCardByUserId(user.id)
          
          if (!response.success || !response.data) {
            // Se não encontrou cartão associado a este usuário, não mostrar nada
            // O histórico do cartão continua existindo no banco, mas não é exibido aqui
            setCard(null)
            setPurchases([])
            return
          }

          // Mapear do formato da Edge Function para Card
          const cardData = response.data
          const userCard = {
            id: cardData.id,
            userId: cardData.user_id || '',
            userName: cardData.user_name || '',
            cardNumber: cardData.card_number || '',
            phoneNumber: cardData.phone_number || '',
            balance: parseFloat(cardData.balance) || 0,
            createdAt: cardData.created_at || '',
            updatedAt: cardData.updated_at || ''
          }

          // Verificar se realmente temos dados válidos do cartão associado ao usuário
          if (!userCard.id || !userCard.cardNumber || userCard.userId !== user.id) {
            // Cartão não está associado a este usuário - não mostrar
            setCard(null)
            setPurchases([])
            return
          }

          // ✅ Cartão está associado ao usuário atual - mostrar informações
          setCard({
            id: userCard.id,
            name: userCard.userName || 'Sem nome',
            cardNumber: userCard.cardNumber || '',
            balance: userCard.balance || 0,
            phoneNumber: userCard.phoneNumber || ''
          })

          // ✅ SÓ carregar histórico se o cartão está associado ao usuário atual
          // O histórico pertence ao cartão, mas só é exibido se o cartão estiver associado a este usuário
          const salesResponse = await api.listSales(undefined, userCard.id)
          const sales = salesResponse.success ? (salesResponse.data || []).slice(0, 20) : []
          
          // Converter vendas em compras do usuário
          // Formato da Edge Function: sale_items ou sapatinho_sale_items
          const userPurchases: Purchase[] = sales
            .map((sale: any) => {
              const items = sale.sale_items || sale.sapatinho_sale_items || []
              const createdAt = sale.created_at || sale.createdAt || new Date().toISOString()
              return {
                id: sale.id,
                date: createdAt.split('T')[0],
                store: sale.category === 'lojinha'
                  ? 'Lojinha Mágica'
                  : sale.category === 'lanchonete'
                    ? 'Lanchonete do Feiticeiro'
                    : 'Sapatinho velOz',
                product: items.map((item: any) => item.product_name || item.productName || 'Produto').join(', '),
                amount: parseFloat(sale.total) || 0,
                type: sale.category || 'lojinha'
              }
            })
          
          setPurchases(userPurchases)
        } catch (error: any) {
          console.error('MyCardPage: Erro ao carregar dados do cartão:', error)
          // Não quebrar a página se houver erro - apenas não mostrar cartão
          // IMPORTANTE: Limpar histórico também em caso de erro
          setCard(null)
          setPurchases([])
        }
      } else {
        // Usar dados locais (modo fallback)
        const userCard: Card = {
          id: '1',
          name: user?.name || 'Meu Cartão',
          cardNumber: '1234567890123456',
          balance: localData.getBalance(user?.id || ''),
          phoneNumber: '11999999999'
        }
        
        setCard(userCard)

        // Simular histórico de compras
        const mockPurchases: Purchase[] = [
          {
            id: '1',
            date: '2025-01-15',
            store: 'Lojinha Mágica',
            product: 'Varinha Mágica',
            amount: 25.50,
            type: 'lojinha'
          },
          {
            id: '2',
            date: '2025-01-14',
            store: 'Lanchonete do Feiticeiro',
            product: 'Hambúrguer Especial',
            amount: 18.00,
            type: 'lanchonete'
          }
        ]
        setPurchases(mockPurchases)
      }
    } catch (error) {
      console.error('Erro ao carregar dados do usuário:', error)
    } finally {
      setIsLoadingData(false)
    }
  }

  const handlePixPayment = async () => {
    if (!card || !amount) return

    setIsLoading(true)
    
    try {
      // Gerar PIX usando o serviço
      const payment = await pixService.generatePayment(parseFloat(amount), card.id)
      setPixPayment(payment)
      setShowPixInfo(true)

      // TODO: Salvar pagamento PIX via Edge Function quando implementado
      // Por enquanto, o pagamento é apenas simulado

    } catch (error) {
      console.error('Erro ao gerar PIX:', error)
      alert('Erro ao gerar PIX. Tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleConfirmPayment = async () => {
    if (!pixPayment || !card) return

    try {
      setIsCheckingPayment(true)

      // Simular confirmação de pagamento
      await new Promise(resolve => setTimeout(resolve, 2000))

      if (supabaseData && isSupabaseConfigured()) {
        // ✅ Usar Edge Function para atualizar saldo via PIX (seguro!)
        try {
          const { api } = await import('../lib/api-client')
          const response = await api.updateBalance({
            action: 'add',
            cardId: card.id,
            amount: parseFloat(amount),
            description: 'Abastecimento via PIX',
          })

          if (!response.success) {
            throw new Error((response as any).error || 'Erro ao atualizar saldo')
          }

          // Atualizar estado do cartão imediatamente com o novo saldo
          const newBalance = card.balance + parseFloat(amount)
          setCard(prev => prev ? {
            ...prev,
            balance: newBalance
          } : null)

          // Recarregar dados do contexto em background para manter sincronizado
          await loadUserData()
        } catch (error: any) {
          console.error('Erro ao confirmar pagamento PIX:', error)
          throw error
        }
      } else {
        // Usar dados locais
        localData.addBalance(user?.id || '', parseFloat(amount), 'Abastecimento via PIX')
        
        // Atualizar saldo local
        setCard(prev => prev ? {
          ...prev,
          balance: prev.balance + parseFloat(amount)
        } : null)
      }
      
      setShowPixInfo(false)
      setAmount('')
      setPixPayment(null)
      
      alert('Pagamento confirmado! Saldo atualizado.')
    } catch (error) {
      console.error('Erro ao confirmar pagamento:', error)
      alert('Erro ao confirmar pagamento. Tente novamente.')
    } finally {
      setIsCheckingPayment(false)
    }
  }

  const formatCardNumber = (number: string) => {
    if (!number) return ''
    return number.replace(/(\d{4})(?=\d)/g, '$1 ')
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('pt-BR')
  }

  const copyPixCode = () => {
    if (pixPayment) {
      navigator.clipboard.writeText(pixPayment.pixCode)
      alert('Código PIX copiado!')
    }
  }

  // Mostrar loading se não há dados carregados
  if (!card && !localData && !supabaseData) {
    return (
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400 mx-auto mb-4"></div>
        <p className="text-gray-600">Carregando seu cartão...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Aviso sobre Supabase não configurado */}
      {!isSupabaseConfigured() && (
        <div className="bg-blue-100 border border-blue-300 rounded-xl p-4 text-center">
          <p className="text-blue-800 text-sm">
            💡 <strong>Modo Local:</strong> Para usar o banco de dados Supabase, configure as variáveis de ambiente.
            <br />
            <a href="/SUPABASE_SETUP.md" className="underline hover:no-underline">
              Ver guia de configuração
            </a>
          </p>
        </div>
      )}

      {/* Informações do Cartão */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl border border-yellow-200 p-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-black mb-6 font-cardinal">
            💳 Meu Cartão
          </h2>
          
          {isLoadingData ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400 mx-auto mb-4"></div>
              <p className="text-gray-600">Carregando informações do cartão...</p>
            </div>
          ) : !card ? (
            <div className="text-center py-8">
              <div className="text-6xl mb-4">💳</div>
              <h3 className="text-xl font-bold text-black mb-4 font-cardinal">
                Nenhum cartão associado
              </h3>
              <p className="text-gray-600 mb-6">
                Você ainda não possui um cartão associado à sua conta.
              </p>
              <Button
                onClick={() => navigate({ to: '/cards/associate' })}
                size="lg"
                className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg hover:shadow-emerald-200 font-semibold"
              >
                🔗 Associar Cartão
              </Button>
            </div>
          ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Nome do Portador */}
            <div className="bg-gradient-to-r from-emerald-100 to-emerald-200 rounded-xl p-6">
              <p className="text-black text-sm mb-2">👤 Nome do Portador</p>
              <p className="text-xl font-bold text-black">
                {card?.name || 'Carregando...'}
              </p>
            </div>

            {/* Número do Cartão */}
            <div className="bg-gradient-to-r from-blue-100 to-blue-200 rounded-xl p-6">
              <p className="text-black text-sm mb-2">💳 Número do Cartão</p>
              <p className="text-lg font-mono font-bold text-black">
                {formatCardNumber(card?.cardNumber || '')}
              </p>
            </div>

            {/* Saldo Disponível */}
            <div className="bg-gradient-to-r from-yellow-100 to-yellow-200 rounded-xl p-6">
              <p className="text-black text-sm mb-2">💰 Saldo Disponível</p>
              <p className="text-3xl font-bold text-black">
                R$ {(card?.balance || 0).toFixed(2).replace('.', ',')}
              </p>
            </div>
          </div>
          )}
        </div>
      </div>

      {/* Abastecimento via PIX - apenas se tiver cartão */}
      {card && (
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl border border-yellow-200 p-8">
          <h3 className="text-xl font-semibold text-black mb-6 text-center font-cardinal">
            💰 Abastecer via PIX
          </h3>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="amount" className="block text-sm font-semibold text-black mb-2">
                💰 Valor a Abastecer (R$)
              </label>
              <input
                type="number"
                id="amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="0.01"
                step="0.01"
                className="w-full px-4 py-3 border-2 border-emerald-200 rounded-lg focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-colors duration-200 bg-white/90 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                placeholder="0,00"
              />
            </div>

            <Button
              onClick={handlePixPayment}
              size="lg"
              className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg hover:shadow-emerald-200 font-semibold"
              disabled={isLoading || !amount || parseFloat(amount) <= 0}
            >
              {isLoading ? (
                <>
                  <span className="animate-spin mr-2">✨</span>
                  Gerando PIX...
                </>
              ) : (
                <>
                  💳 Gerar PIX para Abastecimento
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Histórico de Compras - apenas se tiver cartão */}
      {card && (
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl border border-yellow-200 p-8">
          <h3 className="text-xl font-semibold text-black mb-6 text-center font-cardinal">
            📋 Histórico de Compras
          </h3>
          
          {purchases.length > 0 ? (
            <div className="space-y-4">
              {purchases.map((purchase) => (
                <div 
                  key={purchase.id}
                  className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="text-2xl">
                          {purchase.type === 'lojinha' ? '🏪' : purchase.type === 'lanchonete' ? '🍔' : '👠'}
                        </span>
                        <h4 className="font-semibold text-black">{purchase.product}</h4>
                      </div>
                      <p className="text-sm text-gray-600">
                        {purchase.store} • {formatDate(purchase.date)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-black">
                        R$ {purchase.amount.toFixed(2).replace('.', ',')}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-4xl mb-4">🛒</div>
              <p className="text-gray-600">Nenhuma compra realizada ainda</p>
            </div>
          )}
        </div>
      )}

      {/* Modal de PIX */}
      {showPixInfo && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" style={{ backdropFilter: 'none' }}>
          <div 
            className="pix-modal-content text-center"
            style={{ 
              backgroundColor: '#ffffff',
              borderRadius: '1rem',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '2px solid #10b981',
              padding: '1.5rem',
              minHeight: '400px',
              maxWidth: '480px',
              width: '90%'
            }}
          >
              <h3 className="text-2xl font-bold text-black mb-6 font-cardinal">
                📱 PIX Gerado
              </h3>
              
              {/* Código PIX */}
              <div 
                style={{ 
                  border: '2px solid #10b981',
                  borderRadius: '0.75rem',
                  padding: '1.25rem',
                  marginBottom: '1.25rem',
                  backgroundColor: '#ffffff'
                }}
              >
                <p className="text-black text-sm font-semibold mb-3">Código PIX</p>
                <div 
                  style={{ 
                    border: '2px solid #34d399',
                    borderRadius: '0.5rem',
                    padding: '1rem',
                    marginBottom: '1rem',
                    backgroundColor: '#ffffff'
                  }}
                >
                  <p className="text-base font-mono font-bold text-black break-all leading-relaxed">
                    {pixPayment?.pixCode}
                  </p>
                </div>
                <Button
                  onClick={copyPixCode}
                  size="sm"
                  className="w-full !bg-emerald-500 hover:!bg-emerald-600 !text-white !shadow-md !font-bold !opacity-100"
                >
                  📋 Copiar Código
                </Button>
              </div>

              {/* Valor */}
              <div 
                style={{ 
                  border: '2px solid #fbbf24',
                  borderRadius: '0.75rem',
                  padding: '1.25rem',
                  marginBottom: '1.25rem',
                  backgroundColor: '#ffffff'
                }}
              >
                <p className="text-black text-sm font-semibold mb-2">Valor a Pagar</p>
                <p className="text-3xl font-bold text-black">
                  R$ {parseFloat(amount).toFixed(2).replace('.', ',')}
                </p>
              </div>

              {/* Botões */}
              <div 
                style={{ 
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  marginBottom: '1.25rem',
                  backgroundColor: '#ffffff'
                }}
              >
                <Button
                  onClick={handleConfirmPayment}
                  size="lg"
                  className="w-full !bg-gradient-to-r !from-green-500 !to-green-600 hover:!from-green-600 hover:!to-green-700 !text-white !shadow-lg !font-bold !opacity-100"
                  disabled={isCheckingPayment}
                >
                  {isCheckingPayment ? (
                    <>
                      <span className="animate-spin mr-2">✨</span>
                      Confirmando...
                    </>
                  ) : (
                    '✅ Confirmar Pagamento'
                  )}
                </Button>
                
                <Button
                  onClick={() => setShowPixInfo(false)}
                  variant="outline"
                  size="lg"
                  className="w-full !border-2 !border-red-400 !text-red-600 hover:!bg-red-500 hover:!text-white !font-bold !opacity-100"
                >
                  ❌ Cancelar
                </Button>
              </div>

              {/* Instruções */}
              <div 
                style={{ 
                  marginTop: '1.25rem',
                  padding: '1rem',
                  border: '2px solid #93c5fd',
                  borderRadius: '0.5rem',
                  backgroundColor: '#ffffff'
                }}
              >
                <p className="text-sm text-black font-medium">
                  <strong className="text-blue-700">💡 Instruções:</strong><br/>
                  <span className="text-gray-800">
                    1. Copie o código PIX acima<br/>
                    2. Abra seu app bancário<br/>
                    3. Cole o código e faça o pagamento<br/>
                    4. Clique em "Confirmar Pagamento" após pagar
                  </span>
                </p>
              </div>
            </div>
        </div>
      )}
    </div>
  )
}

export default MyCardPage
