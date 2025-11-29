import React, { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Switch,
  Paper,
  Alert,
  Skeleton,
  IconButton,
  Tooltip,
  Chip,
} from '@mui/material'
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
    <Box sx={{ borderTop: '1px solid #e5e7eb', pt: 3, mt: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#1f2937' }}>
          🚩 Feature Flags
        </Typography>
        <Tooltip title="Atualizar">
          <IconButton onClick={loadFlags} disabled={isLoading} size="small">
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Controle quais funcionalidades estão disponíveis no sistema.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {isLoading ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {[1, 2].map(i => (
            <Skeleton key={i} variant="rounded" height={80} />
          ))}
        </Box>
      ) : flags.length === 0 ? (
        <Alert severity="info">Nenhuma feature flag configurada.</Alert>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {flags.map(flag => {
            const config = flagConfig[flag.key] || { icon: '🏳️', label: flag.key, color: 'info' as const }
            const isUpdating = updatingFlag === flag.key

            return (
              <Paper
                key={flag.key}
                elevation={1}
                sx={{
                  p: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderLeft: 4,
                  borderColor: flag.enabled ? 'success.main' : 'grey.300',
                  transition: 'all 0.2s',
                  '&:hover': { boxShadow: 3 },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Typography variant="h5" sx={{ lineHeight: 1 }}>
                    {config.icon}
                  </Typography>
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      {config.label}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {flag.description || `Chave: ${flag.key}`}
                    </Typography>
                    {flag.updated_at && (
                      <Typography variant="caption" color="text.disabled">
                        Atualizado: {new Date(flag.updated_at).toLocaleString('pt-BR')}
                      </Typography>
                    )}
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Chip
                    label={flag.enabled ? 'Ativo' : 'Inativo'}
                    color={flag.enabled ? 'success' : 'default'}
                    size="small"
                    variant={flag.enabled ? 'filled' : 'outlined'}
                  />
                  <Switch
                    checked={flag.enabled}
                    onChange={() => toggleFlag(flag)}
                    disabled={isUpdating}
                    color="success"
                    sx={{
                      '& .MuiSwitch-switchBase.Mui-checked': {
                        color: '#10b981',
                      },
                      '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                        backgroundColor: '#10b981',
                      },
                    }}
                  />
                </Box>
              </Paper>
            )
          })}
        </Box>
      )}

      <Alert severity="warning" sx={{ mt: 3 }}>
        <strong>⚠️ Atenção:</strong> Alterações nas feature flags têm efeito imediato para todos os usuários.
      </Alert>
    </Box>
  )
}

export default FeatureFlagsManagement
