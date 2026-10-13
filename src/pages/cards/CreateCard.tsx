import React, { useState } from 'react'
import { Button } from '../../components/shared'
import { useCreateCard } from '../../hooks/useCards'

interface CreateCardProps {
  onBack?: () => void
}

interface CreatedCardData {
  cardNumber: string
  userName: string
  balance: number
}

const CreateCard: React.FC<CreateCardProps> = ({ onBack: _onBack }) => {
  const createCardMutation = useCreateCard()
  const [name, setName] = useState('')
  const [cardNumber, setCardNumber] = useState('')
  const [cardCode, setCardCode] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('839')
  const [formattedPhone, setFormattedPhone] = useState('(83) 9')
  const [initialBalance, setInitialBalance] = useState('')
  const [formattedBalance, setFormattedBalance] = useState('')
  
  // Estado para controle do fluxo de UX
  const [createdCard, setCreatedCard] = useState<CreatedCardData | null>(null)

  // Formatar telefone brasileiro: (XX) 9XXXX-XXXX
  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '').slice(0, 11)
    
    if (numbers.length === 0) return ''
    if (numbers.length <= 2) return `(${numbers}`
    if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`
    return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    const numbers = value.replace(/\D/g, '').slice(0, 11)
    setPhoneNumber(numbers)
    setFormattedPhone(formatPhone(value))
  }

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

  const handleBalanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    const formatted = formatCurrency(value)
    setFormattedBalance(formatted)
    
    // Remove tudo que não é número e converte para centavos
    const numbers = value.replace(/\D/g, '')
    if (numbers === '') {
      setInitialBalance('0')
    } else {
      const cents = parseInt(numbers)
      setInitialBalance((cents / 100).toString())
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const result = await createCardMutation.mutateAsync({
        name,
        cardNumber,
        cardCode,
        phoneNumber,
        initialBalance: parseFloat(initialBalance) || 0
      })
      
      // Guardar dados do cartão criado para exibir na tela de sucesso
      setCreatedCard({
        cardNumber: result?.card_number || result?.cardNumber || cardNumber,
        userName: result?.user_name || result?.userName || name,
        balance: result?.balance || parseFloat(initialBalance) || 0
      })
    } catch (error) {
      // Erro já tratado no hook
      console.error('Erro ao criar cartão:', error)
    }
  }

  const handleNewCard = () => {
    setCreatedCard(null)
    setName('')
    setCardNumber('')
    setCardCode('')
    setPhoneNumber('839')
    setFormattedPhone('(83) 9')
    setInitialBalance('')
    setFormattedBalance('')
    createCardMutation.reset()
  }


  const inputClass = 'w-full px-4 py-3 border-2 border-ferro-200 rounded-xl bg-creme-50 text-ferro-900 focus:border-ferro-500 focus:ring-2 focus:ring-ferro-200 transition-colors duration-200'
  const labelClass = 'block text-sm font-semibold text-ferro-900 mb-1 font-body'

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="text-center">
        <h1 className="text-2xl md:text-3xl font-semibold text-ferro-900 font-display uppercase tracking-wide">
          🎫 Cadastrar Cartão
        </h1>
        <p className="text-sm text-ferro-600 mt-1">Emita um novo bilhete para o encontrista</p>
        <div className="trilho w-full max-w-xs mx-auto mt-3" />
      </div>

      <div className="w-full relative z-10">
        <div className="mx-auto w-full">

          {/* Estado: Cartão criado com sucesso */}
          {createdCard && (
            <div className="painel p-5 md:p-6 animate-fade-in">
              <div className="text-center">
                <div className="flex items-center justify-center gap-3 mb-4">
                  <span className="carimbo text-green-700 text-sm">✓ Cartão emitido</span>
                </div>

                <div className="bilhete overflow-hidden mb-5 text-left">
                  <div className="bg-caldeira rounded-t-xl px-4 py-2 flex items-center justify-between">
                    <span className="font-display text-xs tracking-[0.25em] uppercase text-creme-200">Bilhete</span>
                    <span className="font-ticket text-lg font-bold text-latao-400">
                      Nº {createdCard.cardNumber}
                    </span>
                  </div>
                  <div className="px-5 py-4 space-y-3">
                    <div>
                      <p className="font-display text-[11px] tracking-[0.25em] uppercase text-ferro-500">Passageiro</p>
                      <p className="font-semibold text-ferro-900 text-lg leading-tight">{createdCard.userName}</p>
                    </div>
                    <div className="picote-horizontal pt-3">
                      <p className="font-display text-[11px] tracking-[0.25em] uppercase text-ferro-500">Saldo Inicial</p>
                      <p className="font-slab text-3xl text-ferro-900">
                        R$ {createdCard.balance.toFixed(2).replace('.', ',')}
                      </p>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={handleNewCard}
                  size="lg"
                  className="w-full"
                >
                  ➕ Cadastrar Novo Cartão
                </Button>
              </div>
            </div>
          )}

          {/* Estado: Formulário (inicial ou após clicar em "novo cartão") */}
          {!createdCard && (
            <div className="painel p-5 md:p-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Nome do Portador */}
                <div>
                  <label htmlFor="name" className={labelClass}>
                    👤 Nome do Portador
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className={inputClass}
                    placeholder="Digite o nome completo"
                    autoFocus
                  />
                </div>

                {/* Número do Cartão */}
                <div>
                  <label htmlFor="cardNumber" className={labelClass}>
                    🎫 Número do Cartão
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    id="cardNumber"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, '').slice(0, 16))}
                    required
                    className={`${inputClass} font-ticket tracking-widest`}
                    placeholder="001"
                    maxLength={3}
                  />
                </div>

                {/* Código do Cartão */}
                <div>
                  <label htmlFor="cardCode" className={labelClass}>
                    🔑 Código do Cartão
                  </label>
                  <input
                    type="text"
                    id="cardCode"
                    value={cardCode}
                    onChange={(e) => setCardCode(e.target.value.replace(/\s+/g, ''))}
                    required
                    className={`${inputClass} font-ticket`}
                    placeholder="Digite o código do cartão"
                  />
                </div>

                {/* Telefone */}
                <div>
                  <label htmlFor="phoneNumber" className={labelClass}>
                    📱 Telefone
                  </label>
                  <input
                    type="tel"
                    inputMode="tel"
                    id="phoneNumber"
                    value={formattedPhone}
                    onChange={handlePhoneChange}
                    required
                    className={inputClass}
                    placeholder="(11) 99999-9999"
                  />
                </div>

                {/* Saldo Inicial */}
                <div>
                  <label htmlFor="initialBalance" className={labelClass}>
                    💰 Saldo Inicial (R$)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    id="initialBalance"
                    value={formattedBalance}
                    onChange={handleBalanceChange}
                    className={inputClass}
                    placeholder="0,00"
                  />
                </div>

                {/* Mensagem de erro */}
                {createCardMutation.isError && (() => {
                  const error = createCardMutation.error as any
                  const errorMessage = error?.message || error?.error || error?.toString() || 'Ocorreu um erro ao tentar criar o cartão. Por favor, tente novamente.'
                  return (
                    <div className="bg-vagao-50 border-2 border-vagao-300 rounded-xl p-3">
                      <div className="flex items-start">
                        <span className="text-vagao-600 text-lg mr-2">⚠️</span>
                        <div className="flex-1">
                          <p className="text-vagao-800 font-semibold text-sm mb-1">Erro ao criar cartão</p>
                          <p className="text-vagao-700 text-xs whitespace-pre-wrap">
                            {errorMessage}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })()}

                {/* Botão de Criar */}
                <Button
                  type="submit"
                  size="lg"
                  className="w-full !bg-vagao-600 hover:!bg-vagao-700 !border-vagao-600 !text-creme-50"
                  disabled={createCardMutation.isPending}
                >
                  {createCardMutation.isPending ? (
                    <>
                      <span className="inline-block animate-spin mr-2">⚙️</span>
                      Emitindo cartão...
                    </>
                  ) : (
                    <>
                      🎫 Criar Cartão
                    </>
                  )}
                </Button>
              </form>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

export default CreateCard
