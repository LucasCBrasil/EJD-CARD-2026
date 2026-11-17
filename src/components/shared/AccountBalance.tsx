import { useNavigate } from '@tanstack/react-router'
import { useAuth } from '../../contexts/AuthContext'
import { useAccountByUserId } from '../../hooks/useAccounts'

export default function AccountBalance() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { data, isPending, isError, refetch, isFetching } = useAccountByUserId(user?.id || '')
  if (!user) return null
  const balance = data?.balance
  return (
    <div className="sticky top-2 z-40 mx-auto my-3 flex max-w-4xl flex-wrap items-center justify-between gap-2 rounded-2xl border border-ferro-200 bg-creme-50 px-4 py-3 shadow-bilhete">
      <div role="status" aria-live="polite">
        <span className="block text-xs uppercase tracking-wide text-ferro-600">Saldo disponível</span>
        <strong className="font-slab text-xl text-ferro-900">
          {isError ? 'Saldo indisponível' : isPending ? 'Carregando…' : balance == null ? 'Conta não encontrada' : Number(balance).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        </strong>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => void refetch()} disabled={isFetching} aria-label="Atualizar saldo" className="!px-3 !py-2 rounded-xl border border-ferro-200 text-ferro-800 disabled:opacity-50">↻</button>
        <button type="button" onClick={() => navigate({ to: '/pix/$paymentId', params: { paymentId: 'new' } })} className="!px-3 !py-2 rounded-xl bg-latao-400 font-display uppercase text-ferro-900">Recarregar saldo</button>
      </div>
    </div>
  )
}
