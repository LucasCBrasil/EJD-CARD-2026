// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import DebitCardsPage from '../../pages/admin/DebitCardsPage'

export const Route = createFileRoute('/_layout/admin-debitos')({
  component: DebitCardsPage,
})

