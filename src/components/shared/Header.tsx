import React from 'react'
import Button from './Button'

interface HeaderProps {
  title?: string
  subtitle?: string
  showLogo?: boolean
  showBackButton?: boolean
  onBack?: () => void
  backButtonText?: string
  className?: string
}

const Header: React.FC<HeaderProps> = ({ 
  title, 
  subtitle, 
  showLogo = true, 
  showBackButton = false,
  onBack,
  backButtonText = "← Voltar",
  className = ""
}) => {
  return (
    <header className={`text-center mb-8 ${className}`}>
      {/* Botão de voltar */}
      {showBackButton && onBack && (
        <div className="flex justify-start mb-6">
          <Button
            onClick={onBack}
            variant="outline"
            size="sm"
            className="border-emerald-500 !text-black hover:bg-emerald-200 hover:!text-black font-semibold font-cardinal shadow-md"
          >
            {backButtonText}
          </Button>
        </div>
      )}

      {/* Logo e Subtítulo */}
      {(showLogo || subtitle) && (
        <div 
          className="mx-auto max-w-md rounded-xl p-6"
          style={{
            background: '#ffffff',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          }}
        >
          {/* Logo */}
          {showLogo && (
            <div className="mb-4">
              <img 
                src="/logo-encontrão-2025.png" 
                alt="Logo Encontrão 2025" 
                className="max-w-[200px] sm:max-w-[240px] mx-auto h-auto"
              />
            </div>
          )}

          {/* Subtítulo */}
          {subtitle && (
            <p 
              className="text-center header-subtitle"
              style={{ 
                fontWeight: '700',
                fontSize: '16px',
                letterSpacing: '0.5px',
              }}
            >
              ✨ {subtitle} ✨
            </p>
          )}
        </div>
      )}

      {/* Título */}
      {title && (
        <h1 className="text-4xl md:text-5xl font-bold text-emerald-600 mb-4 font-cardinal mt-6">
          {title}
        </h1>
      )}
    </header>
  )
}

export default Header