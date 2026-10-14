// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import CheckBalance from '../../../pages/accounts/CheckBalance'

export const Route = createFileRoute('/_layout/accounts/balance')({
  component: CheckBalance,
})
