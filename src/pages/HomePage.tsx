import React, { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { usePermissions } from '../hooks/usePermissions'
import { useAuth } from '../contexts/AuthContext'

interface MainCard {
  id: string
  title: string
  icon: string
  description: string
  accent: string
  path: string
  canAccess: boolean
}

interface SubMenuItem {
  icon: string
  title: string
  description: string
  path: string
  canAccess: boolean
}

const HomePage: React.FC = () => {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const {
    userRole,
    canViewAccounts,
    canViewAdmin,
    canSellLojinha,
    canSellLanchonete,
    canManageProductsLojinha,
    canManageProductsLanchonete,
    canViewSalesHistoryLojinha,
    canViewSalesHistoryLanchonete,
    canViewOpenOrders,
  } = usePermissions()

  const [expandedCard, setExpandedCard] = useState<string | null>(null)
  
  const handleLogout = async () => {
    try {
      await logout()
    } catch (error) {
      console.error('Erro ao fazer logout:', error)
    }
  }

  // Definir os cards principais
  const mainCards: MainCard[] = [
    {
      id: 'minha-conta',
      title: 'MINHA CONTA',
      icon: '👤',
      description: 'Consulte seu saldo e histórico de compras',
      accent: 'bg-anil-700',
      path: '/account',
      canAccess: true
    },
    {
      id: 'comunicacao',
      title: 'COMUNICAÇÃO',
      icon: '📢',
      description: 'Gerenciar contas e saldos dos usuários',
      accent: 'bg-ferro-800',
      path: '/accounts',
      canAccess: userRole === 'admin' || userRole === 'comunicacao'
    },
    {
      id: 'lojinha',
      title: 'LOJINHA',
      icon: '🏪',
      description: 'Vendas, produtos, histórico e pedidos da lojinha',
      accent: 'bg-vagao-600',
      path: '/lojinha',
      canAccess: canSellLojinha || canManageProductsLojinha || canViewSalesHistoryLojinha || canViewOpenOrders
    },
    {
      id: 'lanchonete',
      title: 'LANCHONETE',
      icon: '🍔',
      description: 'Vendas, produtos e histórico da lanchonete',
      accent: 'bg-latao-500',
      path: '/lanchonete',
      canAccess: canSellLanchonete || canManageProductsLanchonete || canViewSalesHistoryLanchonete
    },
    {
      id: 'adm',
      title: 'ADM',
      icon: '👥',
      description: 'Painel administrativo e gerenciamento do sistema',
      accent: 'bg-fumaca-600',
      path: '/admin',
      canAccess: canViewAdmin
    }
  ]

  // Função para obter os sub-menus de cada card
  const getSubMenus = (cardId: string): SubMenuItem[] => {
    switch (cardId) {
      case 'minha-conta':
        return [
          {
            icon: '👤',
            title: 'Minha Conta',
            description: 'Ver saldo e histórico',
            path: '/account',
            canAccess: true
          }
        ]
      
      case 'comunicacao':
        return [
          {
            icon: '💰',
            title: 'Adicionar Saldo',
            description: 'Creditar valores diretamente nas contas',
            path: '/accounts/add',
            canAccess: canViewAccounts
          },
          {
            icon: '🔍',
            title: 'Consultar Saldo',
            description: 'Ver saldo disponível nas contas',
            path: '/accounts/balance',
            canAccess: canViewAccounts
          },
          {
            icon: '💸',
            title: 'Débito Manual',
            description: 'Debitar valores diretamente das contas',
            path: '/accounts/debit',
            canAccess: canViewAccounts
          }
        ]
      
      case 'lojinha':
        return [
          {
            icon: '🛒',
            title: 'Realizar Venda',
            description: 'Processar vendas',
            path: '/lojinha/select',
            canAccess: canSellLojinha
          },
          {
            icon: '📊',
            title: 'Histórico de Vendas',
            description: 'Consultar vendas realizadas',
            path: '/historico/lojinha',
            canAccess: canViewSalesHistoryLojinha
          },
          {
            icon: '📦',
            title: 'Cadastrar Produto',
            description: 'Adicionar novo produto',
            path: '/lojinha/products/create',
            canAccess: canManageProductsLojinha
          },
          {
            icon: '📋',
            title: 'Listar Produtos',
            description: 'Gerenciar produtos',
            path: '/lojinha/products',
            canAccess: canManageProductsLojinha
          },
          {
            icon: '📥',
            title: 'Pedidos Abertos',
            description: 'Ver pedidos pendentes',
            path: '/pedidos-lojinha',
            canAccess: canViewOpenOrders
          }
        ]
      
      case 'lanchonete':
        return [
          {
            icon: '🍽️',
            title: 'Realizar Venda',
            description: 'Processar vendas',
            path: '/lanchonete/select',
            canAccess: canSellLanchonete
          },
          {
            icon: '📊',
            title: 'Histórico de Vendas',
            description: 'Consultar vendas realizadas',
            path: '/historico/lanchonete',
            canAccess: canViewSalesHistoryLanchonete
          },
          {
            icon: '🥘',
            title: 'Cadastrar Produto',
            description: 'Adicionar item ao cardápio',
            path: '/lanchonete/products/create',
            canAccess: canManageProductsLanchonete
          },
          {
            icon: '📋',
            title: 'Listar Produtos',
            description: 'Gerenciar cardápio',
            path: '/lanchonete/products',
            canAccess: canManageProductsLanchonete
          }
        ]
      
      case 'adm':
        return [
          {
            icon: '👥',
            title: 'Painel Admin',
            description: 'Gerenciamento do sistema',
            path: '/admin',
            canAccess: canViewAdmin
          },
          {
            icon: '💳',
            title: 'Contas com Saldo Negativo',
            description: 'Ver contas com saldo negativo',
            path: '/admin-debitos',
            canAccess: canViewAdmin
          },
          {
            icon: '📡',
            title: 'Acompanhar',
            description: 'Pulso do sistema em tempo real',
            path: '/acompanhar',
            canAccess: canViewAdmin
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

  return (
    <div className="min-h-screen w-full pb-10 px-3 md:px-6 relative">
      <div className="max-w-6xl mx-auto relative">
        <h1 className="sr-only">Encontrão EJD 25 Anos - Trilhos e Destinos</h1>

        {/* Logo */}
        <div className="flex flex-col items-center pt-2 pb-6 md:pb-8">
          <img
            src="/logos/web/trenzinho.webp"
            alt="Encontrão EJD 25 Anos - Trilhos e Destinos"
            className="w-48 md:w-60 lg:w-64 h-auto drop-shadow-[0_10px_16px_rgba(72,36,12,0.3)]"
          />
          <div className="trilho w-full max-w-md mt-6" />
          <p className="carimbo text-vagao-600 text-sm md:text-base mt-5">
            🎫 Escolha seu destino
          </p>
        </div>

        {/* Bilhetes de cada área */}
        <div className={`grid gap-5 md:gap-6 ${accessibleCards.length === 1 ? 'grid-cols-1 justify-items-center' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
          {accessibleCards.map((card, index) => {
            const subMenus = getSubMenus(card.id).filter(item => item.canAccess)
            const isExpanded = expandedCard === card.id
            const hasMultipleSubMenus = subMenus.length > 1
            const hasSingleSubMenu = subMenus.length === 1

            const handleClick = () => {
              if (hasSingleSubMenu) {
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
                  className={`bilhete group w-full !p-0 min-h-[150px] flex items-stretch text-left hover:-translate-y-1 hover:shadow-bilhete-hover active:scale-[0.98] transition-all duration-300 touch-manipulation select-none opacity-0 animate-slide-in-up delay-${Math.min(index, 6) * 100} ${isExpanded ? 'ring-4 ring-latao-400/60' : ''}`}
                  type="button"
                  aria-expanded={hasMultipleSubMenus ? isExpanded : undefined}
                >
                  <div className={`${card.accent} w-20 md:w-24 shrink-0 rounded-l-xl flex flex-col items-center justify-center gap-2`}>
                    <span className="text-4xl md:text-5xl drop-shadow-sm transform group-hover:scale-110 transition-transform duration-300">
                      {card.icon}
                    </span>
                    <span className="font-ticket text-xs text-creme-100/90 tracking-widest">
                      Nº {String(index + 1).padStart(2, '0')}
                    </span>
                  </div>
                  <div className="picote-vertical flex-1 flex flex-col justify-center px-5 py-4">
                    <span className="font-display text-[11px] tracking-[0.3em] text-ferro-500 uppercase">
                      Destino
                    </span>
                    <h3 className="text-xl md:text-2xl font-display font-semibold text-ferro-900 uppercase leading-tight">
                      {card.title}
                    </h3>
                    <p className="text-sm text-ferro-700 leading-snug mt-1">
                      {card.description}
                    </p>
                    {hasMultipleSubMenus && (
                      <span className="mt-3 font-display text-xs tracking-widest uppercase text-vagao-600">
                        {isExpanded ? '▾ Fechar opções' : '▸ Ver opções'}
                      </span>
                    )}
                  </div>
                </button>

                {/* Sub-opções da área */}
                {isExpanded && hasMultipleSubMenus && (
                  <div className="mt-3 space-y-2 animate-fade-in">
                    {subMenus.map((subMenu, subIndex) => (
                      <button
                        key={subMenu.path}
                        onClick={() => handleSubCardClick(subMenu.path)}
                        className="group w-full !p-0 flex items-stretch text-left rounded-xl overflow-hidden bg-creme-50 border-2 border-ferro-800/80 shadow-sm hover:shadow-bilhete hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 touch-manipulation select-none"
                        type="button"
                        style={{ animationDelay: `${subIndex * 0.05}s` }}
                      >
                        <div className={`${card.accent} w-2 shrink-0`} />
                        <div className="flex items-center gap-3 flex-1 px-4 py-3">
                          <span className="text-2xl md:text-3xl">{subMenu.icon}</span>
                          <div className="flex-1">
                            <h4 className="text-base md:text-lg font-display font-medium text-ferro-900 leading-tight">
                              {subMenu.title}
                            </h4>
                            <p className="text-xs md:text-sm text-ferro-600 leading-snug">
                              {subMenu.description}
                            </p>
                          </div>
                          <span className="text-vagao-600 text-lg group-hover:translate-x-1 transition-transform duration-200">→</span>
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
          <div className="painel text-center py-12 px-8">
            <div className="text-6xl mb-4">🔒</div>
            <p className="text-xl text-ferro-800">
              Você não tem permissão para acessar nenhuma área do sistema.
            </p>
            <p className="text-sm text-ferro-600 mt-2">
              Entre em contato com o administrador.
            </p>
          </div>
        )}

        {/* Rodapé */}
        <div className="mt-14 flex justify-center">
          <div className="inline-flex items-center gap-3 pl-2 pr-5 py-2 rounded-full bg-caldeira shadow-bilhete">
            <img src="/logos/web/trenzinho-creme.webp" alt="EJD 25 anos" className="w-10 h-10" />
            <p className="font-display text-sm tracking-wider uppercase text-creme-200">
              Sistema de Gestão · Encontrão EJD 25 Anos
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default HomePage
