import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../lib/api-client'

// (11) 98765-4321 para celular, (11) 3456-7890 para fixo
function formatPhone(value: string) {
  let digits = value.replace(/\D/g, '')
  if (digits.length > 11 && digits.startsWith('55')) digits = digits.slice(2) // número colado com +55
  digits = digits.slice(0, 11)
  if (digits.length <= 2) return digits.length ? `(${digits}` : ''
  const split = digits.length === 11 ? 7 : 6
  if (digits.length <= split) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, split)}-${digits.slice(split)}`
}

export default function ContactGate() {
  const { user, logout } = useAuth()
  const [state, setState] = useState<'loading' | 'required' | 'done' | 'error'>('loading')
  const [number, setNumber] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [attempt, setAttempt] = useState(0)

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
    const digits = number.replace(/\D/g, '')
    if (digits.length < 10 || digits.length > 11) { setError('Informe um número válido com DDD.'); return }
    setSaving(true)
    const result = await api.saveContact(digits)
    setSaving(false)
    if (result.success) setState('done')
    else setError(result.error || 'Não foi possível salvar. Tente novamente.')
  }
  return <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="contact-title">
    <div className="painel w-full max-w-md p-6 text-ferro-900">
      <h2 id="contact-title" className="text-xl font-display font-semibold uppercase">Contato de WhatsApp</h2>
      {state === 'loading' ? <p className="mt-3">Verificando informações de contato...</p> : state === 'error' ? <div className="mt-3"><p role="alert">Não foi possível verificar suas informações de contato.</p><button type="button" onClick={() => setAttempt(x => x + 1)}>Tentar novamente</button></div> : <form onSubmit={submit} className="mt-3 space-y-4">
        <p>Informe seu número de WhatsApp com DDD para continuar.</p>
        <label className="block">WhatsApp<input autoFocus type="tel" inputMode="numeric" autoComplete="tel-national" required placeholder="(11) 98765-4321" value={number} onChange={e => setNumber(formatPhone(e.target.value))} className="mt-1 w-full" /></label>
        {error && <p role="alert" className="text-vagao-700">{error}</p>}
        <button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar e continuar'}</button>
      </form>}
      {state !== 'loading' && <button type="button" className="mt-3" onClick={() => void logout()}>Sair</button>}
    </div>
  </div>
}
