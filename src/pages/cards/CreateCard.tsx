import React, { useState } from 'react'
import { Button, Header } from '../../components/shared'
import { useCreateCard } from '../../hooks/useCards'
import { useNavigate } from '@tanstack/react-router'

interface CreateCardProps {
  onBack?: () => void
}

const CreateCard: React.FC<CreateCardProps> = ({ onBack: _onBack }) => {
  const createCardMutation = useCreateCard()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [cardNumber, setCardNumber] = useState('')
  const [cardCode, setCardCode] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [initialBalance, setInitialBalance] = useState('')
  const [formattedBalance, setFormattedBalance] = useState('')

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
      await createCardMutation.mutateAsync({
        name,
        cardNumber,
        cardCode,
        phoneNumber,
        initialBalance: parseFloat(initialBalance) || 0
      })
      
      navigate({ to: '/cards' as any, search: {} as any })
    } catch (error) {
      // Erro já tratado no hook
      console.error('Erro ao criar cartão:', error)
    }
  }


  return (
    <div className="space-y-6">
      <Header 
            title="Cadastrar Cartão"
            subtitle="Crie um novo cartão mágico"
            showLogo={false}
        />
      <div className="w-full relative z-10">
        <div className="mx-auto w-full">

          {/* Formulário */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl border border-yellow-200 p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Nome do Portador */}
              <div>
                <label htmlFor="name" className="block text-sm font-semibold text-black mb-2 font-farmhand">
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
                />
              </div>

              {/* Número do Cartão */}
              <div>
                <label htmlFor="cardNumber" className="block text-sm font-semibold text-black mb-2 font-farmhand">
                  💳 Número do Cartão
                </label>
                <input
                  type="text"
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
                <label htmlFor="cardCode" className="block text-sm font-semibold text-black mb-2 font-farmhand">
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
                <label htmlFor="phoneNumber" className="block text-sm font-semibold text-black mb-2 font-farmhand">
                  📱 Telefone
                </label>
                <input
                  type="text"
                  id="phoneNumber"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 11))}
                  required
                  className="w-full px-4 py-3 border-2 border-emerald-200 rounded-lg focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-colors duration-200 bg-white/90"
                  placeholder="11999999999"
                />
              </div>

              {/* Saldo Inicial */}
              <div>
                <label htmlFor="initialBalance" className="block text-sm font-semibold text-black mb-2 font-farmhand">
                  💰 Saldo Inicial (R$)
                </label>
                <input
                  type="text"
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
                  <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
                    <div className="flex items-start">
                      <span className="text-red-500 text-xl mr-2">⚠️</span>
                      <div className="flex-1">
                        <p className="text-red-800 font-semibold mb-1">Erro ao criar cartão</p>
                        <p className="text-red-700 text-sm whitespace-pre-wrap">
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
                    Criando cartão mágico...
                  </>
                ) : (
                  <>
                    💳 Criar cartão
                  </>
                )}
              </Button>
            </form>
          </div>

          {/* Informações adicionais */}
          <div className="mt-8 text-center">
            <div className="bg-yellow-100 border border-yellow-300 rounded-lg p-4">
              <p className="text-black text-sm font-farmhand">
                💡 <strong>Dica:</strong> O cartão será criado com as informações fornecidas e estará disponível imediatamente para uso.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CreateCard