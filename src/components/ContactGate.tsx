import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../lib/api-client'

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
    if (digits.length < 10 || digits.length > 15) { setError('Informe um número válido com DDD.'); return }
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
        <label className="block">WhatsApp<input autoFocus type="tel" autoComplete="tel" required maxLength={25} value={number} onChange={e => setNumber(e.target.value)} className="mt-1 w-full" /></label>
        {error && <p role="alert" className="text-vagao-700">{error}</p>}
        <button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar e continuar'}</button>
      </form>}
      {state !== 'loading' && <button type="button" className="mt-3" onClick={() => void logout()}>Sair</button>}
    </div>
  </div>
}
