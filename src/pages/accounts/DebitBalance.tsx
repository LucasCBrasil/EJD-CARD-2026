import React, { useState } from 'react'
import { Button, Header, ConfirmationModal } from '../../components/shared'
import { useToastContext } from '../../contexts/ToastContext'
import { useSupabaseData } from '../../contexts/SupabaseDataContext'
import { UserAccount } from '../../types'

interface DebitBalanceProps {
  onBack?: () => void
}

const DebitBalance: React.FC<DebitBalanceProps> = ({ onBack: _onBack }) => {
  const { searchAccountsByName, updateUserBalance } = useSupabaseData()
  const [selectedAccount, setSelectedAccount] = useState<UserAccount | null>(null)
  const [amount, setAmount] = useState('')
  const [formattedAmount, setFormattedAmount] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<UserAccount[]>([])
  const [description, setDescription] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { showSuccess, showError } = useToastContext()

  const formatCurrency = (value: string) => {
    // Remove tudo que não é número
    const numbers = value.replace(/\D/g, '')
    
    if (numbers === '') {
      return ''
    }
    
    // Converte para centavos e depois para reais
    const cents = parseInt(numbers)
    const reais = cents / 100
    
    // Formata com vírgula decimal
    return reais.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
  }

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    const formatted = formatCurrency(value)
    setFormattedAmount(formatted)
    
    // Remove tudo que não é número e converte para centavos
    const numbers = value.replace(/\D/g, '')
    if (numbers === '') {
      setAmount('0')
    } else {
      const cents = parseInt(numbers)
      setAmount((cents / 100).toString())
    }
  }

  const handleSearchChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchQuery(value)
    setError(null)
    setSelectedAccount(null)
    
    if (value.trim().length >= 2) {
      try {
        const results = await searchAccountsByName(value.trim())
        setSearchResults(results)
        if (results.length === 0) setError('Nenhuma conta encontrada')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao buscar contas')
      }
    } else {
      setSearchResults([])
    }
  }

  const handleSelectAccount = (account: UserAccount) => {
    setSelectedAccount(account)
    setSearchQuery(account.name || account.email)
    setSearchResults([])
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedAccount) return

    const debitAmount = parseFloat(amount)
    if (debitAmount > (selectedAccount.balance || 0)) {
      setError('Saldo insuficiente!')
      return
    }

    // Mostrar janela de confirmação
    setShowConfirmation(true)
  }

  const handleConfirmDebit = async () => {
    if (!selectedAccount) return

    const debitAmount = parseFloat(amount)
    if (debitAmount > (selectedAccount.balance || 0)) {
      showError(
        'Saldo Insuficiente!',
        'O valor do débito é maior que o saldo disponível na conta.'
      )
      return
    }

    setIsLoading(true)
    setShowConfirmation(false)
    
    try {
      await updateUserBalance(selectedAccount.id, debitAmount, 'debit', description || 'Débito manual')
      
      showSuccess(
        'Débito Realizado!',
        `R$ ${formattedAmount} foi debitado da conta de ${selectedAccount.name || selectedAccount.email} com sucesso.`
      )
      
      setAmount('')
      setFormattedAmount('')
      setSearchQuery('')
      setDescription('')
      setSelectedAccount(null)
    } catch (err: any) {
      setError(err?.message || 'Erro ao realizar débito')
      showError('Erro ao Debitar', err?.message || 'Não foi possível realizar o débito')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancelConfirmation = () => {
    setShowConfirmation(false)
  }

  const inputClass = 'w-full px-4 py-3 border-2 border-ferro-200 rounded-xl bg-creme-50 text-ferro-900 focus:border-ferro-500 focus:ring-2 focus:ring-ferro-200 transition-colors duration-200'
  const insufficient = !!selectedAccount && parseFloat(amount || '0') > (selectedAccount.balance || 0)

  return (
    <div className="space-y-4">
      <Header 
            title="Débito de Saldo"
            subtitle="Debite um valor diretamente da conta do encontrista"
            showLogo={false}
        />
    <div className="w-full relative z-10">
        <div className="mx-auto w-full">

          {/* Formulário */}
          <div className="painel p-5 md:p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Busca por usuário */}
              <div>
                <label htmlFor="accountSearch" className="block text-sm font-semibold text-ferro-900 mb-2">
                  Buscar usuário por nome ou email
                </label>
                <input
                  type="text"
                  id="accountSearch"
                  value={searchQuery}
                  onChange={handleSearchChange}
                  required
                  className={inputClass}
                  placeholder="Nome ou email do usuário"
                />
                {searchResults.length > 0 && (
                  <div className="mt-2 rounded-xl border border-ferro-200 bg-creme-50 shadow-bilhete">
                    {searchResults.map((account) => (
                      <button key={account.id} type="button" onClick={() => handleSelectAccount(account)}
                        className="flex w-full justify-between gap-3 border-b border-ferro-100 px-4 py-3 text-left last:border-0 hover:bg-creme-200">
                        <span><strong>{account.name || 'Sem nome'}</strong><span className="block text-sm text-ferro-600">{account.email}</span></span>
                        <span>R$ {(account.balance || 0).toFixed(2).replace('.', ',')}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {error && (
                <div className="bg-vagao-50 border-2 border-vagao-300 rounded-xl p-3 text-center">
                  <p className="text-vagao-800 font-semibold text-sm">⚠️ {error}</p>
                </div>
              )}

              {/* Valor do débito */}
              <div>
                <label htmlFor="amount" className="block text-sm font-semibold text-ferro-900 mb-2">
                  💸 Valor do Débito (R$)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  id="amount"
                  value={formattedAmount}
                  onChange={handleAmountChange}
                  required
                  className={`${inputClass} font-slab text-xl`}
                  placeholder="0,00"
                />
              </div>

              {/* Descrição */}
              <div>
                <label htmlFor="description" className="block text-sm font-semibold text-ferro-900 mb-2">
                  📝 Descrição (Opcional)
                </label>
                <input
                  type="text"
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className={inputClass}
                  placeholder="Ex: Compra no supermercado"
                />
              </div>

              {/* Informações da conta selecionada */}
              {selectedAccount && (
                <div className="bg-creme-200 border border-ferro-200 rounded-xl p-4 space-y-2 animate-fade-in">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="font-display text-sm uppercase tracking-wider text-ferro-700">Conta selecionada</h4>
                    <span className="text-sm text-ferro-600">{selectedAccount.email}</span>
                  </div>
                  <p className="text-ferro-900 font-semibold">{selectedAccount.name || 'Sem nome'}</p>
                  <div className="picote-horizontal pt-2 flex justify-between items-baseline">
                    <span className="text-sm text-ferro-600">Saldo atual</span>
                    <span className="font-slab text-ferro-900">R$ {(selectedAccount.balance || 0).toFixed(2).replace('.', ',')}</span>
                  </div>
                  {amount && (
                    <>
                      <div className="flex justify-between items-baseline">
                        <span className="text-sm text-ferro-600">Valor do débito</span>
                        <span className="font-slab text-vagao-600">− R$ {parseFloat(amount || '0').toFixed(2).replace('.', ',')}</span>
                      </div>
                      <div className="flex justify-between items-baseline">
                        <span className="text-sm text-ferro-600">Novo saldo</span>
                        <span className={`font-slab text-lg ${insufficient ? 'text-vagao-600' : 'text-ferro-900'}`}>
                          R$ {((selectedAccount.balance || 0) - parseFloat(amount || '0')).toFixed(2).replace('.', ',')}
                        </span>
                      </div>
                      {insufficient && (
                        <p className="carimbo text-vagao-600 text-xs mt-1">
                          ⚠️ Saldo insuficiente
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Botão de Debitar */}
              <Button
                type="submit"
                size="lg"
                className="w-full !bg-vagao-600 hover:!bg-vagao-700 !border-vagao-600 !text-creme-50"
                disabled={isLoading || !selectedAccount || (amount ? parseFloat(amount) > selectedAccount.balance : false)}
              >
                {isLoading ? (
                  <>
                    <span className="inline-block animate-spin mr-2">⚙️</span>
                    Processando débito...
                  </>
                ) : (
                  <>
                    💸 Debitar Valor
                  </>
                )}
              </Button>
            </form>
          </div>
        </div>
      </div>

      {/* Modal de Confirmação */}
      <ConfirmationModal
        isOpen={showConfirmation}
        onClose={handleCancelConfirmation}
        onConfirm={handleConfirmDebit}
        title="Confirmar Débito"
        message="Deseja realmente debitar o valor da conta?"
        icon="💸"
        account={selectedAccount}
        transactionType="debit"
        amount={amount}
        formattedAmount={formattedAmount}
        description={description}
        isLoading={isLoading}
      />
    </div>
  )
}

export default DebitBalance
