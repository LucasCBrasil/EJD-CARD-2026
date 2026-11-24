// Telefone com DDI separado: o seletor guarda o DDI (padrão 55) e o campo recebe só o número.
// Com DDI 55 o campo usa a máscara brasileira: (11) 98765-4321 para celular, (11) 3456-7890 para fixo.

export const BRAZIL_DDI = '55'

export const DDI_OPTIONS = [
  { ddi: '55', label: '🇧🇷 +55' },
  { ddi: '351', label: '🇵🇹 +351' },
  { ddi: '1', label: '🇺🇸 +1' },
  { ddi: '54', label: '🇦🇷 +54' },
  { ddi: '595', label: '🇵🇾 +595' },
  { ddi: '598', label: '🇺🇾 +598' },
  { ddi: '56', label: '🇨🇱 +56' },
  { ddi: '34', label: '🇪🇸 +34' },
  { ddi: '39', label: '🇮🇹 +39' },
  { ddi: '44', label: '🇬🇧 +44' },
  { ddi: '49', label: '🇩🇪 +49' },
  { ddi: '33', label: '🇫🇷 +33' },
]

const onlyDigits = (value: string) => value.replace(/\D/g, '')

export const isValidDdi = (ddi: string) => /^[1-9]\d{0,2}$/.test(ddi)

// E.164: DDI + número têm no máximo 15 dígitos.
const maxNationalLength = (ddi: string) => (ddi === BRAZIL_DDI ? 11 : Math.max(1, 15 - ddi.length))

export function formatBrazilPhone(value: string) {
  const digits = onlyDigits(value).slice(0, 11)
  if (digits.length <= 2) return digits.length ? `(${digits}` : ''
  const split = digits.length === 11 ? 7 : 6
  if (digits.length <= split) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, split)}-${digits.slice(split)}`
}

export const formatNational = (ddi: string, digits: string) =>
  ddi === BRAZIL_DDI ? formatBrazilPhone(digits) : onlyDigits(digits).slice(0, maxNationalLength(ddi))

// Um número colado ou preenchido pode vir com DDI, com 0 de discagem ou com código de operadora.
function stripPastedPrefixes(ddi: string, digits: string, hasPlus: boolean) {
  const max = maxNationalLength(ddi)
  if (ddi !== BRAZIL_DDI) return (hasPlus || digits.length > max) && digits.startsWith(ddi) ? digits.slice(ddi.length) : digits
  let d = digits.replace(/^0+/, '')
  if (d.length > 11 && d.startsWith(BRAZIL_DDI)) d = d.slice(2).replace(/^0+/, '')
  // 0 + operadora (2 dígitos) + DDD + número: "0 21 11 98765-4321".
  if (d.length === 12 || d.length === 13) d = d.slice(2)
  return d
}

export type PhoneEdit = { value: string; caret: number }

/**
 * Aplica a edição do usuário ao campo do número.
 * Retorna null quando a edição deve ser recusada (número longo demais), mantendo o valor anterior.
 */
export function applyPhoneEdit(ddi: string, previous: string, next: string, caret: number, inputType = ''): PhoneEdit | null {
  const previousDigits = onlyDigits(previous)
  let digits = onlyDigits(next)
  let caretDigits = onlyDigits(next.slice(0, caret)).length

  // Apagar só um caractere da máscara ("-", ")" ou espaço) apaga o dígito vizinho.
  if (inputType.startsWith('delete') && digits === previousDigits && next.length < previous.length) {
    if (inputType === 'deleteContentForward') digits = digits.slice(0, caretDigits) + digits.slice(caretDigits + 1)
    else if (caretDigits > 0) {
      digits = digits.slice(0, caretDigits - 1) + digits.slice(caretDigits)
      caretDigits--
    }
  }

  if (inputType === 'insertText') {
    // DDD nunca começa com 0: um 0 digitado no início é descartado.
    if (ddi === BRAZIL_DDI && digits.startsWith('0')) {
      const stripped = digits.replace(/^0+/, '')
      caretDigits = Math.max(0, caretDigits - (digits.length - stripped.length))
      digits = stripped
    }
  } else {
    const stripped = stripPastedPrefixes(ddi, digits, next.includes('+'))
    if (stripped !== digits) {
      digits = stripped
      caretDigits = digits.length
    }
  }
  if (digits.length > maxNationalLength(ddi)) return null

  const value = formatNational(ddi, digits)
  let position = value.startsWith('(') ? 1 : 0
  for (let seen = 0; position < value.length && seen < caretDigits; position++) {
    if (/\d/.test(value[position])) seen++
  }
  return { value, caret: position }
}

/** DDI + número só com dígitos, pronto para salvar, ou null se o número não for válido. */
export function toStoredPhone(ddi: string, national: string): string | null {
  const digits = onlyDigits(national)
  if (!isValidDdi(ddi)) return null
  if (ddi === BRAZIL_DDI) {
    // DDD + celular (9 + 8 dígitos) ou fixo (8 dígitos começando de 2 a 8).
    return /^[1-9]{2}(?:9\d{8}|[2-8]\d{7})$/.test(digits) ? ddi + digits : null
  }
  const full = ddi + digits
  return full.length >= 10 && full.length <= 15 ? full : null
}
