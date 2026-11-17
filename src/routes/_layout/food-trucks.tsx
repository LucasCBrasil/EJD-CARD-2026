import { createFileRoute } from '@tanstack/react-router'
import FoodTrucksPage from '../../pages/foodtrucks/FoodTrucksPage'

export const Route = createFileRoute('/_layout/food-trucks')({
  validateSearch: (search: Record<string, unknown>): { truck?: string } => ({
    truck: typeof search.truck === 'string' ? search.truck : undefined,
  }),
  component: FoodTrucksPage,
})
