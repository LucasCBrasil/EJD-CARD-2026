import React, { useEffect } from 'react'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { Button, TrilhosBackground } from '../shared'

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
      <div className="min-h-screen w-full relative flex items-center justify-center px-4 py-10">
        <TrilhosBackground />
        <div className="painel relative z-10 p-6 sm:p-10 max-w-lg w-full text-center text-ferro-900">
          <img src="/logos/web/trenzinho-marrom.webp" alt="" className="w-32 mx-auto mb-2 rotate-[-6deg]" />
          <div className="trilho w-40 mx-auto mb-6 rotate-[-3deg]" />
          <h1 className="text-3xl md:text-4xl font-display font-semibold uppercase tracking-wide text-ferro-900 mb-3">
            O trem saiu dos trilhos!
          </h1>
          <p className="text-lg text-ferro-700 mb-8 font-body">
            Ocorreu um erro inesperado. Por favor, tente novamente.
          </p>
          <Button
            onClick={() => navigate({ to: '/' })}
            variant="primary"
            size="lg"
            className="w-full sm:w-auto uppercase"
          >
            🚉 Voltar para a Estação
          </Button>
        </div>
      </div>
    )
  }

  // Determinar tipo de erro e mensagem
  let title = 'O trem saiu dos trilhos!'
  let message = 'Ocorreu um erro inesperado. Por favor, tente novamente.'
  let icon = '🚧'

  if (error instanceof Response) {
    if (error.status === 404) {
      title = 'Estação não encontrada'
      message = 'A página que você está procurando não existe ou mudou de linha.'
      icon = '🗺️'
    } else if (error.status === 403) {
      title = 'Acesso negado'
      message = 'Seu bilhete não dá acesso a esta plataforma.'
      icon = '🎫'
    } else if (error.status === 500) {
      title = 'Pane na casa de máquinas'
      message = 'Ocorreu um erro no servidor. Por favor, tente novamente mais tarde.'
      icon = '🔧'
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
      title = 'O trem saiu dos trilhos!'
      message = error.message || 'Ocorreu um erro inesperado.'
      icon = '🚧'
    }
  }

  return (
    <div className="min-h-screen w-full relative flex items-center justify-center px-4 py-10">
      <TrilhosBackground />

      {/* Conteúdo do erro */}
      <div className="painel relative z-10 p-6 sm:p-10 max-w-lg w-full text-center text-ferro-900">
        <div className="relative w-32 mx-auto mb-2">
          <img src="/logos/web/trenzinho-marrom.webp" alt="" className="w-32 rotate-[-6deg]" />
          <span className="absolute -top-2 -right-4 text-4xl">{icon}</span>
        </div>
        <div className="trilho w-40 mx-auto mb-6 rotate-[-3deg]" />
        
        <h1 className="text-3xl md:text-4xl font-display font-semibold uppercase tracking-wide text-ferro-900 mb-3">
          {title}
        </h1>
        
        <p className="text-lg text-ferro-700 mb-8 font-body break-words">
          {message}
        </p>

        {/* Detalhes do erro (apenas em desenvolvimento) */}
        {import.meta.env.DEV && error && (
          <details className="mb-6 text-left">
            <summary className="cursor-pointer text-sm text-ferro-600 hover:text-ferro-800 font-semibold mb-2">
              Detalhes técnicos (desenvolvimento)
            </summary>
            <pre className="bg-creme-200 border border-ferro-200 rounded-lg p-4 text-xs font-ticket overflow-auto max-h-48 text-ferro-800">
              {error instanceof Error 
                ? error.stack || error.message
                : JSON.stringify(error, null, 2)
              }
            </pre>
          </details>
        )}

        {/* Botões de ação */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
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
            className="uppercase"
          >
            🚉 Voltar para a Estação
          </Button>
          
          <Button
            onClick={() => window.location.reload()}
            variant="secondary"
            size="lg"
            className="uppercase"
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
              className="text-vagao-600 hover:text-vagao-700 font-semibold underline text-sm"
            >
              Ir para página de login →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

