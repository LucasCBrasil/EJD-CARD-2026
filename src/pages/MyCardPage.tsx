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
              store: sale.category === 'lojinha' ? 'Lojinha'
                : sale.category === 'lanchonete' ? 'Lanchonete'
                : 'Sapatinho Veloz',
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
          { id: '1', date: '2026-01-15', store: 'Lojinha', product: 'Caneca Trilhos e Destinos', amount: 25.50, type: 'lojinha' },
          { id: '2', date: '2026-01-14', store: 'Lanchonete', product: 'Hambúrguer Especial', amount: 18.00, type: 'lanchonete' }
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

  const purchaseIcon = (type: Purchase['type']) =>
    type === 'lojinha' ? '🏪' : type === 'lanchonete' ? '🍔' : '💌'

  const purchaseAccent = (type: Purchase['type']) =>
    type === 'lojinha' ? 'bg-vagao-600' : type === 'lanchonete' ? 'bg-latao-500' : 'bg-ferro-500'

  // Loading inicial
  if (!card && !localData && !supabaseData) {
    return (
      <div className="text-center py-10">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-ferro-200 border-t-ferro-800 mx-auto mb-4"></div>
        <p className="text-ferro-600">Carregando seu cartão...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Aviso Supabase não configurado */}
      {!isSupabaseConfigured() && (
        <div className="bg-anil-100 border border-anil-300 rounded-xl p-4 text-center">
          <p className="text-anil-800 text-sm">
            💡 <strong>Modo Local:</strong> Configure as variáveis de ambiente para usar o banco de dados.
          </p>
        </div>
      )}

      {/* Cabeçalho */}
      <div className="text-center">
        <h2 className="text-2xl md:text-3xl font-semibold text-ferro-900 font-display uppercase tracking-wide">
          🎫 Meu Cartão
        </h2>
        <div className="trilho w-full max-w-xs mx-auto mt-3" />
      </div>

      {/* Bilhete do cartão */}
      {isLoadingData ? (
        <div className="painel text-center py-10 px-6">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-ferro-200 border-t-ferro-800 mx-auto mb-4"></div>
          <p className="text-ferro-600">Carregando informações...</p>
        </div>
      ) : !card ? (
        <div className="painel text-center py-10 px-6">
          <div className="text-6xl mb-4">🎫</div>
          <h3 className="text-xl font-semibold text-ferro-900 mb-2 font-display uppercase tracking-wide">
            Nenhum cartão associado
          </h3>
          <p className="text-ferro-600 mb-6">
            Você ainda não possui um cartão associado à sua conta.
          </p>
          <Button
            onClick={() => navigate({ to: '/cards/associate' })}
            size="lg"
            className="!bg-vagao-600 hover:!bg-vagao-700 !border-vagao-600 !text-creme-50"
          >
            🔗 Associar Cartão
          </Button>
        </div>
      ) : (
        <div className="bilhete overflow-hidden mx-auto max-w-2xl">
          <div className="flex flex-col md:flex-row">
            {/* Canhoto */}
            <div className="bg-caldeira rounded-t-xl md:rounded-tr-none md:rounded-l-xl px-5 py-4 md:w-48 shrink-0 flex md:flex-col items-center md:items-start justify-between gap-2">
              <div>
                <p className="font-display text-[11px] tracking-[0.3em] uppercase text-creme-200/70">Encontrão EJD</p>
                <p className="font-display text-lg font-semibold uppercase tracking-wide text-creme-200 leading-tight">25 Anos</p>
              </div>
              <div className="text-right md:text-left">
                <p className="font-display text-[11px] tracking-[0.3em] uppercase text-creme-200/70">Bilhete Nº</p>
                <p className="font-ticket text-2xl font-bold text-latao-400 leading-none">
                  {formatCardNumber(card.cardNumber)}
                </p>
              </div>
            </div>

            {/* Corpo do bilhete */}
            <div className="flex-1 px-5 py-5 border-t-2 md:border-t-0 md:border-l-2 border-dashed border-ferro-800/30">
              <p className="font-display text-[11px] tracking-[0.3em] uppercase text-ferro-500">Passageiro</p>
              <p className="text-xl font-semibold text-ferro-900 leading-tight break-words">{card.name}</p>

              <div className="picote-horizontal mt-4 pt-4 flex items-end justify-between gap-3">
                <div>
                  <p className="font-display text-[11px] tracking-[0.3em] uppercase text-ferro-500">Saldo Disponível</p>
                  <p className={`font-slab text-3xl md:text-4xl leading-tight ${card.balance < 0 ? 'text-vagao-600' : 'text-ferro-900'}`}>
                    R$ {card.balance.toFixed(2).replace('.', ',')}
                  </p>
                </div>
                <span className="carimbo text-green-700 text-xs shrink-0">Embarque ok</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Botão Abastecer PIX - só mostra se a feature flag estiver habilitada */}
      {card && pixEnabled === true && (
        <div className="painel p-5 md:p-6 text-center">
          <h3 className="text-xl font-semibold text-ferro-900 mb-2 font-display uppercase tracking-wide">
            ⛽ Abastecer Cartão
          </h3>
          <p className="text-ferro-600 mb-5">
            Adicione créditos ao seu cartão via PIX de forma rápida e segura.
          </p>
          <Button
            onClick={() => navigate({ to: '/pix/$paymentId', params: { paymentId: 'new' } })}
            size="lg"
            className="w-full sm:w-auto !bg-vagao-600 hover:!bg-vagao-700 !border-vagao-600 !text-creme-50"
          >
            💳 Gerar PIX para Abastecimento
          </Button>
        </div>
      )}

      {/* Histórico */}
      {card && (
        <div className="painel p-5 md:p-8">
          <h3 className="text-xl font-semibold text-ferro-900 mb-5 text-center font-display uppercase tracking-wide">
            📋 Histórico de Viagens
          </h3>
          
          {purchases.length > 0 ? (
            <div className="space-y-3">
              {purchases.map((purchase) => (
                <div 
                  key={purchase.id}
                  className="flex items-stretch overflow-hidden rounded-xl bg-creme-100 border border-ferro-200"
                >
                  <div className={`${purchaseAccent(purchase.type)} w-1.5 shrink-0`} />
                  <div className="flex flex-1 items-start justify-between gap-3 px-4 py-3 min-w-0">
                    <div className="flex items-start gap-3 min-w-0">
                      <span className="text-2xl leading-none mt-0.5">{purchaseIcon(purchase.type)}</span>
                      <div className="min-w-0">
                        <h4 className="font-semibold text-ferro-900 font-body leading-snug break-words">{purchase.product}</h4>
                        <p className="text-xs text-ferro-600 mt-0.5">
                          {purchase.store} • {formatDateTime(purchase.date)}
                        </p>
                      </div>
                    </div>
                    <p className="font-slab text-base text-ferro-900 shrink-0 whitespace-nowrap">
                      R$ {purchase.amount.toFixed(2).replace('.', ',')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-4xl mb-3">🛤️</div>
              <p className="text-ferro-600">Nenhuma compra realizada ainda</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default MyCardPage
