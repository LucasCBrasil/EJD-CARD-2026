/**
 * Utilitários para manipulação segura de valores monetários
 * 
 * PROBLEMA: JavaScript usa IEEE 754 floats que NÃO são precisos para dinheiro
 * Exemplo: 0.1 + 0.2 = 0.30000000000000004
 * 
 * SOLUÇÃO: Converter para centavos (inteiros), operar, e converter de volta
 */

/**
 * Converte valor em reais para centavos (inteiro)
 * R$ 10.50 -> 1050
 */
export function toCents(value: number | string): number {
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return 0
  // Multiplica e arredonda para evitar erros de float
  return Math.round(num * 100)
}

/**
 * Converte centavos para reais
 * 1050 -> 10.50
 */
export function toReais(cents: number): number {
  return cents / 100
}

/**
 * Soma valores monetários de forma segura
 * safeSumMoney(10.50, 5.30) -> 15.80
 */
export function safeSumMoney(...values: (number | string)[]): number {
  const totalCents = values.reduce<number>((sum, val) => {
    return sum + toCents(val)
  }, 0)
  return toReais(totalCents)
}

/**
 * Subtrai valores monetários de forma segura
 * safeSubtractMoney(10.50, 5.30) -> 5.20
 */
export function safeSubtractMoney(a: number | string, b: number | string): number {
  const aCents = toCents(a)
  const bCents = toCents(b)
  return toReais(aCents - bCents)
}

/**
 * Multiplica valor monetário de forma segura
 * safeMultiplyMoney(10.50, 3) -> 31.50
 */
export function safeMultiplyMoney(value: number | string, multiplier: number): number {
  const cents = toCents(value)
  return toReais(Math.round(cents * multiplier))
}

/**
 * Arredonda valor monetário para 2 casas decimais
 * Útil para sanitizar valores antes de salvar no banco
 */
export function roundMoney(value: number | string): number {
  return toReais(toCents(value))
}

/**
 * Formata valor para exibição em BRL
 * formatMoney(10.5) -> "R$ 10,50"
 */
export function formatMoney(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return 'R$ 0,00'
  return `R$ ${num.toFixed(2).replace('.', ',')}`
}

/**
 * Compara dois valores monetários
 * Retorna: -1 se a < b, 0 se a == b, 1 se a > b
 */
export function compareMoney(a: number | string, b: number | string): -1 | 0 | 1 {
  const aCents = toCents(a)
  const bCents = toCents(b)
  if (aCents < bCents) return -1
  if (aCents > bCents) return 1
  return 0
}

/**
 * Verifica se valor é suficiente para débito
 */
export function hasSufficientBalance(balance: number | string, debit: number | string): boolean {
  return toCents(balance) >= toCents(debit)
}
