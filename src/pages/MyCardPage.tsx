import React, { useState, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Button } from '../components/shared'
import { useAuth } from '../contexts/AuthContext'
import { useData } from '../contexts/DataContext'
import { useSupabaseData } from '../contexts/SupabaseDataContext'
import { isSupabaseConfigured } from '../lib/auth-client'

// ============================================
// Tipos
// ============================================
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

// ============================================
// Componente Principal
// ============================================
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
    localData = useData()
  }
  
  const [card, setCard] = useState<Card | null>(null)
  const [purchases, setPurchases] = useState<Purchase[]>([])
  const [isLoadingData, setIsLoadingData] = useState(false)
  const [pixEnabled, setPixEnabled] = useState<boolean | null>(null) // null = carregando

  // Carregar feature flag do PIX
  useEffect(() => {
    loadPixFlag()
  }, [])

  const loadPixFlag = async () => {
    try {
      const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL
      const anonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY
      if (!supabaseUrl) {
        setPixEnabled(true) // Default se não configurado
        return
      }
      
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (anonKey) headers['apikey'] = anonKey

      const res = await fetch(`${supabaseUrl}/functions/v1/feature-flags?key=pix_enabled`, { headers })
      const json = await res.json()
      
      setPixEnabled(json.success && json.data ? json.data.enabled : true)
    } catch {
      setPixEnabled(true) // Default em caso de erro
    }
  }

  // Carregar dados do usuário
  useEffect(() => {
    if (!user?.id) return
    loadUserData()
    
    // Recarregar quando a página ficar visível
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadUserData()
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [user?.id])

  const loadUserData = async () => {
    if (isLoadingData) return
    
    try {
      setIsLoadingData(true)
      
      if (supabaseData && isSupabaseConfigured()) {
        try {
          const { api } = await import('../lib/api-client')
          
          if (!user?.id) {
            setCard(null)
            setPurchases([])
            return
          }
          
          // Usar a nova função que retorna tudo de uma vez de forma segura
          const response = await api.getMyCardHistory()
          
          if (!response.success) {
            console.error('Erro ao carregar histórico:', response)
            setCard(null)
            setPurchases([])
            return
          }

          const { card: cardData, sales, sapatinhoSales } = response.data

          // Se não tem cartão associado
          if (!cardData) {
            setCard(null)
            setPurchases([])
            return
          }

          setCard({
            id: cardData.id,
            name: cardData.user_name || 'Sem nome',
            cardNumber: cardData.card_number || '',
            balance: parseFloat(cardData.balance) || 0,
            phoneNumber: cardData.phone_number || ''
          })

          // Combinar vendas normais + sapatinho
          const allSales = [
            ...(sales || []).map((sale: any) => ({ ...sale, category: sale.category })),
            ...(sapatinhoSales || []).map((sale: any) => ({ ...sale, category: 'sapatinho' }))
          ]
          
          // Ordenar por data decrescente
          allSales.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          
          const userPurchases: Purchase[] = allSales.slice(0, 20).map((sale: any) => {
            const items = sale.sale_items || sale.sapatinho_sale_items || []
            const createdAt = sale.created_at || sale.createdAt || new Date().toISOString()
            return {
              id: sale.id,
              date: createdAt, // Guardar data completa com horário
              store: sale.category === 'lojinha' ? 'Lojinha Mágica'
                : sale.category === 'lanchonete' ? 'Lanchonete do Feiticeiro'
                : 'Sapatinho velOz',
              product: items.map((item: any) => item.product_name || item.productName || 'Produto').join(', ') || 'Compra',
              amount: parseFloat(sale.total) || 0,
              type: sale.category || 'lojinha'
            }
          })
          
          setPurchases(userPurchases)
        } catch (error: any) {
          console.error('Erro ao carregar dados:', error)
          setCard(null)
          setPurchases([])
        }
      } else {
        // Dados locais (fallback)
        const userCard: Card = {
          id: '1',
          name: user?.name || 'Meu Cartão',
          cardNumber: '1234567890123456',
          balance: localData.getBalance(user?.id || ''),
          phoneNumber: '11999999999'
        }
        setCard(userCard)

        const mockPurchases: Purchase[] = [
          { id: '1', date: '2025-01-15', store: 'Lojinha Mágica', product: 'Varinha Mágica', amount: 25.50, type: 'lojinha' },
          { id: '2', date: '2025-01-14', store: 'Lanchonete do Feiticeiro', product: 'Hambúrguer Especial', amount: 18.00, type: 'lanchonete' }
        ]
        setPurchases(mockPurchases)
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
    } finally {
      setIsLoadingData(false)
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

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString)
    const dateStr = date.toLocaleDateString('pt-BR')
    const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    return `${dateStr} às ${timeStr}`
  }

  // Loading inicial
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
      {/* Aviso Supabase não configurado */}
      {!isSupabaseConfigured() && (
        <div className="bg-blue-100 border border-blue-300 rounded-xl p-4 text-center">
          <p className="text-blue-800 text-sm">
            💡 <strong>Modo Local:</strong> Configure as variáveis de ambiente para usar o banco de dados.
          </p>
        </div>
      )}

      {/* Card Info */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl border border-yellow-200 p-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-black mb-6 font-display">
            💳 Meu Cartão
          </h2>
          
          {isLoadingData ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400 mx-auto mb-4"></div>
              <p className="text-gray-600">Carregando informações...</p>
            </div>
          ) : !card ? (
            <div className="text-center py-8">
              <div className="text-6xl mb-4">💳</div>
              <h3 className="text-xl font-bold text-black mb-4 font-display">
                Nenhum cartão associado
              </h3>
              <p className="text-gray-600 mb-6">
                Você ainda não possui um cartão associado à sua conta.
              </p>
              <Button
                onClick={() => navigate({ to: '/cards/associate' })}
                size="lg"
                className="bg-gradient-to-r from-ferro-500 to-ferro-600 hover:from-ferro-600 hover:to-ferro-700 text-white shadow-lg font-semibold"
              >
                🔗 Associar Cartão
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Nome */}
              <div className="bg-gradient-to-r from-ferro-100 to-ferro-200 rounded-xl p-6">
                <p className="text-black text-sm mb-2">👤 Nome do Portador</p>
                <p className="text-xl font-bold text-black">{card.name}</p>
              </div>

              {/* Número */}
              <div className="bg-gradient-to-r from-blue-100 to-blue-200 rounded-xl p-6">
                <p className="text-black text-sm mb-2">💳 Número do Cartão</p>
                <p className="text-lg font-mono font-bold text-black">
                  {formatCardNumber(card.cardNumber)}
                </p>
              </div>

              {/* Saldo */}
              <div className="bg-gradient-to-r from-yellow-100 to-yellow-200 rounded-xl p-6">
                <p className="text-black text-sm mb-2">💰 Saldo Disponível</p>
                <p className="text-3xl font-bold text-black">
                  R$ {card.balance.toFixed(2).replace('.', ',')}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Botão Abastecer PIX - só mostra se a feature flag estiver habilitada */}
      {card && pixEnabled === true && (
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl border border-yellow-200 p-6">
          <div className="text-center">
            <h3 className="text-xl font-semibold text-black mb-4 font-display">
              💰 Abastecer Cartão
            </h3>
            <p className="text-gray-600 mb-6">
              Adicione créditos ao seu cartão via PIX de forma rápida e segura.
            </p>
            <Button
              onClick={() => navigate({ to: '/pix/$paymentId', params: { paymentId: 'new' } })}
              size="lg"
              className="bg-gradient-to-r from-ferro-500 to-ferro-600 hover:from-ferro-600 hover:to-ferro-700 text-white shadow-lg font-semibold px-8"
            >
              💳 Gerar PIX para Abastecimento
            </Button>
          </div>
        </div>
      )}

      {/* Histórico */}
      {card && (
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl border border-yellow-200 p-8">
          <h3 className="text-xl font-semibold text-black mb-6 text-center font-display">
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
                        {purchase.store} • {formatDateTime(purchase.date)}
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
    </div>
  )
}

export default MyCardPage
