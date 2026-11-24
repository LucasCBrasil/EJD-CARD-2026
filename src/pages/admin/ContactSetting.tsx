import { useEffect, useState } from 'react'
import { api } from '../../lib/api-client'

export default function ContactSetting() {
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [securityEnabled, setSecurityEnabled] = useState(true)
  const [securityBusy, setSecurityBusy] = useState(true)
  const [securityError, setSecurityError] = useState('')
  useEffect(() => { api.getFeatureFlag('require_whatsapp_contact').then(result => { if (result.success) setEnabled(result.data.enabled); else setError('Não foi possível carregar a configuração.'); setBusy(false) }) }, [])
  useEffect(() => { api.getFeatureFlag('require_security_code').then(result => { if (result.success) setSecurityEnabled(result.data.enabled); else setSecurityError('Não foi possível carregar a configuração do código.'); setSecurityBusy(false) }) }, [])
  const change = async (value: boolean) => {
    setBusy(true); setError('')
    const result = await api.updateFeatureFlag('require_whatsapp_contact', value)
    if (result.success) setEnabled(result.data.enabled)
    else setError('Não foi possível salvar a configuração.')
    setBusy(false)
  }
  const changeSecurity = async (value: boolean) => {
    setSecurityBusy(true); setSecurityError('')
    const result = await api.updateFeatureFlag('require_security_code', value)
    if (result.success) setSecurityEnabled(result.data.enabled)
    else setSecurityError('Não foi possível salvar a configuração do código.')
    setSecurityBusy(false)
  }
  return <div className="border-t-2 border-dashed border-ferro-200 pt-6 mt-6">
    <label className="flex items-center gap-3 text-ferro-900"><input type="checkbox" checked={enabled} disabled={busy} onChange={e => void change(e.target.checked)} /> Receber informações de contato de todos os usuários</label>
    <p className="text-sm text-ferro-500 mt-2">Ao ativar, usuários sem WhatsApp cadastrado deverão informá-lo ao entrar.</p>
    {error && <p role="alert" className="text-vagao-700 mt-2">{error}</p>}
    <label className="flex items-center gap-3 text-ferro-900 mt-5"><input type="checkbox" checked={securityEnabled} disabled={securityBusy} onChange={e => void changeSecurity(e.target.checked)} /> Exigir código de segurança</label>
    <p className="text-sm text-ferro-500 mt-2">Ao ativar, operações de crédito e débito exigirão os quatro últimos dígitos do WhatsApp do usuário.</p>
    {securityError && <p role="alert" className="text-vagao-700 mt-2">{securityError}</p>}
  </div>
}
