import { useRouterState } from '@tanstack/react-router'

export function GlobalLoading() {
  const routerState = useRouterState()
  // Verificar se há loaders pendentes ou se está carregando
  const isLoading = routerState.isLoading || (routerState as any).isPending || false

  if (!isLoading) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white/90 backdrop-blur-md">
      <div className="relative z-10 flex flex-col items-center justify-center">
        {/* Spinner animado */}
        <div className="relative mb-8">
          <div className="w-20 h-20 border-4 border-golden-200 border-t-golden-500 rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div 
              className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" 
              style={{ animationDirection: 'reverse', animationDuration: '0.8s' }}
            ></div>
          </div>
        </div>
        
        {/* Texto de carregamento */}
        <div className="text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-golden-600 mb-2 font-cardinal animate-pulse">
            Carregando...
          </h2>
          <p className="text-lg text-emerald-600 font-farmhand">
            Aguarde um momento
          </p>
        </div>
        
        {/* Efeitos decorativos */}
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-golden-500/20 rounded-full blur-3xl animate-pulse"></div>
          <div 
            className="absolute bottom-1/4 right-1/4 w-40 h-40 bg-emerald-500/20 rounded-full blur-3xl animate-pulse" 
            style={{ animationDelay: '0.5s' }}
          ></div>
        </div>
      </div>
    </div>
  )
}

