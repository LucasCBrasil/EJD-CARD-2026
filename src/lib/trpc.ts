/**
 * ⚠️ DEPRECATED - Não use mais tRPC diretamente
 * 
 * Para evitar exposição da estrutura da API no bundle, use api-client.ts
 * Este arquivo mantém compatibilidade temporária mas será removido.
 * 
 * Em produção, tipos não são mais expostos para proteger a estrutura da API.
 */

// Apenas importar tipos em desenvolvimento para type-checking
// Em produção, não importa AppRouter para não expor no bundle
// ⚠️ REMOVIDO: require não funciona em ESM - tipos agora são any para evitar exposição
let AppRouterType: any = null
// Não importar AppRouter para não expor no bundle
// Se precisar de tipos, usar type-only imports ou definir manualmente

import { createTRPCReact } from '@trpc/react-query'
import { httpBatchLink } from '@trpc/client'
import { auth } from './auth-client'
import superjson from 'superjson'

/**
 * Cliente tRPC - apenas para desenvolvimento
 * Em produção, use api-client.ts para ocultar estrutura
 */
export const trpc = createTRPCReact<any>()

/**
 * Função para obter token de autenticação
 */
async function getAuthToken(): Promise<string | null> {
  const { data: { session } } = await auth.getSession()
  return session?.access_token || null
}

/**
 * Configuração do cliente tRPC
 * ⚠️ DEPRECATED - Use api-client.ts em vez disso
 */
export function getTrpcClient() {
  // Em desenvolvimento, usar servidor Express local
  // Em produção, usar Vercel Functions
  const url = import.meta.env.DEV 
    ? 'http://localhost:3001/api/trpc'
    : '/api/trpc'

  return (trpc as any).createClient({
    links: [
      httpBatchLink({
        url,
        transformer: superjson,
        
        // Adicionar token de auth em cada requisição
        async headers() {
          const token = await getAuthToken()
          return {
            authorization: token ? `Bearer ${token}` : '',
          }
        },
      }),
    ],
  })
}

