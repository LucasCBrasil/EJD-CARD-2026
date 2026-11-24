// Máscara de telefone brasileiro: (11) 98765-4321 para celular, (11) 3456-7890 para fixo.
//
// Prefixos (+55, 0 + DDD, 0 + operadora) não são resolvidos enquanto a pessoa digita: no meio da digitação
// eles são ambíguos (55 também é DDD, e "0 21 11…" só se distingue de "0 11…" no fim). O campo mostra
// o prefixo como foi digitado e `toNationalDigits` resolve tudo no envio, quando o número está completo.

const onlyDigits = (value: string) => value.replace(/\D/g, '')

export function formatPhone(value: string) {
  const digits = onlyDigits(value).slice(0, 11)
  if (digits.length <= 2) return digits.length ? `(${digits}` : ''
  const split = digits.length === 11 ? 7 : 6
  if (digits.length <= split) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, split)}-${digits.slice(split)}`
}

// Número nacional: com 0 na frente (prefixo de discagem) fica sem máscara, até 0 + operadora + 11 dígitos.
function displayNational(digits: string) {
  if (digits.startsWith('0')) return digits.length <= 14 ? digits : null
  return digits.length <= 11 ? formatPhone(digits) : null
}

function display(plus: boolean, digits: string) {
  if (!plus) return displayNational(digits)
  if (!digits.startsWith('55')) return digits.length <= 15 ? `+${digits}` : null
  const rest = digits.slice(2)
  if (!rest) return '+55'
  const national = displayNational(rest)
  return national === null ? null : `+55 ${national}`
}

export type PhoneEdit = { value: string; caret: number }

/**
 * Aplica a edição do usuário ao campo mascarado.
 * Retorna null quando a edição deve ser recusada (número longo demais), mantendo o valor anterior.
 */
export function applyPhoneEdit(previous: string, next: string, caret: number, inputType = ''): PhoneEdit | null {
  const previousDigits = onlyDigits(previous)
  let digits = onlyDigits(next)
  let caretDigits = onlyDigits(next.slice(0, caret)).length

  // Apagar só um caractere da máscara ("-", ")" ou espaço) apaga o dígito vizinho.
  if (inputType.startsWith('delete') && digits === previousDigits && next.length < previous.length && next.includes('+') === previous.includes('+')) {
    if (inputType === 'deleteContentForward') digits = digits.slice(0, caretDigits) + digits.slice(caretDigits + 1)
    else if (caretDigits > 0) {
      digits = digits.slice(0, caretDigits - 1) + digits.slice(caretDigits)
      caretDigits--
    }
  }

  // 55 também é DDD (RS): sem "+", só vira código do país quando o número longo entra de uma vez (colado, preenchido).
  const typed = inputType === 'insertText'
  const plus = next.trimStart().startsWith('+') || (!typed && digits.length > 11 && digits.startsWith('55'))
  const value = display(plus, digits)
  if (value === null) return null

  let position = 0
  while (position < value.length && /[+(]/.test(value[position])) position++
  for (let seen = 0; position < value.length && seen < caretDigits; position++) {
    if (/\d/.test(value[position])) seen++
  }
  return { value, caret: position }
}

/** Resolve os prefixos e devolve DDD + número (10 ou 11 dígitos), ou null se o número não for válido. */
export function toNationalDigits(value: string): string | null {
  let digits = onlyDigits(value)
  const plus = value.trimStart().startsWith('+') || (digits.length > 11 && digits.startsWith('55'))
  if (plus) {
    if (!digits.startsWith('55')) return null
    digits = digits.slice(2)
  }
  // 0 + DDD ou 0 + operadora + DDD. DDD e código de operadora nunca começam com 0 ("00" é discagem internacional).
  digits = digits.replace(/^0(?:[1-9]\d)?(?=\d{10,11}$)/, '')
  // DDD + celular (9 + 8 dígitos) ou fixo (8 dígitos começando de 2 a 8). Recusa "55 11 98765-432", digitado sem o "+".
  return /^[1-9]{2}(?:9\d{8}|[2-8]\d{7})$/.test(digits) ? digits : null
}
