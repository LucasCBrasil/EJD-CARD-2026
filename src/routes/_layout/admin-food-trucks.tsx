import { createFileRoute } from '@tanstack/react-router'
import FoodTrucksAdminPage from '../../pages/admin/FoodTrucksAdminPage'

export const Route = createFileRoute('/_layout/admin-food-trucks')({
  component: FoodTrucksAdminPage,
})
