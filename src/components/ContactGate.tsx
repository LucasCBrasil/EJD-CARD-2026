import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../lib/api-client'
import { BRAZIL_DDI, DDI_OPTIONS, applyPhoneEdit, formatNational, toStoredPhone } from '../lib/phoneMask'

const OTHER_DDI = 'outro'

export default function ContactGate() {
  const { user, logout } = useAuth()
  const [state, setState] = useState<'loading' | 'required' | 'done' | 'error'>('loading')
  const [ddiChoice, setDdiChoice] = useState(BRAZIL_DDI)
  const [customDdi, setCustomDdi] = useState('')
  const [number, setNumber] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!user?.id) return
    let active = true
    setState('loading')
    api.getContactStatus().then(result => {
      if (!active) return
      setState(!result.success || !result.data ? 'error' : result.data.required && !result.data.whatsapp ? 'required' : 'done')
    })
    return () => { active = false }
  }, [user?.id, attempt])

  if (!user || state === 'done') return null
  const ddi = ddiChoice === OTHER_DDI ? customDdi : ddiChoice
  const isBrazil = ddi === BRAZIL_DDI
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const digits = toStoredPhone(ddi, number)
    if (!digits) { setError(isBrazil ? 'Informe um número válido com DDD, como (11) 98765-4321.' : 'Informe o DDI e o número completo.'); return }
    setSaving(true)
    const result = await api.saveContact(digits)
    setSaving(false)
    if (result.success) setState('done')
    else setError(result.error || 'Não foi possível salvar. Tente novamente.')
  }
  const handleNumberChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.target
    const edit = applyPhoneEdit(ddi, number, input.value, input.selectionStart ?? input.value.length, (event.nativeEvent as InputEvent).inputType)
    if (!edit) return
    setNumber(edit.value)
    requestAnimationFrame(() => inputRef.current?.setSelectionRange(edit.caret, edit.caret))
  }
  // Trocar o DDI refaz a máscara do número já digitado.
  const changeDdi = (choice: string, custom = customDdi) => {
    setDdiChoice(choice)
    setCustomDdi(custom)
    setNumber(formatNational(choice === OTHER_DDI ? custom : choice, number))
    setError('')
  }
  return <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="contact-title">
    <div className="painel w-full max-w-md p-6 text-ferro-900">
      <h2 id="contact-title" className="text-xl font-display font-semibold uppercase">Contato de WhatsApp</h2>
      {state === 'loading' ? <p className="mt-3">Verificando informações de contato...</p> : state === 'error' ? <div className="mt-3"><p role="alert">Não foi possível verificar suas informações de contato.</p><button type="button" onClick={() => setAttempt(x => x + 1)}>Tentar novamente</button></div> : <form onSubmit={submit} className="mt-3 space-y-4">
        <p>Informe seu número de WhatsApp com DDD para continuar.</p>
        <div>
          <label htmlFor="contact-number" className="block">WhatsApp</label>
          <div className="mt-1 flex gap-2">
            <select aria-label="DDI do país" value={ddiChoice} onChange={e => changeDdi(e.target.value)} className="w-28 shrink-0 text-ferro-900">
              {DDI_OPTIONS.map(option => <option key={option.ddi} value={option.ddi}>{option.label}</option>)}
              <option value={OTHER_DDI}>Outro</option>
            </select>
            {ddiChoice === OTHER_DDI && <input aria-label="DDI" type="tel" inputMode="numeric" required placeholder="+DDI" value={customDdi ? `+${customDdi}` : ''} onChange={e => changeDdi(OTHER_DDI, e.target.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 3))} className="w-20 shrink-0" />}
            <input id="contact-number" ref={inputRef} autoFocus type="tel" inputMode="numeric" autoComplete="tel-national" required placeholder={isBrazil ? '(11) 98765-4321' : 'Número'} value={number} onChange={handleNumberChange} className="min-w-0 flex-1" />
          </div>
        </div>
        {error && <p role="alert" className="text-vagao-700">{error}</p>}
        <button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar e continuar'}</button>
      </form>}
      {state !== 'loading' && <button type="button" className="mt-3" onClick={() => void logout()}>Sair</button>}
    </div>
  </div>
}
