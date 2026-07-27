import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'

/**
 * Intro de arranque. Cubre el hueco entre que el bundle monta y que
 * `refresh()` resuelve sus nueve peticiones: sin esto la primera carga —y cada
 * recarga— enseña el shell vacío.
 *
 * Sin dependencias: todo son keyframes de `index.css` con prefijo `splash-`.
 * `framer-motion` no está en el proyecto y no vale la pena meterlo por 3s de
 * animación.
 *
 * El logo es el mismo `Dumbbell` de lucide que usa el Sidebar. Aparece completo
 * desde el primer paint; los anillos son los que comunican que sigue cargando.
 */

/** Etapas con sesión: mientras se ven, `refresh()` está trayendo esos datos.
 *
 *  La primera dice la verdad desde que existe el login: antes ponía
 *  «ESTABLECIENDO SESIÓN...» sin establecer nada. Ahora `Root` pide
 *  `/api/auth/me` justo debajo. */
export const STAGES_AUTHED = [
  'VERIFICANDO SESIÓN...',
  'CARGANDO PLAN DE LA SEMANA...',
  'SINCRONIZANDO MEDICIONES...',
  'LISTO',
]

/** Etapas camino al login. **La primera es idéntica a propósito**: las etapas se
 *  renderizan con `key={text}`, así que cuando `/api/auth/me` resuelve a ~200 ms
 *  y la lista cambia, la etapa 0 conserva su identidad y su animación no se
 *  reinicia. Sin eso se ve un tirón. */
export const STAGES_ANON = [
  'VERIFICANDO SESIÓN...',
  'SIN SESIÓN ACTIVA',
  'IDENTIFÍCATE',
]

/** Trazos del icono `Dumbbell` de lucide-react. */
const DUMBBELL_PATHS = [
  'M17.596 12.768a2 2 0 1 0 2.829-2.829l-1.768-1.767a2 2 0 0 0 2.828-2.829l-2.828-2.828a2 2 0 0 0-2.829 2.828l-1.767-1.768a2 2 0 1 0-2.829 2.829z',
  'M5.343 21.485a2 2 0 1 0 2.829-2.828l1.767 1.768a2 2 0 1 0 2.829-2.829l-6.364-6.364a2 2 0 1 0-2.829 2.829l1.768 1.767a2 2 0 0 0-2.828 2.829z',
  'm9.6 14.4 4.8-4.8',
  'm2.5 21.5 1.4-1.4',
  'm20.1 3.9 1.4-1.4',
]

/** Duración del fundido de salida. Debe coincidir con `splashFadeOut`. */
const FADE_MS = 520

