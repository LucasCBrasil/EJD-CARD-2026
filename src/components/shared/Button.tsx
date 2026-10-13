import React from 'react'

interface ButtonProps {
  children: React.ReactNode
  onClick?: React.MouseEventHandler<HTMLButtonElement>
  variant?: 'primary' | 'secondary' | 'outline'
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
}

const Button: React.FC<ButtonProps> = ({ 
  children, 
  onClick, 
  variant = 'primary', 
  size = 'md',
  className = '',
  type = 'button',
  disabled = false
}) => {
  const baseClasses = 'font-display font-semibold tracking-wide rounded-xl transition-all duration-200 shadow-sm hover:shadow-md active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-latao-400 focus-visible:ring-offset-2 focus-visible:ring-offset-creme-100'
  
  const variantClasses = {
    primary: 'bg-ferro-800 hover:bg-ferro-700 text-creme-200 border-2 border-ferro-800',
    secondary: 'bg-creme-200 hover:bg-creme-300 text-ferro-800 border-2 border-ferro-200',
    outline: 'bg-creme-50/80 border-2 border-ferro-800 text-ferro-800 hover:bg-ferro-800 hover:text-creme-200'
  }
  
  const sizeClasses = {
    xs: 'px-3 py-1.5 text-xs',
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg'
  }
  
  const classes = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`
  
  return (
    <button 
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${classes} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {children}
    </button>
  )
}

export default Button
