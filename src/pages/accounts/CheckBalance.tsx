import { useState } from 'react'
import { Button } from '../../components/shared'
import { useSupabaseData } from '../../contexts/SupabaseDataContext'
import { UserAccount } from '../../types'

interface CheckBalancePageProps {
  onBack?: () => void
}

const CheckBalancePage: React.FC<CheckBalancePageProps> = ({ onBack: _onBack }) => {
  const { searchAccountsByName } = useSupabaseData()
  const [searchQuery, setSearchQuery] = useState('')
  const [results, setResults] = useState<UserAccount[]>([])
  const [account, setAccount] = useState<UserAccount | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSearch = async () => {
    setIsLoading(true)
    setError(null)
    setAccount(null)
    try {
      const matches = await searchAccountsByName(searchQuery.trim())
      setResults(matches)
      if (matches.length === 0) setError('Nenhuma conta encontrada')
      if (matches.length === 1) setAccount(matches[0])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar contas')
      setResults([])
    } finally {
      setIsLoading(false)
    }
  }

  const resetSearch = () => {
    setSearchQuery('')
    setResults([])
    setAccount(null)
    setError(null)
  }

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h1 className="text-2xl md:text-3xl font-semibold text-ferro-900 font-display uppercase tracking-wide">
          Conferir Saldo
        </h1>
        <p className="text-sm text-ferro-600 mt-1">Consulte o saldo de uma conta</p>
        <div className="trilho w-full max-w-xs mx-auto mt-3" />
      </div>

      <div className="painel p-5 md:p-6 space-y-4">
        {!account ? (
          <>
            <div>
              <label htmlFor="accountSearch" className="block text-sm font-semibold text-ferro-900 mb-2 text-center">
                Nome ou email do usuário
              </label>
              <input
                type="search"
                id="accountSearch"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && void handleSearch()}
                className="w-full px-4 py-4 border-2 border-ferro-200 rounded-xl bg-creme-50 text-ferro-900 focus:border-ferro-500 focus:ring-2 focus:ring-ferro-200"
                placeholder="Nome ou email"
              />
            </div>
            <Button onClick={() => void handleSearch()} size="lg" className="w-full" disabled={isLoading || searchQuery.trim().length < 2}>
              {isLoading ? 'Buscando...' : 'Consultar'}
            </Button>
            {results.length > 1 && (
              <div className="divide-y divide-ferro-100 rounded-xl border border-ferro-200">
                {results.map((result) => (
                  <button key={result.id} type="button" onClick={() => setAccount(result)}
                    className="flex w-full items-center justify-between gap-3 p-4 text-left hover:bg-creme-200">
                    <span><strong>{result.name || 'Sem nome'}</strong><span className="block text-sm text-ferro-600">{result.email}</span></span>
                    <span className="font-slab">R$ {(result.balance || 0).toFixed(2).replace('.', ',')}</span>
                  </button>
                ))}
              </div>
            )}
            {error && <p role="alert" className="text-center text-vagao-700">{error}</p>}
          </>
        ) : (
          <div className="bilhete overflow-hidden">
            <div className="bg-caldeira rounded-t-xl px-4 py-3 flex items-center justify-between">
              <span className="font-display text-xs tracking-[0.25em] uppercase text-creme-200">Conta</span>
              <span className="text-sm text-creme-200">{account.email}</span>
            </div>
            <div className="px-5 py-4 text-left">
              <p className="font-display text-[11px] tracking-[0.25em] uppercase text-ferro-500">Usuário</p>
              <p className="text-lg font-semibold text-ferro-900 leading-tight">{account.name || 'Sem nome'}</p>
              <div className="picote-horizontal mt-3 pt-3 text-center">
                <p className="font-display text-[11px] tracking-[0.25em] uppercase text-ferro-500 mb-1">Saldo Disponível</p>
                <p className={`font-slab text-4xl ${account.balance < 0 ? 'text-vagao-600' : 'text-ferro-900'}`}>
                  R$ {account.balance.toFixed(2).replace('.', ',')}
                </p>
              </div>
            </div>
            <Button onClick={resetSearch} size="lg" className="w-full">Nova Consulta</Button>
          </div>
        )}
      </div>
    </div>
  )
}

export default CheckBalancePage
