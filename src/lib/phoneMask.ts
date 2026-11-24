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

// Prefixo de discagem nacional: 0 na maioria dos países, 0 ou 1 nos EUA/Canadá (DDD de lá nunca começa com 0 ou 1).
// Na Itália o 0 faz parte do número fixo, então fica.
function stripTrunkPrefix(ddi: string, digits: string) {
  if (ddi === '39') return digits
  return digits.replace(ddi === '1' ? /^[01]+/ : /^0+/, '')
}

// Número colado ou preenchido no campo todo: pode vir com DDI, com 0 de discagem ou com código de operadora.
// Um "+" de outro país troca o DDI selecionado; um país fora da lista é recusado.
function stripPastedPrefixes(ddi: string, digits: string, hasPlus: boolean): { ddi: string; digits: string } | null {
  let target = ddi
  let d = digits
  if (hasPlus) {
    if (!ddi || !d.startsWith(ddi)) {
      const match = DDI_OPTIONS.map(option => option.ddi).filter(code => d.startsWith(code)).sort((a, b) => b.length - a.length)[0]
      if (!match) return null
      target = match
    }
    d = d.slice(target.length)
  } else if (target === BRAZIL_DDI) {
    d = d.replace(/^0+/, '')
    if (d.length > 11 && d.startsWith(BRAZIL_DDI)) d = d.slice(2)
  } else if (d.startsWith(target) && d.length - target.length >= 8) {
    d = d.slice(target.length)
  }
  d = stripTrunkPrefix(target, d)
  // 0 + operadora (2 dígitos) + DDD + número: "0 21 11 98765-4321".
  if (target === BRAZIL_DDI && (d.length === 12 || d.length === 13)) d = d.slice(2)
  return { ddi: target, digits: d }
}

// Quantos dígitos entraram na edição: o que sobra depois do começo e do fim em comum.
function insertedDigits(before: string, after: string) {
  let start = 0
  while (start < before.length && start < after.length && before[start] === after[start]) start++
  let end = 0
  while (end < before.length - start && end < after.length - start && before[before.length - 1 - end] === after[after.length - 1 - end]) end++
  return after.length - start - end
}

/** `ddi` vem preenchido quando um número colado com "+" de outro país troca o DDI. */
export type PhoneEdit = { value: string; caret: number; ddi?: string }

/**
 * Aplica a edição do usuário ao campo do número.
 * Retorna null quando a edição deve ser recusada (número longo demais), mantendo o valor anterior.
 */
export function applyPhoneEdit(selectedDdi: string, previous: string, next: string, caret: number, inputType = ''): PhoneEdit | null {
  let ddi = selectedDdi
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

  // Colar ou preencher o campo todo limpa prefixos. Qualquer outra edição (digitar, teclado do Android,
  // autocompletar um dígito) segue a regra de digitar: só tira o 0 de discagem e recusa o que passar do limite.
  const replacedAll = inputType !== 'insertText' && !inputType.startsWith('delete') && (previousDigits === '' || insertedDigits(previousDigits, digits) > 1)
  if (replacedAll) {
    const pasted = stripPastedPrefixes(ddi, digits, next.trimStart().startsWith('+'))
    if (!pasted) return null
    if (pasted.digits !== digits || pasted.ddi !== ddi) caretDigits = pasted.digits.length
    ddi = pasted.ddi
    digits = pasted.digits
  } else {
    // Apagar só expõe dígitos que já estavam lá; nunca cria um 0 de discagem.
    const stripped = inputType.startsWith('delete') ? digits : stripTrunkPrefix(ddi, digits)
    caretDigits = Math.max(0, caretDigits - (digits.length - stripped.length))
    digits = stripped
  }
  if (digits.length > maxNationalLength(ddi)) return null

  const value = formatNational(ddi, digits)
  let position = value.startsWith('(') ? 1 : 0
  for (let seen = 0; position < value.length && seen < caretDigits; position++) {
    if (/\d/.test(value[position])) seen++
  }
  return ddi === selectedDdi ? { value, caret: position } : { value, caret: position, ddi }
}

/** DDI + número só com dígitos, pronto para salvar, ou null se o número não for válido. */
export function toStoredPhone(ddi: string, national: string): string | null {
  const digits = onlyDigits(national)
  if (!isValidDdi(ddi)) return null
  if (ddi === BRAZIL_DDI) {
    // DDD + celular (9 + 8 dígitos) ou fixo (8 dígitos começando de 2 a 8).
    return /^[1-9]{2}(?:9\d{8}|[2-8]\d{7})$/.test(digits) ? ddi + digits : null
  }
  // DDI digitado de novo no campo do número ("+351 912 345 678" com +351 selecionado).
  const local = digits.startsWith(ddi) && digits.length - ddi.length >= 8 ? digits.slice(ddi.length) : digits
  const full = ddi + local
  return full.length >= 10 && full.length <= 15 ? full : null
}
