import React, { useEffect } from 'react'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { Button } from '../shared'

interface ErrorPageProps {
  error?: any
}

export function ErrorPage(props?: ErrorPageProps) {
  const navigate = useNavigate()
  const routerState = useRouterState()
  
  // Tentar obter o erro das props ou do estado do router
  const error = props?.error || (routerState as any)?.error || null

  // Se for um redirect (objeto com status 307), redirecionar automaticamente
  useEffect(() => {
    if (error && typeof error === 'object' && 'status' in error && (error as any).status === 307) {
      // É um redirect, redirecionar para login
      navigate({ to: '/login' })
      return
    }
  }, [error, navigate])

  // Se não houver erro, mostrar mensagem genérica
  if (!error) {
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
        <div className="relative z-10 bg-white/90 backdrop-blur-md rounded-2xl shadow-2xl border-2 border-latao-200 p-8 md:p-12 max-w-lg mx-4 text-center">
          <div className="text-6xl mb-6 animate-bounce">⚠️</div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4 font-display">
            Ops! Algo deu errado
          </h1>
          <p className="text-lg text-gray-700 mb-8 font-body">
            Ocorreu um erro inesperado. Por favor, tente novamente.
          </p>
          <Button
            onClick={() => navigate({ to: '/' })}
            variant="primary"
            size="lg"
            className="bg-gradient-to-r from-ferro-500 to-ferro-600 hover:from-ferro-600 hover:to-ferro-700 text-white shadow-lg hover:shadow-ferro-200 font-semibold"
          >
            🏠 Voltar para Home
          </Button>
        </div>
      </div>
    )
  }

  // Determinar tipo de erro e mensagem
  let title = 'Ops! Algo deu errado'
  let message = 'Ocorreu um erro inesperado. Por favor, tente novamente.'
  let icon = '⚠️'

  if (error instanceof Response) {
    if (error.status === 404) {
      title = 'Página não encontrada'
      message = 'A página que você está procurando não existe ou foi movida.'
      icon = '🔍'
    } else if (error.status === 403) {
      title = 'Acesso negado'
      message = 'Você não tem permissão para acessar esta página.'
      icon = '🔒'
    } else if (error.status === 500) {
      title = 'Erro no servidor'
      message = 'Ocorreu um erro no servidor. Por favor, tente novamente mais tarde.'
      icon = '💥'
    } else {
      title = `Erro ${error.status}`
      message = 'Ocorreu um erro ao carregar esta página.'
      icon = '❌'
    }
  } else if (error instanceof Error) {
    if (error.message.includes('useAuth must be used within an AuthProvider')) {
      title = 'Erro de autenticação'
      message = 'Houve um problema ao verificar sua autenticação. Por favor, faça login novamente.'
      icon = '🔐'
    } else {
      title = 'Erro na aplicação'
      message = error.message || 'Ocorreu um erro inesperado.'
      icon = '⚠️'
    }
  }

  return (
    <div className="min-h-screen w-full relative flex items-center justify-center">
      {/* Imagem de fundo */}
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

      {/* Conteúdo do erro */}
      <div className="relative z-10 bg-white/90 backdrop-blur-md rounded-2xl shadow-2xl border-2 border-latao-200 p-8 md:p-12 max-w-lg mx-4 text-center">
        <div className="text-6xl mb-6 animate-bounce">{icon}</div>
        
        <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4 font-display">
          {title}
        </h1>
        
        <p className="text-lg text-gray-700 mb-8 font-body">
          {message}
        </p>

        {/* Detalhes do erro (apenas em desenvolvimento) */}
        {import.meta.env.DEV && error && (
          <details className="mb-6 text-left">
            <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800 font-semibold mb-2">
              Detalhes técnicos (desenvolvimento)
            </summary>
            <pre className="bg-gray-100 rounded-lg p-4 text-xs overflow-auto max-h-48 text-gray-800">
              {error instanceof Error 
                ? error.stack || error.message
                : JSON.stringify(error, null, 2)
              }
            </pre>
          </details>
        )}

        {/* Botões de ação */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            onClick={() => {
              try {
                navigate({ to: '/' })
              } catch {
                window.location.href = '/'
              }
            }}
            variant="primary"
            size="lg"
            className="bg-gradient-to-r from-ferro-500 to-ferro-600 hover:from-ferro-600 hover:to-ferro-700 text-white shadow-lg hover:shadow-ferro-200 font-semibold"
          >
            🏠 Voltar para Home
          </Button>
          
          <Button
            onClick={() => window.location.reload()}
            variant="secondary"
            size="lg"
            className="bg-gradient-to-r from-gray-200 to-gray-300 hover:from-gray-300 hover:to-gray-400 text-gray-800 shadow-lg font-semibold"
          >
            🔄 Recarregar Página
          </Button>
        </div>

        {/* Link para login se for erro de autenticação */}
        {(error instanceof Error && error.message.includes('AuthProvider')) && (
          <div className="mt-6">
            <button
              onClick={() => {
                try {
                  navigate({ to: '/login' })
                } catch {
                  window.location.href = '/login'
                }
              }}
              className="text-ferro-600 hover:text-ferro-800 font-semibold underline text-sm"
            >
              Ir para página de login →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

