import { Outlet, useNavigate, useRouterState } from '@tanstack/react-router'
import { Header, Button } from '../shared'
import { GlobalLoading } from '../shared/GlobalLoading'
import { TabNavigation } from '../ui'
import { useAuth } from '../../contexts/AuthContext'

const AppLayout = () => {
  const navigate = useNavigate()
  const routerState = useRouterState()
  
  // Tentar usar useAuth, mas tratar erro caso não esteja disponível
  let user = null
  let logout = () => {}
  try {
    const auth = useAuth()
    user = auth.user
    logout = auth.logout
  } catch (error) {
    // AuthContext não disponível - isso não deveria acontecer, mas tratamos graciosamente
    console.warn('AuthContext não disponível no AppLayout')
  }

  const pathname = routerState.location.pathname
  const isHomePage = pathname === '/'
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

  return (
    <>
      {/* Loading global - aparece quando há loaders pendentes */}
      <GlobalLoading />
      
      <div className={`min-h-screen w-full relative ${isHomePage ? 'overflow-visible' : 'overflow-auto'}`} style={{ minHeight: '100vh' }}>
      {/* Imagem de fundo - Estrada Dourada e Cidade Esmeralda - TODAS as páginas */}
      <div 
        className="fixed inset-0"
        style={{
          backgroundImage: 'url(/background-emerald-city.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundAttachment: 'fixed',
          opacity: isHomePage ? 1 : 0.6,
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
        {!isHomePage && (
          <div className="absolute inset-0 bg-white/20 backdrop-blur-[2px] pointer-events-none"></div>
        )}
        {/* Overlay sutil para HomePage */}
        {isHomePage && (
          <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/10 pointer-events-none"></div>
        )}
      </div>
      
      <div className={`w-full min-h-screen ${isHomePage ? 'px-0 py-0' : 'px-4 py-8'} relative`} style={{ zIndex: 1 }}>
        <div className={`${isHomePage ? 'w-full' : 'max-w-4xl mx-auto w-full'}`}>
          {/* Header com informações do usuário e logout - sempre visível */}
          <div className={`flex justify-between items-center ${isHomePage ? 'px-4 pt-4 mb-0 relative' : 'mb-6'}`} style={{ zIndex: isHomePage ? 50 : 1 }}>
            <div className={`text-sm md:text-base ${isHomePage ? 'text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]' : 'text-gray-800'}`}>
              👋 Olá, <span className={`font-bold text-base md:text-lg ${isHomePage ? 'text-golden-300' : 'text-black'}`}>{user?.name || user?.email}</span>
              <span className={`ml-2 md:ml-3 px-2 md:px-3 py-1 md:py-1.5 rounded-full text-xs md:text-sm font-bold border ${
                isHomePage 
                  ? 'bg-emerald-500/30 text-emerald-200 border-emerald-400 backdrop-blur-md' 
                  : 'bg-emerald-200 text-emerald-900 border-emerald-400'
              }`}>
                {user?.role === 'admin' ? '👑 Admin' : 
                 user?.role === 'lojinha' ? '🏪 Lojinha' :
                 user?.role === 'lanchonete' ? '🍔 Lanchonete' :
                 user?.role === 'comunicacao' ? '📢 Comunicação' :
                 user?.role === 'servico' ? 'Serviço' :
                 '👤 Encontrista'}
              </span>
            </div>
            <div className="flex space-x-2">
              {!isHomePage && (
                <Button 
                  onClick={() => navigate({ to: '/' as any })}
                  variant="outline"
                  size="sm"
                  className="border-golden-500 text-golden-700 hover:bg-golden-500 hover:text-black font-semibold"
                >
                  🏠 Home
                </Button>
              )}
              <Button 
                onClick={handleLogout}
                variant="outline"
                size="sm"
                className={isHomePage 
                  ? "border-wizard-400 text-white backdrop-blur-md bg-wizard-500/20 hover:bg-wizard-500 hover:text-black" 
                  : "border-wizard-500 text-wizard-500 hover:bg-wizard-500 hover:text-black"}
              >
                🚪 Sair
              </Button>
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