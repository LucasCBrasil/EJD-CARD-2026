// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { ProtectedRoute } from '../../../components/auth/ProtectedRoute'
import { SalesHistoryPage } from '../../../pages/sales'

const ProtectedLojinhaHistory = () => (
  <ProtectedRoute requiredPermission="canViewSalesHistoryLojinha" fallbackPath="/lojinha">
    <SalesHistoryPage />
  </ProtectedRoute>
)

export const Route = createFileRoute('/_layout/historico/lojinha')({
  component: ProtectedLojinhaHistory,
})