export function SplashIntro({
  ready,
  onDone,
  title = 'COACH FIT',
  subtitle = 'FUERZA · CARDIO · PROGRESO',
  version = 'V1.0',
  minDuration = 2600,
  maxDuration = 9000,
  stages = STAGES_AUTHED,
  beat = 0.62,
  fill = '2.2s',
}: {
  /** Los datos ya llegaron. Antes de esto la intro no se va. */
  ready: boolean
  onDone: () => void
  title?: string
  subtitle?: string
  version?: string
  /** Piso: aunque los datos estén en caché, la animación se ve entera.
   *  No bajar de ~1200 ms: `mountedAt` cuenta desde `performance.timeOrigin`,
   *  o sea desde la navegación, y en un móvil lento el `elapsed` ya puede valer
   *  1,3 s cuando resuelve `/api/auth/me` — con un mínimo menor la intro se iría
   *  de golpe. */
  minDuration?: number
  /** Techo: si el backend no responde, la intro no secuestra la app. */
  maxDuration?: number
  /** Texto de las etapas. Ver STAGES_AUTHED / STAGES_ANON. */
  stages?: string[]
  /** Segundos entre etapa y etapa. La variante corta las aprieta. */
  beat?: number
  /** Duración del llenado de la barra; debe cuadrar con minDuration. */
  fill?: string
}) {
  const [leaving, setLeaving] = useState(false)
  // La espera cuenta desde la navegación, no desde que React termina de cargar:
  // el logo está ya en `index.html` cubriendo también el tiempo del bundle.
  const mountedAt = useRef(performance.timeOrigin)
  // `onDone` suele ser un setState inline: si entra en las dependencias, cada
  // render reprograma los timers y la intro nunca termina.
  const done = useRef(onDone)
  done.current = onDone

  // Retira el fondo de arranque de `index.html`. Va en un efecto de layout y no
  // en uno normal porque este corre con el DOM de la intro ya montado pero
  // ANTES de pintar: quitarlo después dejaría un fotograma sin ninguno de los
  // dos, que es el destello blanco que se quería evitar.
  //
  // ESTE ES EL ÚNICO SITIO QUE BORRA #boot, y por eso `Root` monta la intro en
  // TODOS los caminos —con sesión, sin ella y con el backend caído—. Si algún
  // camino se saltara el montaje, esa capa fija con z-index:998 taparía la
  // pantalla de login para siempre.
  useLayoutEffect(() => {
    document.getElementById('boot')?.remove()
  }, [])

  useEffect(() => {
    if (leaving) return
    const elapsed = Date.now() - mountedAt.current
    const wait = ready
      ? Math.max(0, minDuration - elapsed)
      : Math.max(0, maxDuration - elapsed)
    const t = setTimeout(() => setLeaving(true), wait)
    return () => clearTimeout(t)
  }, [ready, leaving, minDuration, maxDuration])

  useEffect(() => {
    if (!leaving) return
    const t = setTimeout(() => done.current(), FADE_MS)
    return () => clearTimeout(t)
  }, [leaving])

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Cargando Coach Fit"
      className={cn('splash-root', leaving && 'is-leaving')}
      style={{ '--splash-fill': fill } as CSSProperties}
    >
      <div className="splash-grid" aria-hidden />
      <div className="splash-scan" aria-hidden />

      <span className="splash-version" aria-hidden>
        {version}
      </span>

      {/* Anillos contrarrotantes + núcleo con el logo */}
      <div className="splash-logo" aria-hidden>
        <div className="splash-ring splash-ring-outer">
          <i className="splash-dot splash-dot-top" />
          <i className="splash-dot splash-dot-bottom" />
        </div>
        <div className="splash-ring splash-ring-mid">
          <i className="splash-dot splash-dot-right" />
        </div>
        <div className="splash-ring splash-ring-inner">
          <i className="splash-dot splash-dot-quarter" />
        </div>
        <div className="splash-sweep" />

        <div className="splash-core">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {DUMBBELL_PATHS.map((d) => (
              <path
                key={d}
                d={d}
                pathLength={1}
                className="splash-stroke"
              />
            ))}
          </svg>
        </div>
      </div>

      <h1 className="splash-title">
        {title.split('').map((letter, i) => (
          <span
            // El título es constante: el índice como key no reordena nada.
            key={i}
            className="splash-letter"
          >
            {letter === ' ' ? ' ' : letter}
          </span>
        ))}
      </h1>

      <p className="splash-subtitle">
        <span>{subtitle}</span>
      </p>

      <div className="splash-progress">
        <div className="splash-track">
          <div className={cn('splash-bar', leaving && 'is-ready')} />
        </div>
        <div className="splash-stages">
          {stages.map((text, i) => (
            <span
              key={text}
              className={cn('splash-stage', i === stages.length - 1 && 'is-final')}
              style={{ animationDelay: `${0.45 + i * beat}s` }}
            >
              {text}
            </span>
          ))}
        </div>
      </div>

      {/* Esquinas tácticas */}
      {['tl', 'tr', 'bl', 'br'].map((corner) => (
        <i
          key={corner}
          aria-hidden
          className={`splash-corner splash-corner-${corner}`}
        />
      ))}
    </div>
  )
}
