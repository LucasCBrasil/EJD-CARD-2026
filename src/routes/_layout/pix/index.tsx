import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_layout/pix/')({
  beforeLoad: () => {
    // Redirecionar /pix para /pix/new
    throw redirect({ to: '/pix/$paymentId', params: { paymentId: 'new' } })
  },
})

