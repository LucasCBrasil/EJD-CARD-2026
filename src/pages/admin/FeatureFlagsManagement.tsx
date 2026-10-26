import React, { useState, useEffect } from 'react'
import RefreshIcon from '@mui/icons-material/Refresh'
import { useAuth } from '../../contexts/AuthContext'

interface FeatureFlag {
  key: string
  enabled: boolean
  description?: string
  updated_at?: string
}

// Helper para URL das Edge Functions
function getSupabaseFunctionsUrl(): string {
  const envFunctionsUrl = (import.meta as any).env?.VITE_SUPABASE_FUNCTIONS_URL
  const envSupabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL
  if (envFunctionsUrl) return envFunctionsUrl
  if (envSupabaseUrl) return `${envSupabaseUrl}/functions/v1`
  return '/functions/v1'
}

// Configuração visual das flags
const flagConfig: Record<string, { icon: string; label: string; color: 'success' | 'warning' | 'info' | 'error' }> = {
  pix_enabled: { icon: '💳', label: 'Abastecimento via PIX', color: 'success' },
  lanchonete_self_order: { icon: '🍔', label: 'Pedidos da Lanchonete pelo app', color: 'success' },
}

const FeatureFlagsManagement: React.FC = () => {
  const { getAccessToken } = useAuth()
  const [flags, setFlags] = useState<FeatureFlag[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatingFlag, setUpdatingFlag] = useState<string | null>(null)

  const loadFlags = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const functionsBase = getSupabaseFunctionsUrl()
      const anonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY

      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (anonKey) headers['apikey'] = anonKey

      const res = await fetch(`${functionsBase}/feature-flags`, { headers })
      const json = await res.json()

      if (json.success && json.data) {
        setFlags(json.data)
      } else {
        setError(json.error || 'Erro ao carregar flags')
      }
    } catch (err: any) {
      setError(err?.message || 'Erro de conexão')
    } finally {
      setIsLoading(false)
    }
  }

  const toggleFlag = async (flag: FeatureFlag) => {
    // Obter token atualizado
    const accessToken = await getAccessToken()
    
    if (!accessToken) {
      setError('Sessão expirada. Faça login novamente.')
      return
    }

    setUpdatingFlag(flag.key)
    setError(null)

    try {
      const functionsBase = getSupabaseFunctionsUrl()
      const anonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      }
      if (anonKey) headers['apikey'] = anonKey

      const res = await fetch(`${functionsBase}/feature-flags`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          key: flag.key,
          enabled: !flag.enabled,
        }),
      })

      const json = await res.json()

      if (json.success && json.data) {
        setFlags(prev =>
          prev.map(f =>
            f.key === flag.key ? { ...f, enabled: json.data.enabled, updated_at: new Date().toISOString() } : f
          )
        )
      } else {
        setError(json.error || 'Erro ao atualizar flag')
      }
    } catch (err: any) {
      setError(err?.message || 'Erro de conexão')
    } finally {
      setUpdatingFlag(null)
    }
  }

  useEffect(() => {
    loadFlags()
  }, [])

  return (
    <section className="border-t-2 border-dashed border-ferro-200 pt-6 mt-6">
      <div className="flex items-center justify-between gap-3 mb-1">
        <h3 className="text-lg font-display font-semibold uppercase tracking-wide text-ferro-800">
          Feature Flags
        </h3>
        <button
          type="button"
          onClick={loadFlags}
          disabled={isLoading}
          title="Atualizar"
          aria-label="Atualizar"
          className="!p-0 w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-creme-200 hover:bg-creme-300 text-ferro-800 border border-ferro-200 disabled:opacity-50 transition-colors"
        >
          <RefreshIcon fontSize="small" className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      <p className="text-sm text-ferro-500 mb-4">
        Controle quais funcionalidades estão disponíveis no sistema.
      </p>

      {error && (
        <div role="alert" className="mb-3 rounded-xl border border-vagao-200 bg-vagao-50 px-4 py-3 text-sm text-vagao-700">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[1, 2].map(i => (
            <div key={i} className="h-20 rounded-xl bg-creme-200 border border-ferro-200 animate-pulse" />
          ))}
        </div>
      ) : flags.length === 0 ? (
        <div className="rounded-xl border border-anil-200 bg-anil-100/60 px-4 py-3 text-sm text-anil-800">
          Nenhuma feature flag configurada.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {flags.map(flag => {
            const config = flagConfig[flag.key] || { icon: '🏳️', label: flag.key, color: 'info' as const }
            const isUpdating = updatingFlag === flag.key

            return (
              <div
                key={flag.key}
                className={`flex items-center justify-between gap-3 rounded-xl bg-creme-100 border border-ferro-200 border-l-4 p-3 sm:p-4 transition-all hover:shadow-bilhete ${
                  flag.enabled ? '!border-l-green-600' : '!border-l-fumaca-400'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-2xl leading-none shrink-0">{config.icon}</span>
                  <div className="min-w-0">
                    <div className="font-display font-semibold text-ferro-900 leading-tight">{config.label}</div>
                    <div className="text-sm text-ferro-500 break-words">{flag.description || `Chave: ${flag.key}`}</div>
                    {flag.updated_at && (
                      <div className="text-xs text-ferro-400">
                        Atualizado: {new Date(flag.updated_at).toLocaleString('pt-BR')}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 shrink-0">
                  <span
                    className={`carimbo text-[11px] !rotate-0 ${
                      flag.enabled ? 'text-green-700' : 'text-fumaca-500'
                    }`}
                  >
                    {flag.enabled ? 'Ativo' : 'Inativo'}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={flag.enabled}
                    aria-label={config.label}
                    onClick={() => toggleFlag(flag)}
                    disabled={isUpdating}
                    className={`!p-0 relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border-2 transition-colors disabled:opacity-50 ${
                      flag.enabled ? 'bg-green-600 border-green-700' : 'bg-fumaca-200 border-fumaca-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 rounded-full bg-creme-50 shadow transition-transform ${
                        flag.enabled ? 'translate-x-[22px]' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-4 rounded-xl border border-latao-300 bg-latao-50 px-4 py-3 text-sm text-latao-900">
        <strong>⚠️ Atenção:</strong> Alterações nas feature flags têm efeito imediato para todos os usuários.
      </div>
    </section>
  )
}

export default FeatureFlagsManagement
