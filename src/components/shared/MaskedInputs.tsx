import React, { useState, useCallback, useRef, useEffect } from 'react'

// ============================================
// Utilitários de formatação
// ============================================

/**
 * Formata valor numérico para moeda brasileira
 * @param value Valor em centavos ou string
 * @returns String formatada (ex: "1.234,56")
 */
export function formatCurrency(value: number | string): string {
  const numericValue = typeof value === 'string' 
    ? parseFloat(value.replace(/\D/g, '')) / 100 
    : value
  
  if (isNaN(numericValue)) return '0,00'
  
  return numericValue.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/**
 * Extrai valor numérico de string formatada
 * @param formatted String formatada (ex: "1.234,56")
 * @returns Valor numérico (ex: 1234.56)
 */
export function parseCurrency(formatted: string): number {
  // Remove tudo exceto dígitos e vírgula/ponto
  const cleaned = formatted.replace(/[^\d,.-]/g, '')
  // Substitui vírgula por ponto e converte
  const normalized = cleaned.replace(',', '.')
  const value = parseFloat(normalized)
  return isNaN(value) ? 0 : value
}

/**
 * Formata CPF (11 dígitos): 000.000.000-00
 */
export function formatCpf(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`
}

/**
 * Formata CNPJ (14 dígitos): 00.000.000/0000-00
 */
export function formatCnpj(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14)
  if (digits.length <= 2) return digits
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`
}

/**
 * Formata CPF ou CNPJ automaticamente baseado no tamanho
 */
export function formatCpfCnpj(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.length <= 11) return formatCpf(digits)
  return formatCnpj(digits)
}

/**
 * Extrai apenas dígitos
 */
export function extractDigits(value: string): string {
  return value.replace(/\D/g, '')
}

// ============================================
// CurrencyInput - Campo de valor monetário
// ============================================

interface CurrencyInputProps {
  value: number // Valor em reais (ex: 5.99)
  onChange: (value: number) => void
  min?: number
  max?: number
  placeholder?: string
  disabled?: boolean
  className?: string
  id?: string
  'aria-label'?: string
}

export const CurrencyInput: React.FC<CurrencyInputProps> = ({
  value,
  onChange,
  min = 0,
  max = 999999.99,
  placeholder = '0,00',
  disabled = false,
  className = '',
  id,
  'aria-label': ariaLabel,
}) => {
  // Referência para controlar cursor
  const inputRef = useRef<HTMLInputElement>(null)
  
  // Estado interno para o texto exibido
  const [displayValue, setDisplayValue] = useState(() => 
    value > 0 ? formatCurrency(value) : ''
  )
  
  // Flag para evitar loops
  const isInternalChange = useRef(false)

  // Sincroniza valor externo -> display (apenas quando muda externamente)
  useEffect(() => {
    if (isInternalChange.current) {
      isInternalChange.current = false
      return
    }
    setDisplayValue(value > 0 ? formatCurrency(value) : '')
  }, [value])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value
    
    // Extrai apenas dígitos
    const digits = rawValue.replace(/\D/g, '')
    
    if (digits === '') {
      setDisplayValue('')
      isInternalChange.current = true
      onChange(0)
      return
    }
    
    // Converte para centavos e depois para reais
    const cents = parseInt(digits, 10)
    const reais = cents / 100
    
    // Valida limites
    if (reais > max) return
    
    // Formata para exibição
    const formatted = formatCurrency(reais)
    setDisplayValue(formatted)
    
    // Notifica mudança
    isInternalChange.current = true
    onChange(reais)
  }, [onChange, max])

  const handleBlur = useCallback(() => {
    // Valida mínimo no blur
    if (value < min) {
      isInternalChange.current = true
      onChange(min)
      setDisplayValue(formatCurrency(min))
    }
  }, [value, min, onChange])

  return (
    <div className="relative">
      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-semibold pointer-events-none">
        R$
      </span>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        id={id}
        aria-label={ariaLabel}
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        disabled={disabled}
        placeholder={placeholder}
        className={`w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl 
          focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 
          transition-colors text-xl font-bold
          disabled:bg-gray-100 disabled:cursor-not-allowed
          ${className}`}
      />
    </div>
  )
}

// ============================================
// CpfCnpjInput - Campo de CPF/CNPJ
// ============================================

interface CpfCnpjInputProps {
  value: string // Valor apenas dígitos
  onChange: (value: string) => void // Retorna apenas dígitos
  placeholder?: string
  disabled?: boolean
  className?: string
  id?: string
  'aria-label'?: string
  onValidate?: (isValid: boolean, type: 'cpf' | 'cnpj' | null) => void
}

