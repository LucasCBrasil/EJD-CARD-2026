import { createRootRoute, Outlet, useLocation, useNavigate } from '@tanstack/react-router'
import { useAuth } from '../contexts/AuthContext'
import { useEffect } from 'react'

// Componente que decide o Layout a ser usado
function RootLayout() {
  const { user, isLoading } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  // Redirecionar para login se não estiver logado (exceto se já estiver na página de login)
  useEffect(() => {
    if (!isLoading && !user && !location.pathname.startsWith('/login')) {
      navigate({ to: '/login' })
    }
  }, [isLoading, user, location.pathname, navigate])

  // 1. Loading - tela de carregamento com background
  if (isLoading) {
    return (
      <div className="min-h-screen w-full relative flex items-center justify-center">
        <div 
          className="fixed inset-0 z-0"
          style={{
            backgroundImage: 'url(/background-emerald-city.png)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            backgroundAttachment: 'fixed'
          }}
        >
          <div className="absolute inset-0 bg-white/40 backdrop-blur-sm"></div>
        </div>
        <div className="relative z-10 bg-white/90 backdrop-blur-md rounded-2xl shadow-2xl border-2 border-golden-200 p-8 md:p-12 max-w-md mx-4 text-center">
          <div className="text-6xl mb-6 animate-pulse">✨</div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 mb-4 font-cardinal">
            Carregando...
          </h1>
          <p className="text-lg text-gray-700 font-farmhand">
            Aguarde um momento
          </p>
        </div>
      </div>
    )
  }

  // 2. Se não estiver logado, não renderizar nada (o useEffect vai redirecionar)
  if (!user && !location.pathname.startsWith('/login')) {
    return null
  }
  
  return <Outlet />
}


export const Route = createRootRoute({
  component: () => (
    <RootLayout />
  ),
})

