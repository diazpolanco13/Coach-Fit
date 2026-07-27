import { useRef, useState } from 'react'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { AuthLayout } from './AuthLayout'

const CARD = 'border-[color-mix(in_oklab,var(--splash-brand)_25%,transparent)] bg-black/40 backdrop-blur'
const MONO = 'font-mono text-[10px] tracking-[0.25em] text-[var(--splash-muted)] uppercase'

/** Mensaje del fallo, ya traducido a algo que se lee.
 *
 *  El 401 NUNCA dice cuál de los dos campos falla: decirlo confirma que un
 *  correo está dado de alta. */
function messageFor(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err)
  if (err instanceof TypeError) return 'No se pudo contactar con el servidor.'
  if (/credenciales/i.test(raw)) return 'Correo o contraseña incorrectos.'
  if (/demasiados intentos/i.test(raw)) return raw
  return raw
}

export function LoginScreen({
  onSubmit,
  overlay = false,
  exiting = false,
  notice,
  onRetry,
}: {
  onSubmit: (email: string, password: string) => Promise<void>
  overlay?: boolean
  /** El login acertó y la app ya cargó: la tarjeta se funde sobre ella. */
  exiting?: boolean
  /** Banner por encima del formulario (backend caído, sesión caducada). */
  notice?: string
  onRetry?: () => void
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  // Autofoco solo en escritorio: en el móvil el teclado saltando al cargar
  // empuja el layout entero.
  const isDesktop = useMediaQuery('(min-width: 768px)')

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (pending) return
    setPending(true)
    setError(null)
    try {
      await onSubmit(email.trim(), password)
      // No se baja `pending`: quien acierta se queda con el botón en curso
      // mientras la app monta y hace su refresh. Es lo que evita el frame en
      // blanco y la segunda animación de arranque.
    } catch (err) {
      setError(messageFor(err))
      setPassword('') // se conserva el correo, se vacía la contraseña
      setPending(false)
      passwordRef.current?.focus()
    }
  }

  return (
    <AuthLayout overlay={overlay} exiting={exiting}>
      <Card className={`w-full ${CARD}`}>
        <CardContent className="pt-6">
          {notice && (
            <div
              role="status"
              className="mb-4 flex items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              <span>{notice}</span>
              {onRetry && (
                <Button type="button" size="xs" variant="ghost" onClick={onRetry}>
                  Reintentar
                </Button>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="login-email" className={MONO}>
                Correo
              </Label>
              <Input
                id="login-email"
                // type="text" y no "email": las cuentas las crea el admin y no
                // tienen por qué ser un correo con formato válido.
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoFocus={isDesktop}
                aria-invalid={error ? true : undefined}
                disabled={pending}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="login-password" className={MONO}>
                Contraseña
              </Label>
              <div className="relative">
                <Input
                  id="login-password"
                  ref={passwordRef}
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="pr-9"
                  aria-invalid={error ? true : undefined}
                  disabled={pending}
                />
                {/* Imprescindible: la primera vez se teclea a mano una
                    contraseña temporal recibida por mensaje. */}
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  className="absolute top-1/2 right-1 -translate-y-1/2"
                  onClick={() => setShow((v) => !v)}
                  aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {show ? <EyeOff /> : <Eye />}
                </Button>
              </div>
            </div>

            {error && (
              <p role="alert" aria-live="polite" className="text-sm text-destructive">
                {error}
              </p>
            )}

            <Button
              type="submit"
              size="lg"
              className="w-full tracking-[0.2em]"
              disabled={pending || !email.trim() || !password}
            >
              {pending && <Loader2 className="animate-spin" />}
              {pending ? 'ENTRANDO...' : 'ENTRAR'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </AuthLayout>
  )
}
