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


  return (
    <div className="space-y-3">
      {/* Header compacto */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-emerald-600 font-cardinal">
          💳 Cadastrar Cartão
        </h1>
      </div>

      <div className="w-full relative z-10">
        <div className="mx-auto w-full">

          {/* Estado: Cartão criado com sucesso */}
          {createdCard && (
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl border border-green-200 p-6 animate-fade-in">
              <div className="text-center">
                <div className="flex items-center justify-center gap-3 mb-3">
                  <span className="text-3xl">✅</span>
                  <div className="text-left">
                    <p className="font-bold text-green-800 text-lg font-cardinal">
                      Cartão Criado!
                    </p>
                    <p className="text-green-600 text-sm">
                      Pronto para uso
                    </p>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-emerald-100 to-emerald-200 rounded-xl p-4 mb-4 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-black/70 text-sm">Número</span>
                    <span className="font-bold text-black text-lg font-mono">
                      #{createdCard.cardNumber}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-black/70 text-sm">Portador</span>
                    <span className="font-semibold text-black">
                      {createdCard.userName}
                    </span>
                  </div>
                  <div className="border-t border-emerald-300 pt-2 mt-2">
                    <p className="text-black/70 text-xs mb-1">Saldo Inicial</p>
                    <p className="text-3xl font-bold text-black">
                      R$ {createdCard.balance.toFixed(2).replace('.', ',')}
                    </p>
                  </div>
                </div>

                <Button
                  onClick={handleNewCard}
                  size="lg"
                  className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-black shadow-lg hover:shadow-emerald-200 font-semibold"
                >
                  ➕ Cadastrar Novo Cartão
                </Button>
              </div>
            </div>
          )}

          {/* Estado: Formulário (inicial ou após clicar em "novo cartão") */}
          {!createdCard && (
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl border border-yellow-200 p-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Nome do Portador */}
                <div>
                  <label htmlFor="name" className="block text-sm font-semibold text-black mb-1 font-farmhand">
                    👤 Nome do Portador
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full px-4 py-3 border-2 border-emerald-200 rounded-lg focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-colors duration-200 bg-white/90"
                    placeholder="Digite o nome completo"
                    autoFocus
                  />
                </div>

                {/* Número do Cartão */}
                <div>
                  <label htmlFor="cardNumber" className="block text-sm font-semibold text-black mb-1 font-farmhand">
                    💳 Número do Cartão
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    id="cardNumber"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, '').slice(0, 16))}
                    required
                    className="w-full px-4 py-3 border-2 border-emerald-200 rounded-lg focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-colors duration-200 bg-white/90"
                    placeholder="001"
                    maxLength={3}
                  />
                </div>

                {/* Código do Cartão */}
                <div>
                  <label htmlFor="cardCode" className="block text-sm font-semibold text-black mb-1 font-farmhand">
                    🔑 Código do Cartão
                  </label>
                  <input
                    type="text"
                    id="cardCode"
                    value={cardCode}
                    onChange={(e) => setCardCode(e.target.value.replace(/\s+/g, ''))}
                    required
                    className="w-full px-4 py-3 border-2 border-emerald-200 rounded-lg focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-colors duration-200 bg-white/90"
                    placeholder="Digite o código do cartão"
                  />
                </div>

                {/* Telefone */}
                <div>
                  <label htmlFor="phoneNumber" className="block text-sm font-semibold text-black mb-1 font-farmhand">
                    📱 Telefone
                  </label>
                  <input
                    type="tel"
                    inputMode="tel"
                    id="phoneNumber"
                    value={formattedPhone}
                    onChange={handlePhoneChange}
                    required
                    className="w-full px-4 py-3 border-2 border-emerald-200 rounded-lg focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-colors duration-200 bg-white/90"
                    placeholder="(11) 99999-9999"
                  />
                </div>

                {/* Saldo Inicial */}
                <div>
                  <label htmlFor="initialBalance" className="block text-sm font-semibold text-black mb-1 font-farmhand">
                    💰 Saldo Inicial (R$)
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    id="initialBalance"
                    value={formattedBalance}
                    onChange={handleBalanceChange}
                    className="w-full px-4 py-3 border-2 border-emerald-200 rounded-lg focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-colors duration-200 bg-white/90"
                    placeholder="0,00"
                  />
                </div>

                {/* Mensagem de erro */}
                {createCardMutation.isError && (() => {
                  const error = createCardMutation.error as any
                  const errorMessage = error?.message || error?.error || error?.toString() || 'Ocorreu um erro ao tentar criar o cartão. Por favor, tente novamente.'
                  return (
                    <div className="bg-red-50 border-2 border-red-300 rounded-lg p-3">
                      <div className="flex items-start">
                        <span className="text-red-500 text-lg mr-2">⚠️</span>
                        <div className="flex-1">
                          <p className="text-red-800 font-semibold text-sm mb-1">Erro ao criar cartão</p>
                          <p className="text-red-700 text-xs whitespace-pre-wrap">
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
                  className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-black shadow-lg hover:shadow-emerald-200 font-semibold"
                  disabled={createCardMutation.isPending}
                >
                  {createCardMutation.isPending ? (
                    <>
                      <span className="animate-spin mr-2">✨</span>
                      Criando cartão...
                    </>
                  ) : (
                    <>
                      💳 Criar Cartão
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