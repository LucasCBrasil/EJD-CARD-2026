// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import AddValue from '../../../pages/accounts/AddValue'

export const Route = createFileRoute('/_layout/accounts/add')({
  component: AddValue,
})
