import { createRootRoute, Outlet, useLocation, useNavigate } from '@tanstack/react-router'
import { useAuth } from '../contexts/AuthContext'
import { useEffect } from 'react'
import { TrainLoader } from '../components/shared/TrainLoader'

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
    return <TrainLoader message="Preparando o embarque" />
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

