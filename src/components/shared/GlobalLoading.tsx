import { useRouterState } from '@tanstack/react-router'
import { TrainLoader } from './TrainLoader'

export function GlobalLoading() {
  const routerState = useRouterState()
  // Verificar se há loaders pendentes ou se está carregando
  const isLoading = routerState.isLoading || (routerState as any).isPending || false

  if (!isLoading) return null

  return <TrainLoader />
}
