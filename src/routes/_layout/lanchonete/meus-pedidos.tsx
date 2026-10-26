// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { MyLanchoneteOrdersPage } from '../../../pages/lanchonete'

export const Route = createFileRoute('/_layout/lanchonete/meus-pedidos')({
  component: MyLanchoneteOrdersPage,
})
