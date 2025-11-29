import { createFileRoute } from '@tanstack/react-router'
import PixPage from '../../../pages/pix/PixPage'

export const Route = createFileRoute('/_layout/pix/$paymentId')({
  component: PixPage,
})

