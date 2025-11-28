import React, { useState, useEffect } from 'react'
import { useRouter } from '@tanstack/react-router'
import { useAuth } from '../../contexts/AuthContext'

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

  return (
    <div className="min-h-screen w-full relative flex items-center justify-center overflow-hidden">
      {/* Imagem de fundo */}
      <div 
        className="fixed inset-0"
        style={{
          backgroundImage: 'url(/background-emerald-city.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          zIndex: -2,
        }}
      />
      
      {/* Overlay para melhor contraste */}
      <div 
        className="fixed inset-0"
        style={{
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.5) 100%)',
          zIndex: -1,
        }}
      />
      
      {/* Brilhos mágicos flutuantes */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
        {[...Array(25)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full"
            style={{
              width: Math.random() * 8 + 4 + 'px',
              height: Math.random() * 8 + 4 + 'px',
              background: i % 3 === 0 
                ? 'radial-gradient(circle, rgba(255,215,0,0.9) 0%, rgba(255,215,0,0) 70%)'
                : i % 3 === 1
                ? 'radial-gradient(circle, rgba(16,185,129,0.8) 0%, rgba(16,185,129,0) 70%)'
                : 'radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0) 70%)',
              left: Math.random() * 100 + '%',
              top: Math.random() * 100 + '%',
              animation: `float ${Math.random() * 4 + 3}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 3}s`,
              filter: 'blur(1px)',
            }}
          />
        ))}
      </div>

      <div className="w-full max-w-xl mx-auto px-3 sm:px-6 relative z-10 py-4 sm:py-8">
        {/* Card principal - Estilo pergaminho mágico */}
        <div 
          className="rounded-3xl overflow-hidden relative"
          style={{
            background: 'linear-gradient(145deg, rgba(255,250,235,0.98) 0%, rgba(255,252,240,0.96) 50%, rgba(255,248,230,0.98) 100%)',
            boxShadow: `
              0 30px 70px -15px rgba(0,0,0,0.5),
              0 0 50px rgba(16,185,129,0.15),
              inset 0 1px 0 rgba(255,255,255,0.9),
              inset 0 -1px 0 rgba(139,69,19,0.1)
            `,
            border: '2px solid rgba(16,185,129,0.3)',
          }}
        >
          {/* Decoração de canto superior esquerdo */}
          <div 
            className="absolute top-0 left-0 w-16 h-16"
            style={{
              background: 'linear-gradient(135deg, rgba(16,185,129,0.3) 0%, transparent 60%)',
              borderBottomRightRadius: '100%',
            }}
          />
          
          {/* Decoração de canto superior direito */}
          <div 
            className="absolute top-0 right-0 w-16 h-16"
            style={{
              background: 'linear-gradient(225deg, rgba(16,185,129,0.3) 0%, transparent 60%)',
              borderBottomLeftRadius: '100%',
            }}
          />

          {/* Header com logo */}
          <div className="pt-6 sm:pt-10 pb-4 sm:pb-8 px-6 sm:px-12 text-center relative">
            <img 
              src="/logo-encontrão-2025.png" 
              alt="Logo Encontrão 2025" 
              className="max-w-[180px] sm:max-w-[250px] mx-auto h-auto mb-4 sm:mb-6"
              style={{
                filter: 'drop-shadow(0 6px 12px rgba(0,0,0,0.25))',
              }}
            />
            <h1 
              className="text-2xl sm:text-4xl font-bold mb-2"
              style={{
                color: '#065f46',
                textShadow: '0 2px 4px rgba(0,0,0,0.1)',
              }}
            >
              Caminhos Mágicos
            </h1>
            <p 
              className="text-base sm:text-lg"
              style={{ color: '#92400e' }}
            >
              Siga a estrada de tijolos amarelos
            </p>
          </div>

          {/* Divisor decorativo */}
          <div className="px-6 sm:px-12">
            <div 
              className="h-1 rounded-full"
              style={{
                background: 'linear-gradient(90deg, transparent, #daa520, #ffd700, #daa520, transparent)',
              }}
            />
          </div>

          {/* Corpo do formulário */}
          <div className="p-6 sm:p-12 pt-6 sm:pt-10">
            {error && (
              <div 
                className="mb-4 p-4 rounded-xl text-sm"
                style={{
                  background: 'rgba(220,38,38,0.1)',
                  border: '2px solid rgba(220,38,38,0.3)',
                  color: '#991b1b',
                }}
              >
                {error}
              </div>
            )}

            {/* Botão de Login com Google - PRIORIDADE - Tema Cidade Esmeralda */}
            <button
              type="button"
              onClick={async () => {
                setIsLoading(true)
                setError('')
                try {
                  await loginWithGoogle()
                } catch (err: any) {
                  setError(err.message || 'Erro ao seguir pelo Google')
                  setIsLoading(false)
                }
              }}
              disabled={isLoading}
              className="w-full rounded-2xl transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-4 sm:gap-5 mb-6 sm:mb-8 relative overflow-hidden group text-white-override"
              style={{
                height: '70px',
                minHeight: '70px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)',
                boxShadow: `
                  0 10px 35px rgba(16,185,129,0.5),
                  inset 0 2px 0 rgba(255,255,255,0.3),
                  inset 0 -3px 0 rgba(0,0,0,0.2)
                `,
                border: 'none',
              }}
              onMouseEnter={(e) => {
                if (!isLoading) {
                  e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)'
                  e.currentTarget.style.boxShadow = `
                    0 18px 50px rgba(16,185,129,0.6),
                    inset 0 2px 0 rgba(255,255,255,0.3),
                    inset 0 -3px 0 rgba(0,0,0,0.2)
                  `
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0) scale(1)'
                e.currentTarget.style.boxShadow = `
                  0 10px 35px rgba(16,185,129,0.5),
                  inset 0 2px 0 rgba(255,255,255,0.3),
                  inset 0 -3px 0 rgba(0,0,0,0.2)
                `
              }}
            >
              {/* Brilho decorativo */}
              <div 
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{
                  background: 'linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.2) 50%, transparent 70%)',
                  transform: 'translateX(-100%)',
                  animation: 'shimmer 2s infinite',
                }}
              />
              
              {/* Ícone do Google com cores originais */}
              <div 
                className="relative flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-xl"
                style={{
                  background: '#ffffff',
                  boxShadow: '0 3px 8px rgba(0,0,0,0.2)',
                }}
              >
                <svg className="w-6 h-6 sm:w-7 sm:h-7" viewBox="0 0 24 24">
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
              </div>
              
              <span 
                className="relative"
                style={{
                  fontSize: '20px',
                  fontWeight: '800',
                  letterSpacing: '0.5px',
                  color: '#ffffff',
                  textShadow: '0 2px 4px rgba(0,0,0,0.3)',
                }}
              >
                Seguir pelo Google
              </span>
            </button>

            {/* Botão secundário para email/senha */}
            {!showEmailForm && (
              <button
                type="button"
                onClick={() => setShowEmailForm(true)}
                className="w-full rounded-2xl transition-all duration-300 flex items-center justify-center gap-4 sm:gap-5"
                style={{
                  height: '70px',
                  minHeight: '70px',
                  background: 'rgba(255,255,255,0.95)',
                  border: '2px solid rgba(16,185,129,0.4)',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.08)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px) scale(1.02)'
                  e.currentTarget.style.borderColor = '#10b981'
                  e.currentTarget.style.boxShadow = '0 12px 30px rgba(16,185,129,0.25)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0) scale(1)'
                  e.currentTarget.style.borderColor = 'rgba(16,185,129,0.4)'
                  e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.08)'
                }}
              >
                <span style={{ fontSize: '28px' }}>📧</span>
                <span 
                  style={{
                    fontSize: '20px',
                    fontWeight: '700',
                    color: '#065f46',
                  }}
                >
                  Seguir com Email e Senha
                </span>
              </button>
            )}

            {/* Formulário de Email/Senha - Revelado quando showEmailForm é true */}
            {showEmailForm && (
              <>
                {/* Divisor "OU" */}
                <div className="relative my-6">
                  <div 
                    className="absolute inset-0 flex items-center"
                    style={{
                      borderTop: '2px solid rgba(218,165,32,0.3)',
                    }}
                  />
                  <div className="relative flex justify-center">
                    <span 
                      className="px-4 text-sm font-bold"
                      style={{ 
                        color: '#92400e',
                        background: 'linear-gradient(145deg, rgba(255,248,220,0.95) 0%, rgba(255,250,235,0.92) 50%, rgba(252,245,210,0.95) 100%)',
                      }}
                    >
                      ou
                    </span>
                  </div>
                </div>

                {/* Toggle Login/Registro */}
                <div 
                  className="flex mb-6 rounded-2xl p-1.5"
                  style={{
                    background: 'linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(5,150,105,0.1) 100%)',
                    border: '2px solid rgba(16,185,129,0.3)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setIsLogin(true)}
                    className="flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all duration-300"
                    style={{
                      background: isLogin 
                        ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' 
                        : 'transparent',
                      color: isLogin ? '#ffffff' : '#065f46',
                      boxShadow: isLogin ? '0 4px 15px rgba(16,185,129,0.4)' : 'none',
                    }}
                  >
                    🏰 Entrar
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsLogin(false)}
                    className="flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all duration-300"
                    style={{
                      background: !isLogin 
                        ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' 
                        : 'transparent',
                      color: !isLogin ? '#ffffff' : '#065f46',
                      boxShadow: !isLogin ? '0 4px 15px rgba(16,185,129,0.4)' : 'none',
                    }}
                  >
                    🎭 Registrar
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
              {/* Campo Nome (apenas para registro) */}
              {!isLogin && (
                <div>
                  <label 
                    htmlFor="name" 
                    className="block text-sm font-bold mb-2"
                    style={{ color: '#065f46' }}
                  >
                    👤 Nome
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required={!isLogin}
                    className="w-full px-4 py-3 rounded-xl transition-all duration-300"
                    style={{
                      background: 'rgba(255,255,255,0.8)',
                      border: '2px solid rgba(218,165,32,0.4)',
                      color: '#1a1a1a',
                      boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)',
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#10b981'
                      e.target.style.boxShadow = '0 0 0 3px rgba(16,185,129,0.2), inset 0 2px 4px rgba(0,0,0,0.05)'
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = 'rgba(218,165,32,0.4)'
                      e.target.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.05)'
                    }}
                    placeholder="Seu nome completo"
                  />
                </div>
              )}

              {/* Campo Email */}
              <div>
                <label 
                  htmlFor="email" 
                  className="block text-sm font-bold mb-2"
                  style={{ color: '#065f46' }}
                >
                  📧 Email
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl transition-all duration-300"
                  style={{
                    background: 'rgba(255,255,255,0.8)',
                    border: '2px solid rgba(218,165,32,0.4)',
                    color: '#1a1a1a',
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#10b981'
                    e.target.style.boxShadow = '0 0 0 3px rgba(16,185,129,0.2), inset 0 2px 4px rgba(0,0,0,0.05)'
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(218,165,32,0.4)'
                    e.target.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.05)'
                  }}
                  placeholder="seu@email.com"
                />
              </div>

              {/* Campo Senha */}
              <div>
                <label 
                  htmlFor="password" 
                  className="block text-sm font-bold mb-2"
                  style={{ color: '#065f46' }}
                >
                  🔑 Senha
                </label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl transition-all duration-300"
                  style={{
                    background: 'rgba(255,255,255,0.8)',
                    border: '2px solid rgba(218,165,32,0.4)',
                    color: '#1a1a1a',
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#10b981'
                    e.target.style.boxShadow = '0 0 0 3px rgba(16,185,129,0.2), inset 0 2px 4px rgba(0,0,0,0.05)'
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(218,165,32,0.4)'
                    e.target.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.05)'
                  }}
                  placeholder="••••••••"
                />
              </div>

              {/* Botão de Login/Registro - Estilo Tijolo Amarelo */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 rounded-xl font-bold text-lg transition-all duration-300 disabled:opacity-50 mt-2"
                style={{
                  background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #d97706 100%)',
                  color: '#78350f',
                  boxShadow: '0 4px 20px rgba(251,191,36,0.5), inset 0 2px 0 rgba(255,255,255,0.3), inset 0 -2px 0 rgba(0,0,0,0.1)',
                  textShadow: '0 1px 0 rgba(255,255,255,0.3)',
                  border: '2px solid #d97706',
                }}
                onMouseEnter={(e) => {
                  if (!isLoading) {
                    e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)'
                    e.currentTarget.style.boxShadow = '0 8px 30px rgba(251,191,36,0.6), inset 0 2px 0 rgba(255,255,255,0.3), inset 0 -2px 0 rgba(0,0,0,0.1)'
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0) scale(1)'
                  e.currentTarget.style.boxShadow = '0 4px 20px rgba(251,191,36,0.5), inset 0 2px 0 rgba(255,255,255,0.3), inset 0 -2px 0 rgba(0,0,0,0.1)'
                }}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin">✨</span>
                    {isLogin ? 'Entrando...' : 'Criando conta...'}
                  </span>
                ) : (
                  <>
                    {isLogin ? '👠 Seguir para a Cidade Esmeralda' : '🎭 Criar Minha Conta'}
                  </>
                )}
              </button>
                </form>

                {/* Botão para esconder formulário */}
                <div className="mt-4 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setShowEmailForm(false)
                      setError('')
                      setEmail('')
                      setPassword('')
                      setName('')
                    }}
                    className="text-sm font-medium transition-colors duration-200"
                    style={{ 
                      color: '#92400e', 
                      background: 'transparent',
                      border: 'none',
                      padding: '0',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = '#78350f'}
                    onMouseLeave={(e) => e.currentTarget.style.color = '#92400e'}
                  >
                    ← Voltar para login com Google
                  </button>
                </div>
              </>
            )}

            {/* Links adicionais - apenas quando formulário de email está visível */}
            {showEmailForm && (
              <div className="mt-6 text-center space-y-3">
                <a 
                  href="#" 
                  className="text-sm transition-colors duration-200 block font-medium"
                  style={{ color: '#92400e', background: 'transparent' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#78350f'}
                  onMouseLeave={(e) => e.currentTarget.style.color = '#92400e'}
                >
                  🧭 Esqueceu sua senha?
                </a>
                <div className="text-sm" style={{ color: '#065f46', background: 'transparent' }}>
                  {isLogin ? 'Não tem uma conta?' : 'Já tem uma conta?'}
                  <button 
                    onClick={() => setIsLogin(!isLogin)}
                    className="font-bold ml-1 transition-colors duration-200"
                    style={{ 
                      color: '#059669', 
                      background: 'transparent',
                      border: 'none',
                      padding: '0',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.color = '#047857'}
                    onMouseLeave={(e) => e.currentTarget.style.color = '#059669'}
                  >
                    {isLogin ? '🎭 Crie uma aqui' : '🏰 Faça login'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Decoração inferior com personagens */}
          <div 
            className="py-6 sm:py-8 px-6 sm:px-12 text-white-override"
            style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)',
            }}
          >
            {/* Elementos decorativos - Personagens do Oz */}
            <div className="flex justify-center items-center space-x-3 sm:space-x-6 text-3xl sm:text-5xl mb-3 sm:mb-5">
              <span className="animate-bounce" style={{ animationDelay: '0s' }}>👠</span>
              <span className="animate-bounce" style={{ animationDelay: '0.15s' }}>🦁</span>
              <span className="animate-bounce" style={{ animationDelay: '0.3s' }}>🤖</span>
              <span className="animate-bounce" style={{ animationDelay: '0.45s' }}>🌾</span>
              <span className="animate-bounce" style={{ animationDelay: '0.6s' }}>🧙‍♂️</span>
            </div>
            <p 
              className="text-center text-base sm:text-xl"
              style={{ 
                color: '#ffffff',
                fontWeight: '700',
                textShadow: '0 2px 4px rgba(0,0,0,0.3)',
              }}
            >
              "Não há lugar como o lar" 🏠✨
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login
