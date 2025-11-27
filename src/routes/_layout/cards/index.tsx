// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import CardsPage from '../../../pages/cards/CardsPage'
import { cardKeys } from '../../../hooks/useCards'
import { api } from '../../../lib/api-client'
import type { RouterContext } from '../../../router'

export const Route = createFileRoute('/_layout/cards/')({
  component: CardsPage,
  loader: async ({ context }: { context: RouterContext }) => {
    await context.queryClient.ensureQueryData({
      queryKey: cardKeys.lists(),
      queryFn: async () => {
        const response = await api.listCards()
        if (!response.success) {
          throw new Error(response.error || 'Erro ao buscar cartões')
        }
        return Array.isArray(response.data) ? response.data : [response.data].filter(Boolean)
      },
    })
  },
})
