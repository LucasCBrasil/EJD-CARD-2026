// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { ProtectedRoute } from '../../components/auth/ProtectedRoute'
import { LojinhaOrdersPage } from '../../pages/lojinha'

const ProtectedLojinhaOrders = () => (
  <ProtectedRoute requiredPermission="canViewOpenOrders" fallbackPath="/lojinha">
    <LojinhaOrdersPage />
  </ProtectedRoute>
)

export const Route = createFileRoute('/_layout/pedidos-lojinha')({
  component: ProtectedLojinhaOrders,
})
