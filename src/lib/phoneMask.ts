// Máscara de telefone brasileiro: (11) 98765-4321 para celular, (11) 3456-7890 para fixo.

const onlyDigits = (value: string) => value.replace(/\D/g, '')

export function formatPhone(value: string) {
  const digits = onlyDigits(value).slice(0, 11)
  if (digits.length <= 2) return digits.length ? `(${digits}` : ''
  const split = digits.length === 11 ? 7 : 6
  if (digits.length <= split) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, split)}-${digits.slice(split)}`
}

// DDD nunca começa com 0, então um 0 inicial (ou 0 + código de operadora) seguido de um número completo é prefixo de discagem.
const stripTrunkPrefix = (digits: string) => digits.replace(/^0(?:\d{2})?(?=\d{10,11}$)/, '')
// 55 também é DDD (RS), então só tratamos 55 como código do país quando o número entra de uma vez (colado ou preenchido).
const stripCountryCode = (digits: string) => digits.replace(/^55(?=0?\d{10,11}$)/, '')

export type PhoneEdit = { value: string; caret: number }

/**
 * Aplica a edição do usuário ao campo mascarado.
 * Retorna null quando a edição deve ser recusada (mais de 11 dígitos), mantendo o valor anterior.
 */
export function applyPhoneEdit(previous: string, next: string, caret: number, inputType = ''): PhoneEdit | null {
  const previousDigits = onlyDigits(previous)
  let digits = onlyDigits(next)
  let caretDigits = onlyDigits(next.slice(0, caret)).length

  // Apagar só um caractere da máscara ("-", ")" ou espaço) apaga o dígito vizinho.
  if (digits === previousDigits && next.length < previous.length) {
    if (inputType === 'deleteContentForward') digits = digits.slice(0, caretDigits) + digits.slice(caretDigits + 1)
    else if (caretDigits > 0) {
      digits = digits.slice(0, caretDigits - 1) + digits.slice(caretDigits)
      caretDigits--
    }
  }

  const enteredAtOnce = next.includes('+') || digits.length - previousDigits.length > 1
  const cleaned = stripTrunkPrefix(enteredAtOnce ? stripCountryCode(digits) : digits)
  if (cleaned.length > 11) return null
  caretDigits = Math.max(0, caretDigits - (digits.length - cleaned.length))

  const value = formatPhone(cleaned)
  let position = value.startsWith('(') ? 1 : 0
  for (let seen = 0; position < value.length && seen < caretDigits; position++) {
    if (/\d/.test(value[position])) seen++
  }
  return { value, caret: position }
}

export const isValidPhone = (value: string) => /^[1-9]{2}\d{8,9}$/.test(onlyDigits(value))
