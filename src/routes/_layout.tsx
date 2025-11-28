// @ts-nocheck
import { createFileRoute, redirect } from '@tanstack/react-router'
import AppLayout from '../components/layouts/AppLayout'
import { auth } from '../lib/auth-client'

export const Route = createFileRoute('/_layout')({
  beforeLoad: async () => {
    try {
      const { data: { session } } = await auth.getSession()

      if (!session) {
        throw redirect({ to: '/login' })
      }
    } catch (error) {
      // Se houver erro ao verificar sessão, redirecionar para login
      throw redirect({ to: '/login' })
    }
  },
  component: AppLayout,
})

