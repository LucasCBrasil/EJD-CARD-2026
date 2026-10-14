// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import MyAccountPage from '../../pages/MyAccountPage'

export const Route = createFileRoute('/_layout/account')({
  component: MyAccountPage,
})
