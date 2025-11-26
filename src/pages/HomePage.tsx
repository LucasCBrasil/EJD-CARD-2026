import React, { useState, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { usePermissions } from '../hooks/usePermissions'
import { useAuth } from '../contexts/AuthContext'
import { useCardByUserId } from '../hooks/useCards'
import { Button } from '../components/shared'

interface MainCard {
  id: string
  title: string
  icon: string
  description: string
  color: string
  gradient: string
  path: string
  canAccess: boolean
}

interface SubMenuItem {
  icon: string
  title: string
  description: string
  path: string
  canAccess: boolean
  color: string
  gradient: string
}

const HomePage: React.FC = () => {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const {
    userRole,
    canViewCards,
    canViewAdmin,
    canSellLojinha,
    canSellLanchonete,
    canManageProductsLojinha,
    canManageProductsLanchonete,
    canViewSalesHistoryLojinha,
    canViewSalesHistoryLanchonete,
    canViewSalesHistorySapatinho,
    canViewOpenOrders,
    canPlaceOrderSapatinho,
    canSellSapatinho
  } = usePermissions()

  const [expandedCard, setExpandedCard] = useState<string | null>(null)
  const [logoError, setLogoError] = useState(false)
  const [backgroundLoaded, setBackgroundLoaded] = useState(false)
  
  // Verificar se o usuário tem um cartão associado
  const { user } = useAuth()
  const { data: userCard } = useCardByUserId(user?.id || '', !!user?.id)
  const hasAssociatedCard = !!userCard

  const handleLogout = async () => {
    try {
      await logout()
    } catch (error) {
      console.error('Erro ao fazer logout:', error)
    }
  }

  // Carregar imagem de fundo
  useEffect(() => {
    // Garantir que começa como false
    setBackgroundLoaded(false)
    
    const img = new Image()
    img.src = '/background-emerald-city.png'
    
    // Forçar reload da imagem para garantir que carrega
    img.onload = () => {
      // Aguardar um pouco para garantir que a imagem está totalmente carregada e renderizada
      setTimeout(() => {
        setBackgroundLoaded(true)
      }, 300)
    }
    img.onerror = () => {
      // Se a imagem falhar ao carregar, ainda assim mostrar o conteúdo após um delay maior
      setTimeout(() => {
        setBackgroundLoaded(true)
      }, 1000)
    }
    
    // Se a imagem já estiver em cache, pode não disparar onload
    if (img.complete) {
      setTimeout(() => {
        setBackgroundLoaded(true)
      }, 300)
    }
  }, [])

  // Definir os cards principais
  const mainCards: MainCard[] = [
    {
      id: 'meu-cartao',
      title: 'MEU CARTÃO',
      icon: '💳',
      description: 'Consulte seu saldo e histórico de compras',
      color: 'from-wizard-100 to-wizard-200',
      gradient: 'border-wizard-300',
      path: '/mycard',
      canAccess: true
    },
    {
      id: 'comunicacao',
      title: 'COMUNICAÇÃO',
      icon: '📢',
      description: 'Gerenciar cartões, criar e adicionar saldo',
      color: 'from-emerald-100 to-emerald-200',
      gradient: 'border-emerald-300',
      path: '/cards',
      canAccess: userRole === 'admin' || userRole === 'comunicacao'
    },
    {
      id: 'lojinha',
      title: 'LOJINHA',
      icon: '🏪',
      description: 'Vendas, produtos, histórico e pedidos da lojinha',
      color: 'from-green-100 to-green-200',
      gradient: 'border-green-300',
      path: '/lojinha',
      canAccess: canSellLojinha || canManageProductsLojinha || canViewSalesHistoryLojinha || canViewOpenOrders
    },
    {
      id: 'lanchonete',
      title: 'LANCHONETE',
      icon: '🍔',
      description: 'Vendas, produtos e histórico da lanchonete',
      color: 'from-golden-100 to-golden-200',
      gradient: 'border-golden-300',
      path: '/lanchonete',
      canAccess: canSellLanchonete || canManageProductsLanchonete || canViewSalesHistoryLanchonete
    },
    {
      id: 'sapatinho',
      title: 'SAPATINHO VELOZ',
      icon: '👠',
      description: 'torne o dia de alguém ainda mais especial',
      color: 'from-ruby-100 to-ruby-200',
      gradient: 'border-ruby-300',
      path: '/sapatinho-veloz',
      canAccess: hasAssociatedCard && (canSellSapatinho || canPlaceOrderSapatinho || canViewSalesHistorySapatinho)
    },
    {
      id: 'adm',
      title: 'ADM',
      icon: '👥',
      description: 'Painel administrativo e gerenciamento do sistema',
      color: 'from-compass-100 to-compass-200',
      gradient: 'border-compass-300',
      path: '/admin',
      canAccess: canViewAdmin
    }
  ]

  // Função para obter os sub-menus de cada card
  const getSubMenus = (cardId: string): SubMenuItem[] => {
    switch (cardId) {
      case 'meu-cartao':
        return [
          {
            icon: '💳',
            title: 'Meu Cartão',
            description: 'Ver saldo e histórico',
            path: '/mycard',
            canAccess: true,
            color: 'from-wizard-100 to-wizard-200',
            gradient: 'border-wizard-300'
          }
        ]
      
      case 'comunicacao':
        return [
          {
            icon: '➕',
            title: 'Criar Cartão',
            description: 'Cadastrar novo encontrista',
            path: '/cards/create',
            canAccess: canViewCards,
            color: 'from-emerald-100 to-emerald-200',
            gradient: 'border-emerald-300'
          },
          {
            icon: '💰',
            title: 'Adicionar Saldo',
            description: 'Creditar valores em cartões',
            path: '/cards/add',
            canAccess: canViewCards,
            color: 'from-golden-100 to-golden-200',
            gradient: 'border-golden-300'
          },
          {
            icon: '🔍',
            title: 'Consultar Saldo',
            description: 'Ver saldo disponível',
            path: '/cards/balance',
            canAccess: canViewCards,
            color: 'from-compass-100 to-compass-200',
            gradient: 'border-compass-300'
          },
          {
            icon: '💸',
            title: 'Débito Manual',
            description: 'Debitar valores de cartões',
            path: '/cards/debit',
            canAccess: canViewCards,
            color: 'from-ruby-100 to-ruby-200',
            gradient: 'border-ruby-300'
          }
        ]
      
      case 'lojinha':
        return [
          {
            icon: '🛒',
            title: 'Realizar Venda',
            description: 'Processar vendas',
            path: '/lojinha/select',
            canAccess: canSellLojinha,
            color: 'from-green-100 to-green-200',
            gradient: 'border-green-300'
          },
          {
            icon: '📊',
            title: 'Histórico de Vendas',
            description: 'Consultar vendas realizadas',
            path: '/historico/lojinha',
            canAccess: canViewSalesHistoryLojinha,
            color: 'from-blue-100 to-blue-200',
            gradient: 'border-blue-300'
          },
          {
            icon: '📦',
            title: 'Cadastrar Produto',
            description: 'Adicionar novo produto',
            path: '/lojinha/products/create',
            canAccess: canManageProductsLojinha,
            color: 'from-emerald-100 to-emerald-200',
            gradient: 'border-emerald-300'
          },
          {
            icon: '📋',
            title: 'Listar Produtos',
            description: 'Gerenciar produtos',
            path: '/lojinha/products',
            canAccess: canManageProductsLojinha,
            color: 'from-compass-100 to-compass-200',
            gradient: 'border-compass-300'
          },
          {
            icon: '📥',
            title: 'Pedidos Abertos',
            description: 'Ver pedidos pendentes',
            path: '/pedidos-lojinha',
            canAccess: canViewOpenOrders,
            color: 'from-wizard-100 to-wizard-200',
            gradient: 'border-wizard-300'
          },
          {
            icon: '👠',
            title: 'Cadastrar Produto Sapatinho',
            description: 'Adicionar novo produto do sapatinho',
            path: '/sapatinho-veloz/products/create',
            canAccess: canSellSapatinho || userRole === 'admin' || userRole === 'lojinha',
            color: 'from-ruby-100 to-ruby-200',
            gradient: 'border-ruby-300'
          },
          {
            icon: '📋',
            title: 'Listar Produtos Sapatinho',
            description: 'Gerenciar produtos do sapatinho',
            path: '/sapatinho-veloz/products',
            canAccess: canSellSapatinho || userRole === 'admin' || userRole === 'lojinha',
            color: 'from-ruby-100 to-ruby-200',
            gradient: 'border-ruby-300'
          },
          {
            icon: '📦',
            title: 'Pedidos Sapatinho',
            description: 'Ver pedidos pendentes do sapatinho',
            path: '/pedidos-sapatinho-veloz',
            canAccess: canViewOpenOrders && (canSellSapatinho || userRole === 'admin' || userRole === 'lojinha'),
            color: 'from-ruby-100 to-ruby-200',
            gradient: 'border-ruby-300'
          },
          {
            icon: '📊',
            title: 'Histórico Sapatinho',
            description: 'Consultar vendas do sapatinho',
            path: '/historico/sapatinho',
            canAccess: canViewSalesHistorySapatinho || userRole === 'admin' || userRole === 'lojinha',
            color: 'from-ruby-100 to-ruby-200',
            gradient: 'border-ruby-300'
          }
        ]
      
      case 'lanchonete':
        return [
          {
            icon: '🍽️',
            title: 'Realizar Venda',
            description: 'Processar vendas',
            path: '/lanchonete/select',
            canAccess: canSellLanchonete,
            color: 'from-golden-100 to-golden-200',
            gradient: 'border-golden-300'
          },
          {
            icon: '📊',
            title: 'Histórico de Vendas',
            description: 'Consultar vendas realizadas',
            path: '/historico/lanchonete',
            canAccess: canViewSalesHistoryLanchonete,
            color: 'from-blue-100 to-blue-200',
            gradient: 'border-blue-300'
          },
          {
            icon: '🥘',
            title: 'Cadastrar Produto',
            description: 'Adicionar item ao cardápio',
            path: '/lanchonete/products/create',
            canAccess: canManageProductsLanchonete,
            color: 'from-emerald-100 to-emerald-200',
            gradient: 'border-emerald-300'
          },
          {
            icon: '📋',
            title: 'Listar Produtos',
            description: 'Gerenciar cardápio',
            path: '/lanchonete/products',
            canAccess: canManageProductsLanchonete,
            color: 'from-compass-100 to-compass-200',
            gradient: 'border-compass-300'
          }
        ]
      
      case 'sapatinho':
        return [
          {
            icon: '🛍️',
            title: 'Realizar Venda',
            description: 'Processar vendas',
            path: '/sapatinho-veloz/sales',
            canAccess: canSellSapatinho,
            color: 'from-ruby-100 to-ruby-200',
            gradient: 'border-ruby-300'
          },
          {
            icon: '🛒',
            title: 'Fazer Pedido',
            description: 'Solicitar produto',
            path: '/sapatinho-veloz/select',
            canAccess: canPlaceOrderSapatinho,
            color: 'from-wizard-100 to-wizard-200',
            gradient: 'border-wizard-300'
          },
          {
            icon: '📊',
            title: 'Histórico de Vendas',
            description: 'Consultar vendas realizadas',
            path: '/historico/sapatinho',
            canAccess: canViewSalesHistorySapatinho,
            color: 'from-blue-100 to-blue-200',
            gradient: 'border-blue-300'
          },
          {
            icon: '📥',
            title: 'Pedidos Abertos',
            description: 'Ver pedidos pendentes',
            path: '/pedidos-sapatinho-veloz',
            canAccess: canViewOpenOrders && (canSellSapatinho || userRole === 'admin' || userRole === 'lojinha'),
            color: 'from-golden-100 to-golden-200',
            gradient: 'border-golden-300'
          },
          {
            icon: '👠',
            title: 'Cadastrar Produto',
            description: 'Adicionar novo produto',
            path: '/sapatinho-veloz/products/create',
            canAccess: canSellSapatinho || userRole === 'admin' || userRole === 'lojinha',
            color: 'from-emerald-100 to-emerald-200',
            gradient: 'border-emerald-300'
          },
          {
            icon: '📋',
            title: 'Listar Produtos',
            description: 'Gerenciar produtos',
            path: '/sapatinho-veloz/products',
            canAccess: canSellSapatinho || userRole === 'admin' || userRole === 'lojinha',
            color: 'from-compass-100 to-compass-200',
            gradient: 'border-compass-300'
          }
        ]
      
      case 'adm':
        return [
          {
            icon: '👥',
            title: 'Painel Admin',
            description: 'Gerenciamento do sistema',
            path: '/admin',
            canAccess: canViewAdmin,
            color: 'from-compass-100 to-compass-200',
            gradient: 'border-compass-300'
          }
        ]
      
      default:
        return []
    }
  }

  const handleCardClick = (cardId: string) => {
    if (expandedCard === cardId) {
      setExpandedCard(null)
    } else {
      setExpandedCard(cardId)
      // Scroll suave até o card expandido em dispositivos móveis
      setTimeout(() => {
        const element = document.getElementById(`card-${cardId}`)
        if (element && window.innerWidth < 768) {
          element.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        }
      }, 100)
    }
  }

  const handleSubCardClick = (path: string) => {
    navigate({ to: path as any })
  }

  // Filtrar apenas cards que o usuário tem acesso
  const accessibleCards = mainCards.filter(card => card.canAccess)

  // Mostrar spinner enquanto a imagem de fundo não carregar
  if (!backgroundLoaded) {
    return (
      <div 
        className="fixed inset-0 w-screen h-screen flex items-center justify-center bg-white z-[99999]"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: '#ffffff'
        }}
      >
        <div className="relative z-10 flex flex-col items-center justify-center w-full h-full">
          {/* Spinner animado */}
          <div className="relative mb-8">
            <div className="w-20 h-20 border-4 border-golden-200 border-t-golden-500 rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }}></div>
            </div>
          </div>
          
          {/* Texto de carregamento */}
          <div className="text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-golden-600 mb-2 font-cardinal animate-pulse">
              Carregando...
            </h2>
            <p className="text-lg text-emerald-600 font-farmhand">
              Preparando sua jornada mágica
            </p>
          </div>
          
          {/* Efeitos decorativos */}
          <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
            <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-golden-500/20 rounded-full blur-3xl animate-pulse"></div>
            <div className="absolute bottom-1/4 right-1/4 w-40 h-40 bg-emerald-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '0.5s' }}></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full py-4 md:py-8 px-3 md:px-4 relative overflow-hidden" style={{ backgroundColor: 'transparent' }}>
      {/* Imagem de fundo - Estrada Dourada e Cidade Esmeralda - Fixa e sempre visível */}
      <div 
        className="fixed inset-0"
        style={{
          backgroundImage: 'url(/background-emerald-city.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          zIndex: 0,
          pointerEvents: 'none',
          width: '100vw',
          height: '100vh',
          minWidth: '100vw',
          minHeight: '100vh',
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          transform: 'scale(1.1)'
        }}
      >
        {/* Overlay sutil para melhorar legibilidade do conteúdo */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/10 pointer-events-none"></div>
      </div>

      <div className="max-w-7xl mx-auto relative" style={{ zIndex: 10 }}>

        {/* Logo e Título */}
        <div className="text-center mb-8 md:mb-12">
          <div className="flex justify-center mb-4 md:mb-6 animate-float">
            {!logoError ? (
              <img
                src="/logo-encontrão-2025.png"
                alt="Encontrão 2025"
                className="w-48 h-auto md:w-64 lg:w-80 drop-shadow-[0_0_40px_rgba(251,191,36,0.8)] filter brightness-125"
                onError={() => setLogoError(true)}
              />
            ) : (
              <div className="text-6xl md:text-7xl lg:text-8xl">🌈</div>
            )}
          </div>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-golden-300 mb-2 md:mb-3 font-cardinal drop-shadow-[0_4px_20px_rgba(251,191,36,0.8)] tracking-wider">
            Encontrão 2025
          </h1>
          <p className="text-lg md:text-xl lg:text-2xl text-emerald-300 font-newyorker drop-shadow-[0_4px_15px_rgba(16,185,129,0.6)]">
            em caminhos mágicos
          </p>
          {/* Linha decorativa */}
          <div className="flex justify-center items-center mt-4 space-x-2">
            <div className="w-16 h-1 bg-gradient-to-r from-transparent via-golden-400 to-transparent rounded-full shadow-[0_0_10px_rgba(251,191,36,0.8)]"></div>
            <span className="text-golden-400 text-2xl drop-shadow-[0_0_10px_rgba(251,191,36,1)]">✨</span>
            <div className="w-16 h-1 bg-gradient-to-r from-transparent via-golden-400 to-transparent rounded-full shadow-[0_0_10px_rgba(251,191,36,0.8)]"></div>
          </div>
        </div>

        {/* Grid de Cards */}
        <div className={`grid gap-4 md:gap-6 ${accessibleCards.length === 1 ? 'grid-cols-1 justify-items-center' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
          {accessibleCards.map((card, index) => {
            const subMenus = getSubMenus(card.id).filter(item => item.canAccess)
            const isExpanded = expandedCard === card.id
            const hasMultipleSubMenus = subMenus.length > 1
            const hasSingleSubMenu = subMenus.length === 1
            
            // Cards especiais que devem navegar diretamente para sua página principal
            const directNavigationCards = ['sapatinho']
            const shouldNavigateDirectly = directNavigationCards.includes(card.id)
            
            // Se tem apenas uma opção, navegar diretamente
            const handleClick = () => {
              if (shouldNavigateDirectly) {
                // Navegar diretamente para a página principal do card
                handleSubCardClick(card.path)
              } else if (hasSingleSubMenu) {
                handleSubCardClick(subMenus[0].path)
              } else if (hasMultipleSubMenus) {
                handleCardClick(card.id)
              } else {
                handleSubCardClick(card.path)
              }
            }
            
            return (
              <div key={card.id} id={`card-${card.id}`} className={accessibleCards.length === 1 ? 'w-full max-w-md' : 'col-span-1'}>
                <button
                  onClick={handleClick}
                  className={`group relative w-full min-h-[200px] flex flex-col items-center justify-center backdrop-blur-xl bg-white/10 border-2 border-white/20 rounded-2xl p-4 md:p-5 shadow-[0_8px_32px_0_rgba(251,191,36,0.37)] hover:shadow-[0_8px_50px_0_rgba(251,191,36,0.6)] transition-all duration-500 transform hover:scale-105 hover:-translate-y-2 active:scale-95 touch-manipulation select-none opacity-0 animate-slide-in-up delay-${Math.min(index, 6) * 100} overflow-hidden`}
                  type="button"
                  style={{
                    background: `linear-gradient(135deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0.05) 100%)`
                  }}
                >
                  {/* Borda interna colorida baseada no card */}
                  <div className={`absolute inset-0 rounded-2xl border-2 ${card.gradient} opacity-40 pointer-events-none`}></div>
                  
                  {/* Efeito de brilho no hover */}
                  <div className={`absolute inset-0 bg-gradient-to-br from-white/30 via-golden-400/10 to-transparent ${isExpanded ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity duration-500 pointer-events-none rounded-2xl`}></div>
                  
                  {/* Borda interna brilhante */}
                  <div className="absolute inset-0 rounded-2xl border border-white/40 pointer-events-none"></div>
                  
                  <div className="text-center relative z-10 flex flex-col items-center justify-center w-full">
                    <div className="text-4xl md:text-5xl mb-2 transform group-hover:scale-110 transition-transform duration-300 filter drop-shadow-[0_0_10px_rgba(251,191,36,0.5)]">
                      {card.icon}
                    </div>
                    <h3 className="text-lg md:text-xl font-bold text-white font-cardinal tracking-wide mb-2 drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)] uppercase">
                      {card.title}
                    </h3>
                    <p className="text-xs md:text-sm text-white/90 font-farmhand leading-relaxed drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] mb-2 px-2">
                      {card.description}
                    </p>
                    {hasMultipleSubMenus && (
                      <div className="mt-2 text-golden-300 text-xs font-bold animate-pulse">
                        {isExpanded ? '▼ Clique para fechar' : '▶ Clique para ver opções'}
                      </div>
                    )}
                  </div>
                </button>
                
                {/* Menu de sub-opções - apenas se tiver múltiplas opções */}
                {isExpanded && hasMultipleSubMenus && (
                  <div className="mt-4 space-y-3 animate-fade-in">
                    {subMenus.map((subMenu, subIndex) => (
                      <button
                        key={subMenu.path}
                        onClick={() => handleSubCardClick(subMenu.path)}
                        className={`group relative w-full backdrop-blur-xl bg-white/60 border-2 border-white/40 rounded-2xl p-4 md:p-5 shadow-[0_4px_16px_0_rgba(251,191,36,0.25)] hover:shadow-[0_4px_24px_0_rgba(251,191,36,0.5)] transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 active:scale-95 touch-manipulation select-none overflow-hidden`}
                        type="button"
                        style={{
                          background: `linear-gradient(135deg, rgba(255, 255, 255, 0.7) 0%, rgba(255, 255, 255, 0.5) 100%)`,
                          animationDelay: `${subIndex * 0.1}s`
                        }}
                      >
                        {/* Borda interna colorida */}
                        <div className={`absolute inset-0 rounded-2xl border-2 ${subMenu.gradient} opacity-40 pointer-events-none`}></div>
                        
                        {/* Efeito de brilho no hover */}
                        <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-golden-400/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-2xl"></div>
                        
                        {/* Borda interna brilhante */}
                        <div className="absolute inset-0 rounded-2xl border border-white/40 pointer-events-none"></div>
                        
                        <div className="flex items-center space-x-4 relative z-10">
                          <div className="text-3xl md:text-4xl transform group-hover:scale-110 transition-transform duration-300 filter drop-shadow-[0_0_8px_rgba(251,191,36,0.4)]">
                            {subMenu.icon}
                          </div>
                          <div className="flex-1 text-left">
                            <h4 className="text-base md:text-lg font-bold text-white font-cardinal tracking-wide drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]">
                              {subMenu.title}
                            </h4>
                            <p className="text-xs md:text-sm text-white/80 font-farmhand drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)]">
                              {subMenu.description}
                            </p>
                          </div>
                          <div className="text-golden-400 text-xl group-hover:translate-x-1 transition-transform duration-300">
                            →
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Mensagem se não houver cards */}
        {accessibleCards.length === 0 && (
          <div className="text-center py-12 bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border-2 border-golden-200 p-8">
            <div className="text-6xl mb-4">🔒</div>
            <p className="text-xl text-gray-700 font-farmhand">
              Você não tem permissão para acessar nenhuma área do sistema.
            </p>
            <p className="text-sm text-gray-600 mt-2 font-farmhand">
              Entre em contato com o administrador.
            </p>
          </div>
        )}

        {/* Rodapé com informações */}
        <div className="mt-12 text-center text-sm text-white font-farmhand">
          <div className="flex justify-center items-center space-x-2">
            <span className="text-golden-400 drop-shadow-[0_0_8px_rgba(251,191,36,1)]">✨</span>
            <p className="drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">Sistema de Gestão - Encontrão 2025</p>
            <span className="text-golden-400 drop-shadow-[0_0_8px_rgba(251,191,36,1)]">✨</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default HomePage


