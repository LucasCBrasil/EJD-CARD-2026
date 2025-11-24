import React, { useState, useEffect } from 'react'
import { useRouter } from '@tanstack/react-router'
import { Button } from '../shared'
import { useAuth } from '../../contexts/AuthContext'

const Login: React.FC = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [isLogin, setIsLogin] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  
  const router = useRouter()
  const { login, register, user } = useAuth()

  const safeNavigate = (path: string) => {
    router.navigate({ to: path as any, search: {} as any })
  }

  // Redirecionar se já estiver logado
  useEffect(() => {
    if (user) {
      safeNavigate('/')
    }
  }, [user, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    
    try {
      if (isLogin) {
        await login(email, password)
        // Aguardar um pouco para garantir que o contexto do router seja atualizado
        await new Promise(resolve => setTimeout(resolve, 100))
        // Navegar após login bem-sucedido
        safeNavigate('/')
      } else {
        await register(email, password, name)
        // Após registro, fazer login automaticamente
        await login(email, password)
        // Aguardar um pouco para garantir que o contexto do router seja atualizado
        await new Promise(resolve => setTimeout(resolve, 100))
        safeNavigate('/')
      }
    } catch (err: any) {
      // Melhorar mensagens de erro para serem mais claras
      let errorMessage = 'Erro ao fazer login/registro'
      
      if (err.message) {
        const message = err.message.toLowerCase()
        
        // Erros de senha
        if (message.includes('password') && message.includes('letter') && message.includes('number')) {
          errorMessage = 'A senha deve conter pelo menos uma letra e um número'
        } else if (message.includes('password') && message.includes('letter')) {
          errorMessage = 'A senha deve conter pelo menos uma letra'
        } else if (message.includes('password') && message.includes('number')) {
          errorMessage = 'A senha deve conter pelo menos um número'
        } else if (message.includes('password') && message.includes('length') || message.includes('6 characters')) {
          errorMessage = 'A senha deve ter no mínimo 6 caracteres'
        } else if (message.includes('password') && message.includes('weak')) {
          errorMessage = 'A senha é muito fraca. Use uma combinação de letras, números e caracteres especiais'
        } else if (message.includes('password')) {
          errorMessage = 'Senha inválida. A senha deve ter no mínimo 6 caracteres e conter pelo menos uma letra e um número'
        }
        // Erros de email
        else if (message.includes('email') && message.includes('invalid')) {
          errorMessage = 'Email inválido. Verifique o formato do email'
        } else if (message.includes('email') && message.includes('already') || message.includes('exists') || message.includes('cadastrado')) {
          errorMessage = 'Este email já está cadastrado. Tente fazer login ou use outro email'
        } else if (message.includes('email')) {
          errorMessage = 'Email inválido'
        }
        // Erros de autenticação
        else if (message.includes('invalid') && message.includes('credentials') || message.includes('email') && message.includes('password')) {
          errorMessage = 'Email ou senha incorretos. Verifique suas credenciais'
        } else if (message.includes('user not found')) {
          errorMessage = 'Usuário não encontrado. Verifique o email ou cadastre-se'
        } else if (message.includes('too many requests')) {
          errorMessage = 'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente'
        }
        // Outros erros
        else {
          errorMessage = err.message
        }
      }
      
      setError(errorMessage)
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full relative flex items-center justify-center">
      {/* Imagem de fundo - Estrada Dourada e Cidade Esmeralda */}
      <div 
        className="fixed inset-0"
        style={{
          backgroundImage: 'url(/background-emerald-city.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundAttachment: 'fixed',
          zIndex: -1,
          pointerEvents: 'none'
        }}
      >
        {/* Overlay sutil para melhorar legibilidade do formulário */}
        <div className="absolute inset-0 bg-white/20 backdrop-blur-[2px] pointer-events-none"></div>
      </div>
      
      {/* Bordas decorativas douradas */}
      <div className="absolute top-0 left-0 w-20 h-20 border-t-4 border-l-4 border-yellow-400 rounded-br-lg z-20"></div>
      <div className="absolute top-0 right-0 w-20 h-20 border-t-4 border-r-4 border-yellow-400 rounded-bl-lg z-20"></div>
      <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-32 h-8 border-b-4 border-yellow-400 rounded-t-lg z-20"></div>
      
      <div className="w-full max-w-md mx-auto px-4 relative z-10">
        {/* Logo e título */}
        <div className="text-center mb-8">
          <img 
            src="/logo-encontrão-2025.png" 
            alt="Logo Encontrão 2025 - em CAMINHOZ MÁGICOS" 
            className="max-w-xs mx-auto h-auto mb-6"
          />
          <h1 className="text-3xl font-bold text-black mb-2 font-cardinal">
            🧙‍♂️ Bem-vindo aos caminhos mágicos
          </h1>
          <p className="text-black font-farmhand italic">
            Entre na sua jornada mágica
          </p>
        </div>

        {/* Formulário de Login/Registro */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl border border-yellow-200 p-8">
          {/* Toggle Login/Registro */}
          <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
            <button
              type="button"
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                isLogin 
                  ? 'bg-white text-black shadow-sm' 
                  : 'text-gray-600 hover:text-black'
              }`}
            >
              🏰 Entrar
            </button>
            <button
              type="button"
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                !isLogin 
                  ? 'bg-white text-black shadow-sm' 
                  : 'text-gray-600 hover:text-black'
              }`}
            >
              🎭 Registrar
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Campo Nome (apenas para registro) */}
            {!isLogin && (
              <div>
                <label htmlFor="name" className="block text-sm font-semibold text-black mb-2">
                  👤 Nome
                </label>
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required={!isLogin}
                  className="w-full px-4 py-3 border-2 border-emerald-200 rounded-lg focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-colors duration-200 bg-white/90"
                  placeholder="Seu nome completo"
                />
              </div>
            )}

            {/* Campo Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-black mb-2">
                📧 Email
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 border-2 border-emerald-200 rounded-lg focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-colors duration-200 bg-white/90"
                placeholder="seu@email.com"
              />
            </div>

            {/* Campo Senha */}
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-black mb-2">
                🔑 Senha
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 border-2 border-emerald-200 rounded-lg focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-colors duration-200 bg-white/90"
                placeholder="••••••••"
              />
            </div>

            {/* Botão de Login/Registro */}
            <Button
              type="submit"
              size="lg"
              className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-black shadow-lg hover:shadow-emerald-200 font-semibold"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="animate-spin mr-2">✨</span>
                  {isLogin ? 'Entrando na Cidade Esmeralda...' : 'Criando sua conta...'}
                </>
              ) : (
                <>
                  {isLogin ? '🏰 Entrar na Cidade Esmeralda' : '🎭 Criar Conta'}
                </>
              )}
            </Button>
          </form>

          {/* Links adicionais */}
          <div className="mt-6 text-center space-y-3">
            <a 
              href="#" 
              className="text-sm text-black hover:text-gray-600 transition-colors duration-200 block"
            >
              🧭 Esqueceu sua senha?
            </a>
            <div className="text-sm text-black">
              {isLogin ? 'Não tem uma conta?' : 'Já tem uma conta?'}
              <button 
                onClick={() => setIsLogin(!isLogin)}
                className="text-black hover:text-gray-600 font-semibold ml-1 transition-colors duration-200"
              >
                {isLogin ? '🎭 Crie uma aqui' : '🏰 Faça login'}
              </button>
            </div>
          </div>
        </div>

        {/* Elementos decorativos */}
        <div className="text-center mt-8">
          <div className="flex justify-center space-x-4 text-2xl">
            <span className="animate-bounce">👠</span>
            <span className="animate-bounce" style={{ animationDelay: '0.1s' }}>🛤️</span>
            <span className="animate-bounce" style={{ animationDelay: '0.2s' }}>🏰</span>
            <span className="animate-bounce" style={{ animationDelay: '0.3s' }}>🧙‍♂️</span>
            <span className="animate-bounce" style={{ animationDelay: '0.4s' }}>✨</span>
          </div>
          <p className="text-black text-sm mt-2 font-farmhand italic">
            "Não há lugar como o lar" - mas este é bem próximo! 🏠
          </p>
        </div>
      </div>
    </div>
  )
}

export default Login