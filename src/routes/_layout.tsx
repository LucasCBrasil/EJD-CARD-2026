// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import AppLayout from '../components/layouts/AppLayout'

export const Route = createFileRoute('/_layout')({
  // ✅ Removido beforeLoad redundante - __root.tsx já verifica autenticação
  // O cache do Zustand store garante que não há chamadas desnecessárias
  component: AppLayout,
})

