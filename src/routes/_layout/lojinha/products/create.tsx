// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { ProtectedRoute } from '../../../../components/auth/ProtectedRoute'
import { CreateProductPage } from '../../../../pages/products'

const ProtectedCreateLojinhaProduct = () => (
  <ProtectedRoute requiredPermission="canManageProductsLojinha" fallbackPath="/lojinha">
    <CreateProductPage />
  </ProtectedRoute>
)

export const Route = createFileRoute('/_layout/lojinha/products/create')({
  component: ProtectedCreateLojinhaProduct,
})

