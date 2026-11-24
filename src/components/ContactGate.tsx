import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../lib/api-client'
import { applyPhoneEdit, toNationalDigits } from '../lib/phoneMask'

export default function ContactGate() {
  const { user, logout } = useAuth()
  const [state, setState] = useState<'loading' | 'required' | 'done' | 'error'>('loading')
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
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const digits = toNationalDigits(number)
    if (!digits) { setError('Informe um número brasileiro válido com DDD.'); return }
    setSaving(true)
    const result = await api.saveContact(digits)
    setSaving(false)
    if (result.success) setState('done')
    else setError(result.error || 'Não foi possível salvar. Tente novamente.')
  }
  const handleNumberChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.target
    const edit = applyPhoneEdit(number, input.value, input.selectionStart ?? input.value.length, (event.nativeEvent as InputEvent).inputType)
    if (!edit) return
    setNumber(edit.value)
    requestAnimationFrame(() => inputRef.current?.setSelectionRange(edit.caret, edit.caret))
  }
  return <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="contact-title">
    <div className="painel w-full max-w-md p-6 text-ferro-900">
      <h2 id="contact-title" className="text-xl font-display font-semibold uppercase">Contato de WhatsApp</h2>
      {state === 'loading' ? <p className="mt-3">Verificando informações de contato...</p> : state === 'error' ? <div className="mt-3"><p role="alert">Não foi possível verificar suas informações de contato.</p><button type="button" onClick={() => setAttempt(x => x + 1)}>Tentar novamente</button></div> : <form onSubmit={submit} className="mt-3 space-y-4">
        <p>Informe seu número de WhatsApp com DDD para continuar.</p>
        <label className="block">WhatsApp<input ref={inputRef} autoFocus type="tel" inputMode="numeric" autoComplete="tel-national" required placeholder="(11) 98765-4321" value={number} onChange={handleNumberChange} className="mt-1 w-full" /></label>
        {error && <p role="alert" className="text-vagao-700">{error}</p>}
        <button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar e continuar'}</button>
      </form>}
      {state !== 'loading' && <button type="button" className="mt-3" onClick={() => void logout()}>Sair</button>}
    </div>
  </div>
}
