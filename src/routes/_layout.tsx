// @ts-nocheck
import { createFileRoute, redirect } from '@tanstack/react-router'
import AppLayout from '../components/layouts/AppLayout'
import { supabase } from '../lib/supabase'

export const Route = createFileRoute('/_layout')({
  beforeLoad: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      throw redirect({ to: '/login' })
    }
  },
  component: AppLayout,
})

