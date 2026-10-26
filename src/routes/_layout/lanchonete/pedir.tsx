// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { SelfOrderPage } from '../../../pages/lanchonete'

export const Route = createFileRoute('/_layout/lanchonete/pedir')({
  component: SelfOrderPage,
})