export const CpfCnpjInput: React.FC<CpfCnpjInputProps> = ({
  value,
  onChange,
  placeholder = '000.000.000-00',
  disabled = false,
  className = '',
  id,
  'aria-label': ariaLabel,
  onValidate,
}) => {
  // Estado interno para o texto formatado
  const [displayValue, setDisplayValue] = useState(() => 
    value ? formatCpfCnpj(value) : ''
  )
  
  // Flag para evitar loops
  const isInternalChange = useRef(false)

  // Sincroniza valor externo -> display
  useEffect(() => {
    if (isInternalChange.current) {
      isInternalChange.current = false
      return
    }
    setDisplayValue(value ? formatCpfCnpj(value) : '')
  }, [value])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value
    
    // Extrai apenas dígitos
    const digits = extractDigits(rawValue)
    
    // Limita a 14 dígitos (CNPJ)
    const limitedDigits = digits.slice(0, 14)
    
    // Formata para exibição
    const formatted = formatCpfCnpj(limitedDigits)
    setDisplayValue(formatted)
    
    // Notifica mudança com apenas dígitos
    isInternalChange.current = true
    onChange(limitedDigits)
    
    // Valida se completo
    if (onValidate) {
      if (limitedDigits.length === 11) {
        onValidate(true, 'cpf')
      } else if (limitedDigits.length === 14) {
        onValidate(true, 'cnpj')
      } else {
        onValidate(false, null)
      }
    }
  }, [onChange, onValidate])

  // Determina tipo atual para placeholder dinâmico
  const digits = extractDigits(value)
  const currentType = digits.length > 11 ? 'cnpj' : 'cpf'
  const dynamicPlaceholder = currentType === 'cnpj' 
    ? '00.000.000/0000-00' 
    : placeholder

  return (
    <input
      type="text"
      inputMode="numeric"
      id={id}
      aria-label={ariaLabel}
      value={displayValue}
      onChange={handleChange}
      disabled={disabled}
      placeholder={dynamicPlaceholder}
      className={`w-full px-4 py-3 border-2 border-gray-200 rounded-xl 
        focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 
        transition-colors
        disabled:bg-gray-100 disabled:cursor-not-allowed
        ${className}`}
    />
  )
}

// ============================================
// Validadores
// ============================================

/**
 * Valida CPF (algoritmo oficial)
 */
export function isValidCpf(cpf: string): boolean {
  const digits = cpf.replace(/\D/g, '')
  
  if (digits.length !== 11) return false
  if (/^(\d)\1+$/.test(digits)) return false // Todos dígitos iguais
  
  // Calcula primeiro dígito verificador
  let sum = 0
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits[i]) * (10 - i)
  }
  let remainder = (sum * 10) % 11
  if (remainder === 10) remainder = 0
  if (remainder !== parseInt(digits[9])) return false
  
  // Calcula segundo dígito verificador
  sum = 0
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits[i]) * (11 - i)
  }
  remainder = (sum * 10) % 11
  if (remainder === 10) remainder = 0
  if (remainder !== parseInt(digits[10])) return false
  
  return true
}

/**
 * Valida CNPJ (algoritmo oficial)
 */
export function isValidCnpj(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, '')
  
  if (digits.length !== 14) return false
  if (/^(\d)\1+$/.test(digits)) return false
  
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  
  // Primeiro dígito
  let sum = 0
  for (let i = 0; i < 12; i++) {
    sum += parseInt(digits[i]) * weights1[i]
  }
  let remainder = sum % 11
  const digit1 = remainder < 2 ? 0 : 11 - remainder
  if (digit1 !== parseInt(digits[12])) return false
  
  // Segundo dígito
  sum = 0
  for (let i = 0; i < 13; i++) {
    sum += parseInt(digits[i]) * weights2[i]
  }
  remainder = sum % 11
  const digit2 = remainder < 2 ? 0 : 11 - remainder
  if (digit2 !== parseInt(digits[13])) return false
  
  return true
}

/**
 * Valida CPF ou CNPJ
 */
export function isValidCpfCnpj(value: string): { valid: boolean; type: 'cpf' | 'cnpj' | null } {
  const digits = value.replace(/\D/g, '')
  
  if (digits.length === 11) {
    return { valid: isValidCpf(digits), type: 'cpf' }
  }
  
  if (digits.length === 14) {
    return { valid: isValidCnpj(digits), type: 'cnpj' }
  }
  
  return { valid: false, type: null }
}

export default {
  CurrencyInput,
  CpfCnpjInput,
  formatCurrency,
  parseCurrency,
  formatCpfCnpj,
  extractDigits,
  isValidCpf,
  isValidCnpj,
  isValidCpfCnpj,
}

