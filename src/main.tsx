import { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { router } from './router'
import { queryClient } from './lib/query-client'
import { AuthProvider } from './contexts/AuthContext'
import { DataProvider } from './contexts/DataContext'
import { SupabaseDataProvider } from './contexts/SupabaseDataContext'
import { ToastProvider } from './contexts/ToastContext'
import { TrpcProvider } from './providers/TrpcProvider'
import { isSupabaseConfigured } from './lib/supabase'
import './index.css'
import './global.css'

// Componente simples - não atualizar contexto constantemente
function RouterUpdater() {
  // Atualizar contexto apenas uma vez na inicialização
  useEffect(() => {
    router.update({
      context: {
        queryClient,
        user: null,
        isLoading: false,
      },
    })
  }, [])

  return <RouterProvider router={router} />
}

function App() {
  // Escolher provider baseado na configuração do Supabase
  const DataProviderComponent = isSupabaseConfigured() ? SupabaseDataProvider : DataProvider

  return (
    <QueryClientProvider client={queryClient}>
      <TrpcProvider>
        <AuthProvider>
          <DataProviderComponent>
            <ToastProvider>
              <RouterUpdater />
            </ToastProvider>
          </DataProviderComponent>
        </AuthProvider>
      </TrpcProvider>
    </QueryClientProvider>
  )
}

// Renderizar a aplicação
const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Root element not found')

type ReactRootInstance = ReturnType<typeof ReactDOM.createRoot>
type RootHTMLElement = HTMLElement & { __appRoot?: ReactRootInstance }
const elementWithRoot = rootElement as RootHTMLElement
const cachedRoot = elementWithRoot.__appRoot
const root = cachedRoot ?? ReactDOM.createRoot(elementWithRoot)
elementWithRoot.__appRoot = root

root.render(<App />)
