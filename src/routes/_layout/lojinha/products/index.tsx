// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { ProtectedRoute } from '../../../../components/auth/ProtectedRoute'
import { ListProductsPage } from '../../../../pages/products'

const ProtectedLojinhaProducts = () => (
  <ProtectedRoute requiredPermission="canManageProductsLojinha" fallbackPath="/lojinha">
    <ListProductsPage />
  </ProtectedRoute>
)

export const Route = createFileRoute('/_layout/lojinha/products/')({
  component: ProtectedLojinhaProducts,
})

