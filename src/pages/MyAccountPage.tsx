import React, { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Button } from '../components/shared'
import { useAuth } from '../contexts/AuthContext'
import { useData } from '../contexts/DataContext'
import { isSupabaseConfigured } from '../lib/auth-client'
import { api } from '../lib/api-client'
import { UserAccount } from '../types'

type HistoryItem = {
  id: string
  date: string
  label: string
  amount: number
  type: 'lojinha' | 'lanchonete' | 'credit' | 'debit'
}

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

const iconFor = (type: HistoryItem['type']) =>
  type === 'lojinha' ? '🏪' : type === 'lanchonete' ? '🍔' : type === 'credit' ? '💰' : '💸'

const AccountContent: React.FC<{ account: UserAccount; history: HistoryItem[]; pixEnabled: boolean }> = ({
  account,
  history,
  pixEnabled,
}) => {
  const navigate = useNavigate()
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl md:text-3xl font-semibold text-ferro-900 font-display uppercase tracking-wide">
          Minha Conta
        </h2>
        <div className="trilho w-full max-w-xs mx-auto mt-3" />
      </div>

      <div className="bilhete overflow-hidden mx-auto max-w-2xl">
        <div className="flex flex-col md:flex-row">
          <div className="bg-caldeira rounded-t-xl md:rounded-tr-none md:rounded-l-xl px-5 py-4 md:w-48 shrink-0 flex md:flex-col items-center md:items-start justify-between gap-2">
            <div>
              <p className="font-display text-[11px] tracking-[0.3em] uppercase text-creme-200/70">Encontrão EJD</p>
              <p className="font-display text-lg font-semibold uppercase tracking-wide text-creme-200 leading-tight">Minha Conta</p>
            </div>
            <span className="text-sm text-creme-200">{account.email}</span>
          </div>
          <div className="flex-1 px-5 py-5 border-t-2 md:border-t-0 md:border-l-2 border-dashed border-ferro-800/30">
            <p className="font-display text-[11px] tracking-[0.3em] uppercase text-ferro-500">Usuário</p>
            <p className="text-xl font-semibold text-ferro-900 leading-tight break-words">{account.name || account.email}</p>
            <div className="picote-horizontal mt-4 pt-4 flex items-end justify-between gap-3">
              <div>
                <p className="font-display text-[11px] tracking-[0.3em] uppercase text-ferro-500">Saldo Disponível</p>
                <p className={`font-slab text-3xl md:text-4xl leading-tight ${account.balance < 0 ? 'text-vagao-600' : 'text-ferro-900'}`}>
                  R$ {account.balance.toFixed(2).replace('.', ',')}
                </p>
              </div>
              <span className="carimbo text-green-700 text-xs shrink-0">Conta ativa</span>
            </div>
          </div>
        </div>
      </div>

      {pixEnabled && (
        <div className="painel p-5 md:p-6 text-center">
          <h3 className="text-xl font-semibold text-ferro-900 mb-2 font-display uppercase tracking-wide">Adicionar saldo via PIX</h3>
          <p className="text-ferro-600 mb-5">Adicione créditos diretamente à sua conta.</p>
          <Button
            onClick={() => navigate({ to: '/pix/$paymentId', params: { paymentId: 'new' } })}
            size="lg"
            className="w-full sm:w-auto !bg-vagao-600 hover:!bg-vagao-700 !border-vagao-600 !text-creme-50"
          >
            Gerar PIX para adicionar saldo
          </Button>
        </div>
      )}

      <div className="painel p-5 md:p-8">
        <h3 className="text-xl font-semibold text-ferro-900 mb-5 text-center font-display uppercase tracking-wide">
          Histórico da Conta
        </h3>
        {history.length ? (
          <div className="space-y-3">
            {history.map((item) => (
              <div key={item.id} className="flex items-stretch overflow-hidden rounded-xl bg-creme-100 border border-ferro-200">
                <div className={`${item.type === 'debit' ? 'bg-vagao-600' : 'bg-ferro-600'} w-1.5 shrink-0`} />
                <div className="flex flex-1 items-start justify-between gap-3 px-4 py-3 min-w-0">
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="text-2xl leading-none mt-0.5">{iconFor(item.type)}</span>
                    <div className="min-w-0">
                      <h4 className="font-semibold text-ferro-900 font-body leading-snug break-words">{item.label}</h4>
                      <p className="text-xs text-ferro-600 mt-0.5">{formatDateTime(item.date)}</p>
                    </div>
                  </div>
                  <p className="font-slab text-base text-ferro-900 shrink-0 whitespace-nowrap">
                    {item.type === 'credit' ? '+' : item.type === 'debit' ? '−' : ''}
                    {' '}R$ {item.amount.toFixed(2).replace('.', ',')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="text-4xl mb-3">🛤️</div>
            <p className="text-ferro-600">Nenhuma movimentação realizada ainda</p>
          </div>
        )}
      </div>
    </div>
  )
}

const LocalAccountPage: React.FC<{ user: { id?: string; email?: string | null; name?: string | null; role?: string } | null }> = ({ user }) => {
  const localData = useData()
  const account: UserAccount = {
    id: user?.id || '',
    email: user?.email || '',
    name: user?.name || '',
    role: user?.role || 'encontrista',
    balance: localData.getBalance(user?.id || ''),
    createdAt: '',
  }
  return <AccountContent account={account} history={[]} pixEnabled={false} />
}

const AccountPage: React.FC = () => {
  const { user } = useAuth()
  const [account, setAccount] = useState<UserAccount | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [pixEnabled, setPixEnabled] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!isSupabaseConfigured() || !user?.id) {
      setIsLoading(false)
      return
    }

    const loadAccount = async () => {
      try {
        const response = await api.getMyAccountHistory()
        if (!response.success) throw new Error(response.error || 'Erro ao carregar histórico da conta')
        if (!response.data.account) throw new Error('Não foi possível encontrar sua conta')
        if (cancelled) return

        const accountData = response.data.account
        setAccount({
          id: accountData.user_id || accountData.id || user.id,
          email: accountData.email || user.email || '',
          name: accountData.name || accountData.user_name || user.name || '',
          role: accountData.role || user.role || 'encontrista',
          balance: Number(accountData.balance) || 0,
          createdAt: accountData.created_at || '',
        })

        const saleHistory: HistoryItem[] = (response.data.sales || []).map((sale: any) => ({
          id: sale.id,
          date: sale.created_at || sale.createdAt,
          label: ((sale.sale_items || []).map((item: any) => item.product_name).filter(Boolean).join(', ') || 'Compra')
            + (sale.status === 'cancelled' ? ' (cancelado e estornado)' : ''),
          amount: Number(sale.total) || 0,
          type: sale.category || 'lojinha',
        }))
        const transactions: HistoryItem[] = (response.data.transactions || []).map((transaction: any) => ({
          id: transaction.id,
          date: transaction.created_at || transaction.createdAt,
          label: transaction.description || (transaction.type === 'credit' ? 'Crédito' : 'Débito'),
          amount: Math.abs(Number(transaction.amount) || 0),
          type: transaction.type === 'credit' ? 'credit' : 'debit',
        }))
        setHistory([...saleHistory, ...transactions].filter((item) => item.date).sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
        ).slice(0, 30))

        const flag = await api.getFeatureFlag('pix_enabled')
        if (!cancelled) setPixEnabled(flag.success && flag.data?.enabled === true)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Erro ao carregar sua conta')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    void loadAccount()
    return () => { cancelled = true }
  }, [user?.id, user?.email, user?.name, user?.role])

  if (!isSupabaseConfigured()) {
    return <LocalAccountPage user={user} />
  }

  if (isLoading) return <div className="painel py-10 text-center text-ferro-600">Carregando sua conta...</div>
  if (error) return <div role="alert" className="painel py-10 text-center text-vagao-700">{error}</div>
  if (!account) return <div className="painel py-10 text-center text-ferro-600">Conta não encontrada.</div>
  return <AccountContent account={account} history={history} pixEnabled={pixEnabled} />
}

export default AccountPage
