import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthLayout } from './AuthLayout'

/** Debe coincidir con auth.PASSWORD_MIN_CHARS del backend. Se enseña como pista
 *  bajo el campo, no solo como error después de fallar. */
const MIN_CHARS = 10

const CARD = 'border-[color-mix(in_oklab,var(--splash-brand)_25%,transparent)] bg-black/40 backdrop-blur'
const MONO = 'font-mono text-[10px] tracking-[0.25em] text-[var(--splash-muted)] uppercase'

export function ChangePasswordForm({
  onSubmit,
  onLogout,
  variant = 'onboarding',
  /** Lo que se acaba de teclear en el login, pasado EN MEMORIA (nunca a
   *  localStorage). Es la diferencia entre un primer acceso de diez segundos y
   *  uno de sesenta con la temporal copiada de un mensaje. */
  presetCurrent = '',
}: {
  onSubmit: (current: string, next: string) => Promise<void>
  onLogout?: () => void
  variant?: 'onboarding' | 'settings'
  presetCurrent?: string
}) {
  const [current, setCurrent] = useState(presetCurrent)
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Validación de cliente para no gastar un viaje; el servidor sigue mandando y
  // si discrepa se pinta su mensaje.
  const localError =
    next && next.length < MIN_CHARS
      ? `La contraseña debe tener al menos ${MIN_CHARS} caracteres.`
      : next && next === current
        ? 'La contraseña nueva debe ser distinta de la actual.'
        : confirm && next !== confirm
          ? 'Las dos contraseñas no coinciden.'
          : null

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (pending || localError) return
    setPending(true)
    setError(null)
    try {
      await onSubmit(current, next)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setPending(false)
    }
  }

  const form = (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cp-current" className={MONO}>
          Contraseña actual
        </Label>
        <Input
          id="cp-current"
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          autoComplete="current-password"
          disabled={pending}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cp-next" className={MONO}>
          Contraseña nueva
        </Label>
        <Input
          id="cp-next"
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          autoComplete="new-password"
          disabled={pending}
        />
        <p className="text-xs text-muted-foreground">Mínimo {MIN_CHARS} caracteres.</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cp-confirm" className={MONO}>
          Repite la nueva
        </Label>
        <Input
          id="cp-confirm"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          disabled={pending}
        />
      </div>

      {(localError || error) && (
        <p role="alert" aria-live="polite" className="text-sm text-destructive">
          {localError || error}
        </p>
      )}

      <Button
        type="submit"
        size="lg"
        className="w-full tracking-[0.2em]"
        disabled={pending || !current || !next || !confirm || Boolean(localError)}
      >
        {pending && <Loader2 className="animate-spin" />}
        {pending ? 'GUARDANDO...' : 'GUARDAR'}
      </Button>

      {/* Sin «saltar», pero tampoco una trampa: quien entró con la cuenta
          equivocada tiene que poder salir. */}
      {onLogout && (
        <Button type="button" variant="ghost" size="sm" onClick={onLogout} disabled={pending}>
          Cerrar sesión
        </Button>
      )}
    </form>
  )

  if (variant === 'settings') return form

  return (
    <AuthLayout>
      <Card className={`w-full ${CARD}`}>
        <CardContent className="pt-6">
          <p className="mb-1 font-mono text-xs tracking-[0.25em] text-[var(--splash-brand)] uppercase">
            Cambia tu contraseña
          </p>
          <p className="mb-4 text-sm text-muted-foreground">
            Tu contraseña es temporal. Elige una nueva para continuar.
          </p>
          {form}
        </CardContent>
      </Card>
    </AuthLayout>
  )
}
