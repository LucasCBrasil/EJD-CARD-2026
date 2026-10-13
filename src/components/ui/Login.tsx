import React, { useState, useEffect } from 'react'
import { useRouter } from '@tanstack/react-router'
import { useAuth } from '../../contexts/AuthContext'
import { TrilhosBackground } from '../shared/TrilhosBackground'

const Login: React.FC = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [isLogin, setIsLogin] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [showEmailForm, setShowEmailForm] = useState(false)
  
  const router = useRouter()
  const { login, register, loginWithGoogle, user } = useAuth()

  const safeNavigate = (path: string) => {
    router.navigate({ to: path as any, search: {} as any })
  }

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
        await new Promise(resolve => setTimeout(resolve, 100))
        safeNavigate('/')
      } else {
        await register(email, password, name)
        await login(email, password)
        await new Promise(resolve => setTimeout(resolve, 100))
        safeNavigate('/')
      }
    } catch (err: any) {
      let errorMessage = 'Erro ao fazer login/registro'
      
      if (err.message) {
        const message = err.message.toLowerCase()
        
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
        else if (message.includes('email') && message.includes('invalid')) {
          errorMessage = 'Email inválido. Verifique o formato do email'
        } else if (message.includes('email') && message.includes('already') || message.includes('exists') || message.includes('cadastrado')) {
          errorMessage = 'Este email já está cadastrado. Tente fazer login ou use outro email'
        } else if (message.includes('email')) {
          errorMessage = 'Email inválido'
        }
        else if (message.includes('invalid') && message.includes('credentials') || message.includes('email') && message.includes('password')) {
          errorMessage = 'Email ou senha incorretos. Verifique suas credenciais'
        } else if (message.includes('user not found')) {
          errorMessage = 'Usuário não encontrado. Verifique o email ou cadastre-se'
        } else if (message.includes('too many requests')) {
          errorMessage = 'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente'
        }
        else {
          errorMessage = err.message
        }
      }
      
      setError(errorMessage)
      setIsLoading(false)
    }
  }

  const inputClass = 'w-full rounded-xl bg-creme-50 border-2 border-ferro-200 text-ferro-900'

  return (
    <div className="min-h-screen w-full relative flex items-center justify-center overflow-hidden">
      <TrilhosBackground />

      <div className="w-full max-w-md mx-auto px-4 relative z-10 py-6 sm:py-10">
        <div className="flex justify-center mb-6">
          <img
            src="/logos/web/trenzinho.webp"
            alt="Encontrão EJD 25 Anos - Trilhos e Destinos"
            className="w-44 sm:w-56 h-auto drop-shadow-[0_10px_16px_rgba(72,36,12,0.3)]"
          />
        </div>

        {/* Cartão de embarque */}
        <div className="rounded-3xl overflow-hidden border-2 border-ferro-800 bg-creme-50 shadow-bilhete-hover">
          <div className="bg-caldeira px-6 py-4 flex items-center justify-between">
            <div>
              <p className="font-display text-[11px] tracking-[0.3em] uppercase text-latao-300">Cartão de embarque</p>
              <h1 className="font-display text-2xl sm:text-3xl font-semibold uppercase text-creme-100 leading-tight">
                {isLogin ? 'Bem-vindo a bordo' : 'Nova passagem'}
              </h1>
            </div>
            <img src="/logos/web/ejd-25-anos-creme.webp" alt="EJD 25 anos" className="w-12 h-12 opacity-90" />
          </div>
          <div className="trilho mx-6 mt-4" />

          <div className="px-6 sm:px-8 pt-5 pb-7">
            {error && (
              <div className="mb-4 p-3 rounded-xl text-sm bg-vagao-50 border-2 border-vagao-200 text-vagao-800">
                {error}
              </div>
            )}

            {/* Login com Google - prioridade */}
            <button
              type="button"
              onClick={async () => {
                setIsLoading(true)
                setError('')
                try {
                  await loginWithGoogle()
                } catch (err: any) {
                  setError(err.message || 'Erro ao entrar com o Google')
                  setIsLoading(false)
                }
              }}
              disabled={isLoading}
              className="w-full h-16 !px-4 rounded-2xl flex items-center justify-center gap-4 mb-4 bg-ferro-800 hover:bg-ferro-700 text-creme-100 shadow-md hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-50 transition-all duration-200"
            >
              <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-white shadow">
                <svg className="w-6 h-6" viewBox="0 0 24 24">
                          <path
                            fill="#4285F4"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          />
                          <path
                            fill="#34A853"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          />
                          <path
                            fill="#FBBC05"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                          />
                          <path
                            fill="#EA4335"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                          />
                        </svg>
              </span>
              <span className="font-display text-lg uppercase tracking-wider">Embarcar com Google</span>
            </button>

            {!showEmailForm && (
              <button
                type="button"
                onClick={() => setShowEmailForm(true)}
                className="w-full h-16 !px-4 rounded-2xl flex items-center justify-center gap-3 bg-creme-100 hover:bg-creme-200 border-2 border-ferro-800 text-ferro-800 hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200"
              >
                <span className="text-2xl">📧</span>
                <span className="font-display text-lg uppercase tracking-wider">Entrar com e-mail e senha</span>
              </button>
            )}

            {showEmailForm && (
              <>
                <div className="flex items-center gap-3 my-5">
                  <div className="flex-1 border-t-2 border-dashed border-ferro-200" />
                  <span className="font-display text-xs uppercase tracking-[0.3em] text-ferro-500">ou</span>
                  <div className="flex-1 border-t-2 border-dashed border-ferro-200" />
                </div>

                {/* Alternar entre login e cadastro */}
                <div className="flex mb-5 rounded-2xl p-1 bg-creme-200 border-2 border-ferro-200">
                  <button
                    type="button"
                    onClick={() => setIsLogin(true)}
                    className={`flex-1 !py-2.5 !px-3 rounded-xl text-sm font-display uppercase tracking-wide transition-all duration-200 ${isLogin ? 'bg-ferro-800 text-creme-100 shadow' : 'bg-transparent text-ferro-700'}`}
                  >
                    🎫 Entrar
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsLogin(false)}
                    className={`flex-1 !py-2.5 !px-3 rounded-xl text-sm font-display uppercase tracking-wide transition-all duration-200 ${!isLogin ? 'bg-ferro-800 text-creme-100 shadow' : 'bg-transparent text-ferro-700'}`}
                  >
                    ✍️ Cadastrar
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {!isLogin && (
                    <div>
                      <label htmlFor="name">Nome</label>
                      <input
                        type="text"
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required={!isLogin}
                        className={inputClass}
                        placeholder="Seu nome completo"
                      />
                    </div>
                  )}

                  <div>
                    <label htmlFor="email">E-mail</label>
                    <input
                      type="email"
                      id="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className={inputClass}
                      placeholder="seu@email.com"
                    />
                  </div>

                  <div>
                    <label htmlFor="password">Senha</label>
                    <input
                      type="password"
                      id="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className={inputClass}
                      placeholder="••••••••"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full !py-4 rounded-2xl font-display text-lg uppercase tracking-wider bg-vagao-600 hover:bg-vagao-700 text-creme-100 shadow-md hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-50 transition-all duration-200 mt-2"
                  >
                    {isLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="animate-roda inline-block">⚙️</span>
                        {isLogin ? 'Embarcando...' : 'Emitindo passagem...'}
                      </span>
                    ) : (
                      isLogin ? '🚂 Embarcar' : '🎫 Criar minha conta'
                    )}
                  </button>
                </form>

                <div className="mt-5 text-center space-y-3">
                  <a href="#" className="block text-sm font-medium text-vagao-600 hover:text-vagao-700">
                    Esqueceu sua senha?
                  </a>
                  <div className="text-sm text-ferro-700">
                    {isLogin ? 'Não tem uma conta?' : 'Já tem uma conta?'}
                    <button
                      onClick={() => setIsLogin(!isLogin)}
                      className="!p-0 ml-1 bg-transparent font-bold text-vagao-600 hover:text-vagao-700"
                    >
                      {isLogin ? 'Cadastre-se aqui' : 'Faça login'}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowEmailForm(false)
                      setError('')
                      setEmail('')
                      setPassword('')
                      setName('')
                    }}
                    className="!p-0 bg-transparent text-sm font-medium text-ferro-600 hover:text-ferro-800"
                  >
                    ← Voltar para login com Google
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Canhoto */}
          <div className="picote-horizontal bg-creme-200 px-6 py-4 text-center">
            <p className="font-display uppercase tracking-[0.2em] text-sm text-ferro-800">
              Encontrão EJD 25 Anos
            </p>
            <p className="text-sm text-ferro-600">Cada trilho nos leva a um novo destino 🚂</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login
