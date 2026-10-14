import React, { useEffect } from 'react'

export interface ToastProps {
  id: string
  type: 'success' | 'error' | 'info' | 'warning'
  title: string
  message: string
  duration?: number
  onClose: (id: string) => void
}

const Toast: React.FC<ToastProps> = ({
  id,
  type,
  title,
  message,
  duration = 5000,
  onClose
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(id)
    }, duration)

    return () => clearTimeout(timer)
  }, [id, duration, onClose])

  const getIcon = () => {
    switch (type) {
      case 'success':
        return '✅'
      case 'error':
        return '❌'
      case 'warning':
        return '⚠️'
      case 'info':
        return 'ℹ️'
      default:
        return 'ℹ️'
    }
  }

  const getColors = () => {
    switch (type) {
      case 'success':
        return 'border-green-700 bg-green-50 text-green-900'
      case 'error':
        return 'border-vagao-600 bg-vagao-50 text-vagao-800'
      case 'warning':
        return 'border-latao-500 bg-latao-50 text-latao-900'
      case 'info':
      default:
        return 'border-anil-700 bg-anil-50 text-anil-900'
    }
  }

  return (
    <div className={`toast-notification ${getColors()} rounded-xl shadow-bilhete border-2 border-l-8 p-4 mb-3 max-w-sm w-full transform transition-all duration-300 ease-in-out`} style={{ zIndex: 10000 }}>
      <div className="flex items-start">
        <div className="flex-shrink-0 text-xl mr-3">
          {getIcon()}
        </div>
        <div className="flex-1">
          <h4 className="font-display font-semibold text-base uppercase tracking-wide text-inherit" style={{ color: 'inherit' }}>
            {title}
          </h4>
          <p className="text-sm mt-1">
            {message}
          </p>
        </div>
        <button
          onClick={() => onClose(id)}
          className="flex-shrink-0 ml-2 !p-1 bg-transparent opacity-70 hover:opacity-100 transition-opacity text-xs leading-none"
          aria-label="Fechar notificação"
          title="Fechar"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

export default Toast
