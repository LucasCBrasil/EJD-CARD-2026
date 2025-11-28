/**
 * tRPC Server Configuration
 * 
 * Este arquivo configura o servidor tRPC com:
 * - Context (auth, permissões, database)
 * - Middlewares de validação
 * - Error handling
 */

import { initTRPC, TRPCError } from '@trpc/server'
import superjson from 'superjson'
import { supabase } from '../lib/supabase'
import { type UserRole, hasPermission, type Permission } from './permissions'

/**
 * Context do tRPC - disponível em todos os procedures
 * Compatível com Express (dev) e Fetch API (Vercel)
 */
export async function createContext(opts: any) {
  // Extrair token do header Authorization
  // Suporta tanto Express req quanto Fetch Request
  let authHeader: string | null = null
  // ⚠️ NUNCA logar opts.req.headers - pode expor tokens e informações sensíveis

  if (opts.req.headers) {
    
    // Express: req.headers é um objeto
    if (typeof opts.req.headers.get === 'function') {
      // Fetch API (Vercel)
      authHeader = opts.req.headers.get('authorization')
    } else {
      // Express
      authHeader = opts.req.headers['authorization'] || opts.req.get?.('authorization') || null
    }
  }
  
  if (!authHeader?.startsWith('Bearer ')) {
    return {
      user: null,
      supabase,
    }
  }

  const token = authHeader.replace('Bearer ', '')

  // Validar token com Supabase Auth
  const { data: { user }, error } = await supabase.auth.getUser(token)

  if (error || !user) {
    return {
      user: null,
      supabase,
    }
  }

  // Retornar contexto com usuário autenticado
  return {
    user: {
      id: user.id,
      email: user.email,
      role: (user.user_metadata?.role || 'servico') as UserRole,
      metadata: user.user_metadata,
    },
    supabase,
  }
}

export type Context = Awaited<ReturnType<typeof createContext>>

/**
 * Inicializar tRPC com superjson para serialização avançada
 */
const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof Error ? error.cause.message : null,
      },
    }
  },
})

/**
 * Router e procedure builders
 */
export const router = t.router

/**
 * ⚠️ DEPRECATED - Não use mais publicProcedure
 * Todas as procedures devem ser protegidas para segurança
 */
export const publicProcedure = t.procedure

/**
 * Middleware: Verificar autenticação
 */
const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Você precisa estar autenticado para realizar esta ação',
    })
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user, // user agora é garantidamente não-null
    },
  })
})

/**
 * Middleware: Verificar permissões
 */
const hasPermissions = (permissions: Permission[]) => {
  return t.middleware(({ ctx, next }) => {
    if (!ctx.user) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Você precisa estar autenticado',
      })
    }

    const hasAllPermissions = permissions.every((permission) =>
      hasPermission(ctx.user.role, permission)
    )

    if (!hasAllPermissions) {
      // Log de segurança
      console.warn('SECURITY: Permission denied', {
        userId: ctx.user.id,
        role: ctx.user.role,
        attempted: permissions,
        timestamp: new Date().toISOString(),
      })

      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `Você não tem permissão para realizar esta ação. Necessário: ${permissions.join(', ')}`,
      })
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    })
  })
}

/**
 * Procedures protegidas
 */
export const protectedProcedure = publicProcedure.use(isAuthed)

/**
 * Procedure factory: criar procedure com permissões específicas
 */
export const createProtectedProcedure = (permissions: Permission[]) => {
  return protectedProcedure.use(hasPermissions(permissions))
}

