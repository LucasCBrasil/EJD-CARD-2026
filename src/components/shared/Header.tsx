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
    <header className={`text-center mb-6 ${className}`}>
      {showBackButton && onBack && (
        <div className="flex justify-start mb-6">
          <Button onClick={onBack} variant="outline" size="sm">
            {backButtonText}
          </Button>
        </div>
      )}

      {(showLogo || subtitle) && (
        <div className="mx-auto max-w-md flex flex-col items-center">
          {showLogo && (
            <img 
              src="/logos/web/trenzinho.webp" 
              alt="Encontrão EJD 25 Anos - Trilhos e Destinos" 
              className="w-[120px] sm:w-[140px] h-auto drop-shadow-[0_6px_10px_rgba(72,36,12,0.25)]"
            />
          )}

          {subtitle && (
            <div className="w-full mt-3">
              <div className="trilho w-full" />
              <p className="header-subtitle text-center text-sm sm:text-base mt-2">
                {subtitle}
              </p>
            </div>
          )}
        </div>
      )}

      {title && (
        <h1 className="text-2xl sm:text-4xl md:text-5xl font-semibold text-ferro-800 mb-4 font-display uppercase mt-6">
          {title}
        </h1>
      )}
    </header>
  )
}

export default Header
