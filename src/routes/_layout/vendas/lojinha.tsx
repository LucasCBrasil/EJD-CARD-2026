// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { ProtectedRoute } from '../../../components/auth/ProtectedRoute'
import { SalesPage } from '../../../pages/sales'

const ProtectedVendasLojinha = () => (
  <ProtectedRoute requiredPermission="canSellLojinha" fallbackPath="/lojinha">
    <SalesPage />
  </ProtectedRoute>
)

export const Route = createFileRoute('/_layout/vendas/lojinha')({
  component: ProtectedVendasLojinha,
})
