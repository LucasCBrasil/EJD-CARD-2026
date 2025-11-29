// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import MonitoringPage from '../../pages/admin/MonitoringPage'

export const Route = createFileRoute('/_layout/acompanhar')({
  component: MonitoringPage,
})

