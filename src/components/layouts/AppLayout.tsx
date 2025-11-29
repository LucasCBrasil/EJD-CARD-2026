import { useState, useRef, useEffect } from 'react'
import { Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { Header, Button } from '../shared'
import { GlobalLoading } from '../shared/GlobalLoading'
import { TabNavigation } from '../ui'
import { useAuth } from '../../contexts/AuthContext'

const AppLayout = () => {
  const navigate = useNavigate()
  const routerState = useRouterState()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)

  // Fechar menu ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])
  
  // Tentar usar useAuth, mas tratar erro caso não esteja disponível
  let user = null
  let logout = () => {}
  let refreshUserProfile = async () => {}
  try {
    const auth = useAuth()
    user = auth.user
    logout = auth.logout
    refreshUserProfile = auth.refreshUserProfile
  } catch (error) {
    // AuthContext não disponível - isso não deveria acontecer, mas tratamos graciosamente
    console.warn('AuthContext não disponível no AppLayout')
  }

  const pathname = routerState.location.pathname
  const isHomePage = pathname === '/' || pathname === ''
  const isInListPage = pathname.endsWith('/products')
  // Verificar se está em páginas de produtos
  const isInProductsPage = pathname.endsWith('/products')
  
  // Verificar se está em página de formulário (create/edit) ou listagem
  const isInFormPage = pathname.includes('/products/create') || 
                       pathname.includes('/edit')
  
  // Verificar se está em subpágina de produtos (não na página principal /products)
  const isInProductsSubpage = isInFormPage || isInListPage
  
  // Determinar o contexto (lojinha ou lanchonete) para o botão de voltar
  const getBackContext = (): 'lojinha' | 'lanchonete' | 'sapatinho-veloz' => {
    if (pathname.startsWith('/lojinha')) return 'lojinha'
    if (pathname.startsWith('/lanchonete')) return 'lanchonete'
    if (pathname.startsWith('/sapatinho-veloz')) return 'sapatinho-veloz'
    return 'lojinha'
  }

  // Determinar aba ativa baseada na rota
  const getActiveTab = () => {
    const path = routerState.location.pathname
    if (path.includes('/historico/lojinha')) return 'historicoLojinha'
    if (path.includes('/historico/lanchonete')) return 'historicoLanchonete'
    if (path.includes('/historico/sapatinho')) return 'historicoSapatinho'
    if (path.includes('/pedidos-lojinha')) return 'lojinhaPedidos'
    if (path.includes('/pedidos-sapatinho-veloz')) return 'pedidos-sapatinho-veloz'
    if (path.includes('/sapatinho-veloz/products/create')) return 'sapatinho-veloz-products-create'
    if (path.includes('/sapatinho-veloz/products')) return 'sapatinho-veloz-products'
    if (path.includes('/lojinha')) return 'lojinha'
    if (path.includes('/lanchonete')) return 'lanchonete'
    if (path.startsWith('/mycard')) return 'mycard'
    if (path.startsWith('/cards')) return 'cards'
    if (path.startsWith('/admin')) return 'admin'
    if (path.startsWith('/sapatinho-veloz')) return 'sapatinho-veloz'
    return 'mycard'
  }

  const handleTabChange = (tab: 'cards' | 'lojinha' | 'lanchonete' | 'historicoLojinha' | 'lojinhaPedidos' | 'historicoLanchonete' | 'historicoSapatinho' |'admin' | 'mycard' | 'sapatinho-veloz' | 'pedidos-sapatinho-veloz' | 'sapatinho-veloz-products-create' | 'sapatinho-veloz-products') => {
    // Para as novas abas de produtos, navegar diretamente para o caminho correto
    if (tab === 'sapatinho-veloz-products-create') {
      navigate({ to: '/sapatinho-veloz/products/create' as any, search: {} as any })
    } else if (tab === 'sapatinho-veloz-products') {
      navigate({ to: '/sapatinho-veloz/products' as any, search: {} as any })
    } else {
      navigate({ to: `/${tab}` as any, search: {} as any })
    }
  }

  const handleBackToContext = () => {
    const context = getBackContext()
    // Se estiver em subpágina de produtos (create/edit/list), volta para /products
    // Caso contrário, volta para a página principal do contexto
    if (isInFormPage || isInListPage) {
      navigate({ to: `/${context}/select` as any, search: {} as any })
    } else if (isInListPage) {
      navigate({ to: `/${context}/select` as any, search: {} as any })
    } else {
      navigate({ to: `/${context}` as any, search: {} as any })
    }
  }

  // Determinar texto do botão de voltar
  const getBackButtonText = (): string => {
    const context = getBackContext()
    const contextName = context === 'lojinha'
      ? 'Lojinha'
      : context === 'lanchonete'
        ? 'Lanchonete'
        : 'Sapatinho velOz'
    
    if (isInProductsSubpage) {
      return `← Voltar para Gerenciar Produtos`
    }
    return `← Voltar para ${contextName}`
  }

  const handleLogout = async () => {
    try {
      console.log('Iniciando logout...')
      await logout()
      console.log('Logout concluído')
    } catch (error) {
      console.error('Erro ao fazer logout:', error)
    }
  }

  const handleRefreshProfile = async () => {
    setIsRefreshing(true)
    try {
      await refreshUserProfile()
    } catch (error) {
      console.error('Erro ao atualizar perfil:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  return (
    <>
      {/* Loading global - aparece quando há loaders pendentes */}
      <GlobalLoading />
      
      <div className={`min-h-screen w-full relative ${isHomePage ? 'overflow-visible' : 'overflow-auto'}`} style={{ minHeight: '100vh', backgroundColor: isHomePage ? 'transparent' : undefined }}>
      {/* Imagem de fundo - Estrada Dourada e Cidade Esmeralda - TODAS as páginas (exceto HomePage que gerencia seu próprio fundo) */}
      {!isHomePage && (
        <div 
          className="fixed inset-0"
          style={{
            backgroundImage: 'url(/background-emerald-city.png)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            backgroundAttachment: 'fixed',
            opacity: 0.6,
            zIndex: -1,
            pointerEvents: 'none',
            width: '100%',
            height: '100%',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0
          }}
        >
          {/* Overlay sutil para melhorar legibilidade - apenas em páginas internas */}
          <div className="absolute inset-0 bg-white/20 backdrop-blur-[2px] pointer-events-none"></div>
        </div>
      )}
      
      <div className={`w-full min-h-screen ${isHomePage ? 'px-0 py-0' : 'px-4 py-8'} relative`} style={{ zIndex: 1 }}>
        <div className={`${isHomePage ? 'w-full' : 'max-w-4xl mx-auto w-full'}`}>
          {/* Topbar minimalista */}
          <div 
            className={`flex justify-between items-center py-2 px-2 sm:px-3 mb-4 ${isHomePage ? 'relative' : ''}`}
            style={{ 
              zIndex: isHomePage ? 50 : 1,
            }}
          >
            {/* Info do usuário - clicável */}
            <div className="relative flex-1 min-w-0" ref={userMenuRef}>
              <button 
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl cursor-pointer active:scale-95 transition-all duration-150"
                style={{ 
                  background: isHomePage ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.95)',
                  backdropFilter: 'blur(8px)',
                  boxShadow: isHomePage ? 'none' : '0 2px 8px rgba(0,0,0,0.1)',
                  border: isHomePage ? '1px solid rgba(255,255,255,0.3)' : '1px solid rgba(0,0,0,0.08)',
                }}
              >
                {/* Avatar com inicial */}
                <div 
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-white font-bold text-xs sm:text-sm flex-shrink-0"
                  style={{ 
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  }}
                >
                  {(user?.name || user?.email || '?')[0].toUpperCase()}
                </div>
                
                {/* Nome truncado */}
                <span 
                  className="font-semibold truncate max-w-[80px] sm:max-w-[120px] text-xs sm:text-sm"
                  style={{ 
                    color: isHomePage ? '#ffffff' : '#1f2937',
                    textShadow: isHomePage ? '0 1px 3px rgba(0,0,0,0.5)' : 'none',
                  }}
                >
                  {user?.name || user?.email?.split('@')[0] || 'Usuário'}
                </span>
                
                {/* Badge de role - compacto em mobile */}
                <span 
                  className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-xs font-medium"
                  style={{
                    background: isHomePage ? 'rgba(16,185,129,0.4)' : '#dcfce7',
                    color: isHomePage ? '#ffffff' : '#166534',
                  }}
                >
                  {user?.role === 'admin' ? '👑 Admin' : 
                   user?.role === 'lojinha' ? '🏪 Lojinha' :
                   user?.role === 'lanchonete' ? '🍔 Lanchonete' :
                   user?.role === 'comunicacao' ? '📢 Comunicação' :
                   user?.role === 'servico' ? '⚙️ Serviço' :
                   '👤 Encontrista'}
                </span>
                
                {/* Apenas emoji em mobile */}
                <span 
                  className="sm:hidden text-sm"
                  style={{
                    filter: isHomePage ? 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' : 'none',
                  }}
                >
                  {user?.role === 'admin' ? '👑' : 
                   user?.role === 'lojinha' ? '🏪' :
                   user?.role === 'lanchonete' ? '🍔' :
                   user?.role === 'comunicacao' ? '📢' :
                   user?.role === 'servico' ? '⚙️' :
                   '👤'}
                </span>
                
                {/* Seta */}
                <svg 
                  className={`w-3 h-3 sm:w-4 sm:h-4 transition-transform duration-200 flex-shrink-0 ${showUserMenu ? 'rotate-180' : ''}`}
                  style={{ color: isHomePage ? '#ffffff' : '#6b7280' }}
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {/* Dropdown com e-mail */}
              {showUserMenu && (
                <div 
                  className="absolute left-0 right-auto sm:right-auto top-full mt-2 rounded-xl shadow-2xl py-3 px-4 w-[calc(100vw-2rem)] sm:w-auto sm:min-w-[280px] max-w-[320px] z-50 user-dropdown-menu"
                  style={{ 
                    animation: 'fadeIn 0.2s ease-out',
                    maxWidth: 'calc(100vw - 1rem)',
                    backgroundColor: '#ffffff',
                    border: '1px solid #e5e7eb',
                  }}
                >
                  {/* Header do dropdown */}
                  <div 
                    className="flex items-center gap-3 pb-3"
                    style={{ borderBottom: '1px solid #e5e7eb' }}
                  >
                    <div 
                      className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
                      style={{ 
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      }}
                    >
                      {(user?.name || user?.email || '?')[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div 
                        className="font-semibold truncate"
                        style={{ color: '#111827' }}
                      >
                        {user?.name || 'Usuário'}
                      </div>
                      <div style={{ color: '#6b7280', fontSize: '12px' }}>
                        {user?.role === 'admin' ? '👑 Administrador' : 
                         user?.role === 'lojinha' ? '🏪 Equipe Lojinha' :
                         user?.role === 'lanchonete' ? '🍔 Equipe Lanchonete' :
                         user?.role === 'comunicacao' ? '📢 Comunicação' :
                         user?.role === 'servico' ? '⚙️ Serviço' :
                         '👤 Encontrista'}
                      </div>
                    </div>
                  </div>
                  
                  {/* Info do e-mail */}
                  <div className="pt-3">
                    <div 
                      className="flex items-center gap-2 mb-1"
                      style={{ color: '#6b7280', fontSize: '12px' }}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      E-mail
                    </div>
                    <div 
                      className="break-all pl-5"
                      style={{ color: '#111827', fontSize: '14px', fontWeight: '500' }}
                    >
                      {user?.email || 'Não informado'}
                    </div>
                  </div>
                  
                  {/* Botão Renovar o Feitiço */}
                  <div className="pt-3 mt-3" style={{ borderTop: '1px solid #e5e7eb' }}>
                    <button
                      onClick={handleRefreshProfile}
                      disabled={isRefreshing}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 active:scale-95 disabled:opacity-60"
                      style={{
                        background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                        color: '#ffffff',
                        boxShadow: '0 2px 8px rgba(139, 92, 246, 0.3)',
                      }}
                    >
                      <span className={isRefreshing ? 'animate-spin' : ''}>
                        {isRefreshing ? '✨' : '🪄'}
                      </span>
                      {isRefreshing ? 'Renovando...' : 'Renovar o Feitiço'}
                    </button>
                    <p 
                      className="text-center mt-2"
                      style={{ color: '#9ca3af', fontSize: '11px' }}
                    >
                      Atualiza suas permissões mágicas
                    </p>
                  </div>
                </div>
              )}
            </div>
            
            {/* Botões */}
            <div className="flex gap-1.5 sm:gap-2 flex-shrink-0 ml-2">
              {!isHomePage && (
                <button 
                  onClick={() => navigate({ to: '/' as any })}
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-sm sm:text-base font-medium transition-all duration-150 active:scale-95"
                  style={{
                    background: '#fbbf24',
                    color: '#78350f',
                    boxShadow: '0 2px 8px rgba(251, 191, 36, 0.3)',
                  }}
                >
                  🏠
                </button>
              )}
              <button 
                onClick={handleLogout}
                className="h-9 sm:h-10 px-3 sm:px-4 rounded-xl flex items-center justify-center gap-1.5 text-xs sm:text-sm font-medium transition-all duration-150 active:scale-95"
                style={{
                  background: isHomePage ? 'rgba(255,255,255,0.2)' : '#ef4444',
                  color: '#ffffff',
                  backdropFilter: isHomePage ? 'blur(8px)' : 'none',
                  border: isHomePage ? '1px solid rgba(255,255,255,0.3)' : 'none',
                  boxShadow: isHomePage ? 'none' : '0 2px 8px rgba(239, 68, 68, 0.3)',
                }}
              >
                <span>🚪</span>
                <span className="hidden sm:inline">Sair</span>
              </button>
            </div>
          </div>
          
          {/* Header apenas em páginas internas, não na home */}
          {!isHomePage && (
            <Header 
              subtitle="Encontrão 2025 - em caminhos mágicos" 
            />
          )}

          {/* Navegação por Abas - apenas em páginas internas */}
          {!isHomePage && (
            <TabNavigation activeTab={getActiveTab()} onTabChange={handleTabChange} />
          )}
          
          {/* Botão de Voltar (apenas em páginas de produtos) */}
          {isInProductsPage && (
            <div className="flex justify-start mb-8 mt-4">
              <Button
                onClick={handleBackToContext}
                variant="outline"
                size="sm"
                className="border-emerald-500 !text-black hover:bg-emerald-200 hover:!text-black font-semibold font-cardinal shadow-md"
              >
                {getBackButtonText()}
              </Button>
            </div>
          )}
          
          {/* Conteúdo das rotas */}
          <div className={isInProductsPage ? "mt-0" : "mt-8"}>
            {<Outlet />}
          </div>
        </div>
      </div>
    </div>
    </>
  )
}

export default AppLayout