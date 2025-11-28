/**
 * Vercel Serverless Function - tRPC Handler
 * 
 * Este é o endpoint que a Vercel vai deployar.
 * Rota: /api/trpc/*
 */

import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { appRouter } from '../../src/server/routers/_app'
import { createContext } from '../../src/server/trpc'

// CORS restrito
const getAllowedOrigins = () => {
  const allowed = process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:3000'
  return allowed.split(',').map(o => o.trim())
}

const validateOrigin = (origin: string | null): boolean => {
  if (!origin) return false
  const allowedOrigins = getAllowedOrigins()
  return allowedOrigins.includes(origin)
}

/**
 * Handler para requisições tRPC
 * A Vercel automaticamente roteia /api/trpc/* para esta função
 */
export default async function handler(request: Request) {
  // Validar origem
  const origin = request.headers.get('origin')
  if (request.method !== 'OPTIONS' && origin && !validateOrigin(origin)) {
    return new Response(
      JSON.stringify({ error: 'Origin not allowed' }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }

  return fetchRequestHandler({
    endpoint: '/api/trpc',
    req: request,
    router: appRouter,
    createContext,
    onError({ error, path }) {
      // Ofuscar erro para não expor estrutura
      console.error(`tRPC Error:`, error.message)
      // Não logar path completo para não expor estrutura da API
    },
  })
}

/**
 * Configuração da Vercel Edge Runtime (opcional - mais rápido)
 * Pode usar Node.js runtime também, removendo esta linha
 */
export const config = {
  runtime: 'edge',
}

