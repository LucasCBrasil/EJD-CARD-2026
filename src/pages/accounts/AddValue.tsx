import React, { useState, useRef, useEffect } from 'react'
import { Button, Header, ConfirmationModal } from '../../components/shared'
import { useToastContext } from '../../contexts/ToastContext'
import { useSupabaseData } from '../../contexts/SupabaseDataContext'
import { UserAccount } from '../../types'

interface AddBalanceProps {
  onBack?: () => void
}

const AddBalancePage: React.FC<AddBalanceProps> = ({ onBack: _onBack }) => {
  const { searchAccountsByName, updateUserBalance } = useSupabaseData()
  const [selectedAccount, setSelectedAccount] = useState<UserAccount | null>(null)
  const [amount, setAmount] = useState('')
  const [formattedAmount, setFormattedAmount] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { showSuccess } = useToastContext()

  // Estados para busca unificada
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<UserAccount[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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

  // Busca por nome ou email da conta.
  const handleSearchChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchQuery(value)
    setError(null)
    setSelectedAccount(null)
    setShowDropdown(false)

    // Limpar timeout anterior
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    const trimmedValue = value.trim()
    if (trimmedValue.length < 2) {
      setSearchResults([])
      return
    }

    // Debounce de 300ms para busca por nome/email.
    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true)
      try {
        const results = await searchAccountsByName(trimmedValue)
        setSearchResults(results)
        setShowDropdown(results.length > 0)
        if (results.length === 0) {
          setError('Nenhuma conta encontrada')
        }
      } catch (err: any) {
        setError(err?.message || 'Erro ao buscar contas')
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }, 300)
  }

  const handleSelectAccount = (account: UserAccount) => {
    setSelectedAccount(account)
    setSearchQuery(account.name || account.email)
    setShowDropdown(false)
    setSearchResults([])
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedAccount) return

    // Mostrar janela de confirmação
    setShowConfirmation(true)
  }

  const handleConfirmAddValue = async () => {
    if (!selectedAccount) return

    setIsLoading(true)
    setShowConfirmation(false)
    
    try {
      await updateUserBalance(selectedAccount.id, parseFloat(amount), 'credit', 'Crédito adicionado')
      
      showSuccess(
        'Valor Adicionado!',
        `R$ ${formattedAmount} foi adicionado à conta de ${selectedAccount.name || selectedAccount.email} com sucesso.`
      )
      
      // Resetar todos os campos
      setAmount('')
      setFormattedAmount('')
      setSearchQuery('')
      setSearchResults([])
      setShowDropdown(false)
      setSelectedAccount(null)
    } catch (err: any) {
      setError(err?.message || 'Erro ao adicionar valor')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancelConfirmation = () => {
    setShowConfirmation(false)
  }

  const inputClass = 'w-full px-4 py-3 border-2 border-ferro-200 rounded-xl bg-creme-50 text-ferro-900 focus:border-ferro-500 focus:ring-2 focus:ring-ferro-200 transition-colors duration-200'

  return (
    <div className="space-y-4">
      <Header 
            title="Adicionar Valor"
            subtitle="Adicione créditos diretamente à conta do encontrista"
            showLogo={false}
        />
      <div className="w-full relative z-10">
        <div className="mx-auto w-full">

          {/* Formulário */}
          <div className="painel p-5 md:p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Busca por nome ou email */}
              <div className="relative" ref={dropdownRef}>
                <label htmlFor="searchQuery" className="block text-sm font-semibold text-ferro-900 mb-2">
                  🔍 Buscar usuário por nome ou email
                </label>
                <div className="relative">
                  <input
                    type="text"
                    id="searchQuery"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                    className={`${inputClass} pr-11`}
                    placeholder="Nome ou email do usuário"
                    autoComplete="off"
                  />
                  {isSearching && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="animate-spin h-5 w-5 border-2 border-ferro-500 border-t-transparent rounded-full"></div>
                    </div>
                  )}
                </div>

                {/* Dropdown de resultados */}
                {showDropdown && searchResults.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-creme-50 border-2 border-ferro-200 rounded-xl shadow-bilhete max-h-60 overflow-y-auto">
                    {searchResults.map((account) => (
                      <button
                        key={account.id}
                        type="button"
                        onClick={() => handleSelectAccount(account)}
                        className="w-full !px-4 !py-3 text-left hover:bg-creme-200 transition-colors border-b border-ferro-100 last:border-b-0 focus:bg-creme-200 focus:outline-none"
                      >
                        <div className="font-semibold text-ferro-900">{account.name || 'Sem nome'}</div>
                        <div className="text-sm text-ferro-600 flex justify-between gap-3">
                          <span>{account.email}</span>
                          <span>R$ {(account.balance || 0).toFixed(2).replace('.', ',')}</span>
                        </div>
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

              {/* Valor a ser adicionado */}
              <div>
                <label htmlFor="amount" className="block text-sm font-semibold text-ferro-900 mb-2">
                  💰 Valor a Adicionar (R$)
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
                    <div className="flex justify-between items-baseline">
                      <span className="text-sm text-ferro-600">Novo saldo</span>
                      <span className="font-slab text-lg text-green-700">
                        R$ {((selectedAccount.balance || 0) + parseFloat(amount || '0')).toFixed(2).replace('.', ',')}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Botão de Adicionar */}
              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={isLoading || !selectedAccount}
              >
                {isLoading ? (
                  <>
                    <span className="inline-block animate-spin mr-2">⚙️</span>
                    Adicionando valor...
                  </>
                ) : (
                  <>
                    💰 Adicionar Valor
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
        onConfirm={handleConfirmAddValue}
        title="Confirmar Adição de Valor"
        message="Deseja realmente creditar esse valor na conta?"
        icon="💰"
        account={selectedAccount}
        transactionType="credit"
        variant="account-transaction"
        amount={amount}
        formattedAmount={formattedAmount}
        isLoading={isLoading}  
        />
    </div>
  )
}

export default AddBalancePage
