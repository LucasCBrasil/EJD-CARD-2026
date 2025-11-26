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
    <header className={`text-center mb-12 ${className}`}>
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

      {/* Logo */}
      {showLogo && (
        <div className="mb-8">
          <img 
            src="/logo-encontrão-2025.png" 
            alt="Logo Encontrão 2025 - em CAMINHOZ MÁGICOS" 
            className="max-w-md mx-auto h-auto"
          />
        </div>
      )}

      {/* Título */}
      {title && (
        <h1 className="text-4xl md:text-5xl font-bold text-emerald-600 mb-4 font-cardinal">
          {title}
        </h1>
      )}

      {/* Subtítulo */}
      {subtitle && (
        <p className="text-xl text-black font-farmhand italic">
          {subtitle}
        </p>
      )}
    </header>
  )
}

export default Header