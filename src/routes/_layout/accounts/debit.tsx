// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import DebitBalance from '../../../pages/accounts/DebitBalance'

export const Route = createFileRoute('/_layout/accounts/debit')({
  component: DebitBalance,
})
