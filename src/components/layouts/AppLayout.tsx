import { useState, useRef, useEffect } from 'react'
import { Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { Header, Button, TrilhosBackground } from '../shared'
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
  const getBackContext = (): 'lojinha' | 'lanchonete' => {
    if (pathname.startsWith('/lojinha')) return 'lojinha'
    if (pathname.startsWith('/lanchonete')) return 'lanchonete'
    return 'lojinha'
  }

  // Determinar aba ativa baseada na rota
  const getActiveTab = () => {
    const path = routerState.location.pathname
    if (path.includes('/historico/lojinha')) return 'historicoLojinha'
    if (path.includes('/historico/lanchonete')) return 'historicoLanchonete'
    if (path.includes('/pedidos-lojinha')) return 'lojinhaPedidos'
    if (path.includes('/lojinha')) return 'lojinha'
    if (path.includes('/lanchonete')) return 'lanchonete'
    if (path.startsWith('/accounts')) return 'accounts'
    if (path.startsWith('/account')) return 'account'
    if (path.startsWith('/admin')) return 'admin'
    return 'mycard'
  }

  const handleTabChange = (tab: 'account' | 'accounts' | 'lojinha' | 'lanchonete' | 'historicoLojinha' | 'lojinhaPedidos' | 'historicoLanchonete' | 'admin' | 'mycard') => {
    navigate({ to: `/${tab}` as any, search: {} as any })
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
    const contextName = context === 'lojinha' ? 'Lojinha' : 'Lanchonete'
    
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

  const roleLabel = (short: boolean) => {
    switch (user?.role) {
      case 'admin': return short ? '👑 Admin' : '👑 Administrador'
      case 'lojinha': return short ? '🏪 Lojinha' : '🏪 Equipe Lojinha'
      case 'lanchonete': return short ? '🍔 Lanchonete' : '🍔 Equipe Lanchonete'
      case 'comunicacao': return '📢 Comunicação'
      case 'servico': return '⚙️ Serviço'
      default: return '🎫 Encontrista'
    }
  }

  const roleEmoji = roleLabel(true).split(' ')[0]

  return (
    <>
      {/* Loading global - aparece quando há loaders pendentes */}
      <GlobalLoading />

      <TrilhosBackground />

      <div className={`min-h-screen w-full relative ${isHomePage ? 'overflow-visible' : 'overflow-auto'}`}>
      <div className={`w-full min-h-screen ${isHomePage ? 'px-0 py-0' : 'px-4 py-6'} relative`} style={{ zIndex: 1 }}>
        <div className={`${isHomePage ? 'w-full' : 'max-w-4xl mx-auto w-full'}`}>
          {/* Barra superior */}
          <div
            className={`flex justify-between items-center py-2 mb-2 ${isHomePage ? 'relative px-3 sm:px-6 pt-4 max-w-7xl mx-auto' : 'px-1'}`}
            style={{ zIndex: isHomePage ? 50 : 1 }}
          >
            {/* Info do usuário - clicável */}
            <div className="relative flex-1 min-w-0" ref={userMenuRef}>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="!px-2 sm:!px-3 !py-1.5 flex items-center gap-1.5 sm:gap-2 rounded-full cursor-pointer active:scale-95 bg-creme-50/95 border border-ferro-200 shadow-sm hover:border-ferro-400"
              >
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center bg-ferro-800 text-creme-200 font-display font-semibold text-sm flex-shrink-0">
                  {(user?.name || user?.email || '?')[0].toUpperCase()}
                </div>

                <span className="font-semibold truncate max-w-[90px] sm:max-w-[140px] text-sm text-ferro-900">
                  {user?.name || user?.email?.split('@')[0] || 'Usuário'}
                </span>

                <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-creme-200 text-ferro-800 border border-ferro-200">
                  {roleLabel(true)}
                </span>

                <span className="sm:hidden text-sm">{roleEmoji}</span>

                <svg
                  className={`w-4 h-4 text-ferro-500 transition-transform duration-200 flex-shrink-0 ${showUserMenu ? 'rotate-180' : ''}`}
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
                  className="absolute left-0 top-full mt-2 rounded-2xl shadow-bilhete py-4 px-4 w-[calc(100vw-2rem)] sm:w-auto sm:min-w-[290px] max-w-[320px] z-50 user-dropdown-menu border-2 border-ferro-800"
                  style={{ animation: 'fadeIn 0.2s ease-out', maxWidth: 'calc(100vw - 1rem)' }}
                >
                  <div className="flex items-center gap-3 pb-3 picote-horizontal !border-t-0 border-b-2 border-dashed border-ferro-200">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center bg-ferro-800 text-creme-200 font-display font-semibold text-lg flex-shrink-0">
                      {(user?.name || user?.email || '?')[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate text-ferro-900">
                        {user?.name || 'Usuário'}
                      </div>
                      <div className="text-xs text-ferro-600">{roleLabel(false)}</div>
                    </div>
                  </div>

                  <div className="pt-3">
                    <div className="flex items-center gap-2 mb-1 text-xs text-ferro-600 uppercase tracking-wider font-display">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      E-mail
                    </div>
                    <div className="break-all pl-5 text-sm font-medium text-ferro-900">
                      {user?.email || 'Não informado'}
                    </div>
                  </div>

                  <div className="pt-3 mt-3 border-t-2 border-dashed border-ferro-200">
                    <button
                      onClick={handleRefreshProfile}
                      disabled={isRefreshing}
                      className="w-full !px-3 !py-2 flex items-center justify-center gap-2 rounded-xl text-sm font-display tracking-wide uppercase bg-ferro-800 hover:bg-ferro-700 text-creme-200 active:scale-95 disabled:opacity-60"
                    >
                      <span className={isRefreshing ? 'animate-roda inline-block' : ''}>🔄</span>
                      {isRefreshing ? 'Atualizando...' : 'Atualizar permissões'}
                    </button>
                    <p className="text-center mt-2 text-xs text-ferro-500">
                      Use se seu acesso foi alterado por um administrador
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Botões */}
            <div className="flex gap-2 flex-shrink-0 ml-2">
              {!isHomePage && (
                <button
                  onClick={() => navigate({ to: '/' as any })}
                  className="!p-0 w-10 h-10 rounded-full flex items-center justify-center text-base bg-latao-400 hover:bg-latao-300 border-2 border-ferro-800 shadow-sm active:scale-95"
                  title="Início"
                  aria-label="Início"
                >
                  🏠
                </button>
              )}
              <button
                onClick={handleLogout}
                className="!py-0 h-10 !px-3 sm:!px-4 rounded-full flex items-center justify-center gap-1.5 text-sm font-display tracking-wide uppercase bg-vagao-600 hover:bg-vagao-700 text-creme-100 shadow-sm active:scale-95"
              >
                <span>🚪</span>
                <span className="hidden sm:inline">Sair</span>
              </button>
            </div>
          </div>

          {/* Header apenas em páginas internas, não na home */}
          {!isHomePage && (
            <Header subtitle="Encontrão EJD 25 Anos · Trilhos e Destinos" />
          )}

          {/* Navegação por Abas - apenas em páginas internas */}
          {!isHomePage && (
            <TabNavigation activeTab={getActiveTab()} onTabChange={handleTabChange} />
          )}

          {/* Botão de Voltar (apenas em páginas de produtos) */}
          {isInProductsPage && (
            <div className="flex justify-start mb-8 mt-4">
              <Button onClick={handleBackToContext} variant="outline" size="sm">
                {getBackButtonText()}
              </Button>
            </div>
          )}

          {/* Conteúdo das rotas */}
          <div className={isInProductsPage ? "mt-0" : "mt-6"}>
            {<Outlet />}
          </div>
        </div>
      </div>
    </div>
    </>
  )
}

export default AppLayout