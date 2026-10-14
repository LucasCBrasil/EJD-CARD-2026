// @ts-nocheck
import { createFileRoute, redirect } from '@tanstack/react-router'
import { Login } from '../components/ui'
import type { RouterContext } from '../router'

export const Route = createFileRoute('/login')({
  beforeLoad: ({ context }: { context: RouterContext }) => {
    if (context.user) {
      throw redirect({ to: '/account' })
    }
  },
  component: Login,
})
