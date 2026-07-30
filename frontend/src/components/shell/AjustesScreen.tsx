import { useEffect, useState } from 'react'
import { Images, Loader2, RefreshCw } from 'lucide-react'
import { useNav } from '@/components/shell/NavContext'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api, type RenphoIntegration } from '@/lib/api'
import {
  getAfterSet,
  getCheckInPref,
  getRestSeconds,
  getRestTimerEnabled,
  getSessionView,
  setAfterSet,
  setCheckInPref,
  setRestSeconds,
  setRestTimerEnabled,
  setSessionView,
  type AfterSetPref,
  type CheckInPref,
  type SessionViewPref,
} from '@/lib/settings'
import { cn } from '@/lib/utils'

function PrefRow<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { id: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            className={cn(
              'rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors',
              value === o.id
                ? 'border-primary bg-primary text-primary-foreground'
                : 'hover:bg-muted',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function formatSyncAt(raw: string | null): string {
  if (!raw) return 'Nunca'
  try {
    return new Date(raw).toLocaleString('es-VE', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return raw
  }
}

function RenphoCard({ onAfterSync }: { onAfterSync?: () => void | Promise<void> }) {
  const { navigate } = useNav()
  const [status, setStatus] = useState<RenphoIntegration | null>(null)
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState<'connect' | 'sync' | 'disconnect' | null>(null)
  const [error, setError] = useState('')
  const [okMsg, setOkMsg] = useState('')
  /** Tras un sync exitoso: muestra el acceso a Mediciones. */
  const [syncDone, setSyncDone] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const next = await api.getRenphoIntegration()
        if (!cancelled) setStatus(next)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err))
          setStatus({
            connected: false,
            email_masked: null,
            last_sync_at: null,
            last_sync_status: null,
            last_sync_detail: null,
          })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function connect(event: React.FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy('connect')
    setError('')
    setOkMsg('')
    try {
      const next = await api.connectRenpho({ email: email.trim(), password })
      setStatus(next)
      setPassword('')
      setOkMsg('Cuenta Renpho conectada.')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  async function syncNow() {
    if (busy) return
    setBusy('sync')
    setError('')
    setOkMsg('')
    setSyncDone(false)
    try {
      const result = await api.syncRenpho()
      setStatus(result.integration)
      const created = result.created ?? 0
      const updated = result.updated ?? 0
      const deleted = result.deleted ?? 0
      const fetched = result.fetched ?? result.imported
      setSyncDone(true)
      const parts: string[] = []
      if (created > 0) {
        parts.push(
          created === 1
            ? '1 medición nueva'
            : `${created} mediciones nuevas`,
        )
      }
      if (deleted > 0) {
        parts.push(
          deleted === 1
            ? '1 eliminada (ya no está en Renpho)'
            : `${deleted} eliminadas (ya no están en Renpho)`,
        )
      }
      if (parts.length) {
        setOkMsg(`Sync: ${parts.join('; ')}.`)
      } else if (fetched === 0) {
        setOkMsg('Renpho no devolvió mediciones.')
      } else {
        setOkMsg(
          updated > 0
            ? `Sin cambios (${updated} ya estaban al día).`
            : 'Sin cambios.',
        )
      }
      await onAfterSync?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  async function disconnect() {
    if (busy) return
    setBusy('disconnect')
    setError('')
    setOkMsg('')
    setSyncDone(false)
    try {
      const next = await api.disconnectRenpho()
      setStatus(next)
      setOkMsg('Renpho desconectado.')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Renpho</CardTitle>
        <CardDescription>
          Conecta tu cuenta de la báscula y sincroniza cuando quieras. Las
          credenciales se guardan cifradas en el servidor.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Cargando…
          </p>
        ) : status?.connected ? (
          <>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Cuenta</span>
                <strong className="truncate">{status.email_masked}</strong>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Última sync</span>
                <span>{formatSyncAt(status.last_sync_at)}</span>
              </div>
              {status.last_sync_status && (
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Estado</span>
                  <span
                    className={cn(
                      status.last_sync_status === 'ok'
                        ? 'text-foreground'
                        : 'text-destructive',
                    )}
                  >
                    {status.last_sync_status === 'ok' ? 'OK' : 'Error'}
                    {status.last_sync_detail ? ` · ${status.last_sync_detail}` : ''}
                  </span>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={syncNow} disabled={busy != null}>
                {busy === 'sync' ? (
                  <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
                ) : (
                  <RefreshCw className="size-4" data-icon="inline-start" />
                )}
                Sincronizar ahora
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={disconnect}
                disabled={busy != null}
              >
                {busy === 'disconnect' && (
                  <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
                )}
                Desconectar
              </Button>
            </div>
            {syncDone && (
              <Button
                type="button"
                variant="secondary"
                className="w-full sm:w-auto"
                onClick={() => navigate({ k: 'mediciones' })}
              >
                <Images className="size-4" data-icon="inline-start" />
                Ver mediciones
              </Button>
            )}
          </>
        ) : (
          <form className="space-y-3" onSubmit={connect}>
            <div className="space-y-1.5">
              <Label htmlFor="renpho-email">Email Renpho</Label>
              <Input
                id="renpho-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="renpho-password">Contraseña</Label>
              <Input
                id="renpho-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={busy != null || !email.trim() || !password}>
              {busy === 'connect' && (
                <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
              )}
              Conectar
            </Button>
          </form>
        )}

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        )}
        {okMsg && !error && (
          <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
            {okMsg}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function EntrenamientoPrefs() {
  const [rest, setRest] = useState(getRestSeconds())
  const [restOn, setRestOn] = useState(getRestTimerEnabled())
  const [view, setView] = useState<SessionViewPref>(getSessionView())
  const [afterSet, setAfter] = useState<AfterSetPref>(getAfterSet())
  const [checkIn, setCheckIn] = useState<CheckInPref>(getCheckInPref())

  return (
    <Card>
      <CardHeader>
        <CardTitle>Preferencias de entrenamiento</CardTitle>
        <CardDescription>Se guardan en este navegador.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <PrefRow
          label="Vista por defecto de la sesión"
          value={view}
          options={[
            { id: 'focus', label: 'Foco' },
            { id: 'list', label: 'Lista' },
          ]}
          onChange={(v) => {
            setView(v)
            setSessionView(v)
          }}
        />

        <PrefRow
          label="Tras completar una serie"
          value={afterSet}
          options={[
            { id: 'next', label: 'Seguir en orden' },
            { id: 'stay', label: 'Quedarse' },
            { id: 'strip', label: 'Elegir en la franja' },
          ]}
          onChange={(v) => {
            setAfter(v)
            setAfterSet(v)
          }}
        />

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <Label>Temporizador de descanso</Label>
            <button
              type="button"
              className={cn(
                'rounded-md border px-2.5 py-1 text-xs font-medium',
                restOn ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted',
              )}
              onClick={() => {
                const next = !restOn
                setRestOn(next)
                setRestTimerEnabled(next)
              }}
            >
              {restOn ? 'Activado' : 'Apagado'}
            </button>
          </div>
          {restOn && (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Duración</span>
                <span className="font-medium">{rest} s</span>
              </div>
              <Slider
                min={30}
                max={240}
                step={15}
                value={[rest]}
                onValueChange={([v]) => {
                  setRest(v)
                  setRestSeconds(v)
                }}
              />
            </>
          )}
        </div>

        <PrefRow
          label="Check-in al cerrar (ánimo / salud / energía)"
          value={checkIn}
          options={[
            { id: 'always', label: 'Siempre' },
            { id: 'touched', label: 'Solo si lo toqué' },
            { id: 'skip', label: 'Omitir' },
          ]}
          onChange={(v) => {
            setCheckIn(v)
            setCheckInPref(v)
          }}
        />

        <Separator />
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Regla de progresión</span>
          <strong>+peso si RPE ≤ 7</strong>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Coach</span>
          <strong>Gemma local · reglas de respaldo</strong>
        </div>
      </CardContent>
    </Card>
  )
}

/** Preferencias del dispositivo + integraciones.
 *
 *  El descanso entre series vive aquí y no en el plan a propósito: es comodidad
 *  de uso, y `TrainingMode` lo lee de forma síncrona al montar, sin esperar a
 *  ninguna petición. */
export function AjustesScreen({
  onAfterSync,
}: {
  /** Recarga la lista de mediciones en App tras un sync exitoso. */
  onAfterSync?: () => void | Promise<void>
} = {}) {
  return (
    <div className="space-y-4">
      <Tabs defaultValue="entrenamiento">
        <TabsList className="w-full max-w-md">
          <TabsTrigger value="entrenamiento">Entrenamiento</TabsTrigger>
          <TabsTrigger value="sincronizaciones">Sincronizaciones</TabsTrigger>
        </TabsList>
        <TabsContent value="entrenamiento" className="mt-4">
          <EntrenamientoPrefs />
        </TabsContent>
        <TabsContent value="sincronizaciones" className="mt-4 space-y-4">
          <RenphoCard onAfterSync={onAfterSync} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
