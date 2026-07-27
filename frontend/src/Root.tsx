import { useCallback, useEffect, useRef, useState } from 'react'
import App from '@/App'
import { useAuth } from '@/components/auth/AuthContext'
import { ChangePasswordForm } from '@/components/auth/ChangePasswordForm'
import { LoginScreen } from '@/components/auth/LoginScreen'
import { SplashIntro, STAGES_ANON, STAGES_AUTHED } from '@/components/shell/SplashIntro'

/**
 * Dueño de la intro y de qué se monta debajo.
 *
 * ```
 * #boot (ya pintado por index.html)
 *   └─ React monta → <Root> renderiza <SplashIntro> → borra #boot
 *       ├─ AuthProvider pide GET /api/auth/me   (1ª y única petición)
 *       ├─ 401              → <LoginScreen> montada DEBAJO del splash
 *       ├─ must_change      → <ChangePasswordForm> debajo del splash
 *       └─ sesión válida    → <App> debajo → refresh() (9 peticiones)
 * ```
 *
 * La intro se monta en TODOS los caminos, sin excepción: es el único sitio que
 * borra `#boot`, y esa capa tiene `z-index: 998`. Si algún camino se la saltara,
 * taparía la pantalla de login para siempre.
 */

/** Variante corta, para cuando no hay sesión que cargar. No se baja de ~1200 ms:
 *  el reloj de la intro cuenta desde `performance.timeOrigin`, o sea desde la
 *  navegación, y en un móvil lento el tiempo transcurrido ya puede valer 1,3 s
 *  cuando resuelve `/api/auth/me`. */
const SHORT = { minDuration: 1400, beat: 0.34, fill: '1.1s' } as const

/** Debe coincidir con la transición de `.auth-root.is-exiting` en index.css. */
const CURTAIN_FADE_MS = 320

export function Root() {
  const { status, user, login, logout, changePassword, retry } = useAuth()
  const [showSplash, setShowSplash] = useState(true)
  const [appBooted, setAppBooted] = useState(false)
  // Telón que tapa las nueve peticiones de `App` después de un login manual.
  // Se levanta ANTES de esperar a `login()` a propósito: si se levantara
  // después, entre que el estado pasa a 'authed' y que este `useState` corre
  // habría un render con el formulario ya desmontado y la app aún vacía — el
  // fotograma en blanco que se quiere evitar.
  const [curtain, setCurtain] = useState<'up' | 'fading' | null>(null)
  // Lo que se acaba de teclear en el login, para prerrellenar el cambio de
  // contraseña obligatorio. En memoria y solo eso: nunca toca localStorage.
  const justTyped = useRef('')

  const onBooted = useCallback(() => setAppBooted(true), [])

  const handleLogin = useCallback(
    async (email: string, password: string) => {
      setCurtain('up')
      try {
        await login(email, password)
        justTyped.current = password
      } catch (err) {
        setCurtain(null) // vuelve el formulario con su mensaje de error
        throw err
      }
    },
    [login],
  )

  // El telón empieza a caer cuando la app ya tiene datos, no cuando el login
  // responde.
  useEffect(() => {
    if (curtain === 'up' && appBooted) setCurtain('fading')
  }, [curtain, appBooted])

  // El desmontaje va en un efecto APARTE, con `curtain` como única dependencia.
  // Juntarlo con el de arriba deja el telón pegado para siempre: al pasar a
  // 'fading' el efecto se reejecuta, su limpieza cancela este mismo timer, y la
  // guarda de entrada ya no deja volver a programarlo. Es el mismo motivo por el
  // que `SplashIntro` separa `leaving` del temporizador del fundido.
  useEffect(() => {
    if (curtain !== 'fading') return
    const t = setTimeout(() => setCurtain(null), CURTAIN_FADE_MS)
    return () => clearTimeout(t)
  }, [curtain])

  const authed = status === 'authed'
  const checking = status === 'checking'
  const anon = status === 'anon' || status === 'error'
  const expired = status === 'expired'
  // Con el telón arriba el formulario sigue montado aunque ya haya sesión.
  const showLogin = anon || (authed && curtain !== null)

  const short = !checking && !authed
  const splash = {
    ready: authed ? appBooted : !checking,
    stages: authed || checking ? STAGES_AUTHED : STAGES_ANON,
    ...(short ? SHORT : {}),
  }

  return (
    <>
      {/* La app se monta como HERMANA del splash y debajo de él: cuando la intro
          se funde revela algo ya pintado, no un hueco.
          El `key` por usuario es obligatorio, no cosmético: al cambiar de
          persona remonta el subárbol e invalida la caché de fuerza
          (`useStrengthDashboard`), la serie de tendencias, el historial de
          navegación y el borrador de plan. Sin él, al entrenador se le
          enseñarían sus propios datos cacheados como si fueran del cliente. */}
      {(authed || expired) && <App key={user?.id ?? 'me'} onBooted={onBooted} />}

      {showLogin && (
        <LoginScreen
          onSubmit={handleLogin}
          exiting={curtain === 'fading'}
          notice={status === 'error' ? 'No se pudo contactar con el servidor.' : undefined}
          onRetry={status === 'error' ? retry : undefined}
        />
      )}

      {/* Sesión caída a mitad de uso: `App` sigue montada detrás con el borrador
          intacto y el login se pinta encima como capa. Desmontarla y volver a
          montarla evaporaría el plan a medio editar o la serie a medio anotar. */}
      {expired && (
        <LoginScreen onSubmit={handleLogin} overlay notice="La sesión ha caducado." />
      )}

      {status === 'must_change' && (
        <ChangePasswordForm
          onSubmit={changePassword}
          onLogout={logout}
          presetCurrent={justTyped.current}
        />
      )}

      {showSplash && (
        // `showSplash` es de un solo sentido: nace true y solo baja en `onDone`.
        // Nunca vuelve, así que hay como mucho una animación de arranque por
        // carga de página; el login usa el telón, no un segundo splash.
        <SplashIntro {...splash} onDone={() => setShowSplash(false)} />
      )}
    </>
  )
}
