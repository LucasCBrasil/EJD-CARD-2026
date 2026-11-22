import { createFileRoute } from '@tanstack/react-router'
import { AmbulantesControlPage } from '../../../pages/lanchonete'

export const Route = createFileRoute('/_layout/lanchonete/ambulantes')({
  component: AmbulantesControlPage,
})