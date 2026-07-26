import { useEffect, useRef, useState } from 'react'
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
 * El logo es el mismo `Dumbbell` de lucide que usa el Sidebar, pero dibujado
 * trazo a trazo con `pathLength` en vez de renderizado de golpe.
 */

const STAGES = [
  'ESTABLECIENDO SESIÓN...',
  'CARGANDO PLAN DE LA SEMANA...',
  'SINCRONIZANDO MEDICIONES...',
  'LISTO',
]

/** Trazos del icono `Dumbbell` de lucide-react, en orden de dibujado. */
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
}: {
  /** Los datos ya llegaron. Antes de esto la intro no se va. */
  ready: boolean
  onDone: () => void
  title?: string
  subtitle?: string
  version?: string
  /** Piso: aunque los datos estén en caché, la animación se ve entera. */
  minDuration?: number
  /** Techo: si el backend no responde, la intro no secuestra la app. */
  maxDuration?: number
}) {
  const [leaving, setLeaving] = useState(false)
  const mountedAt = useRef(Date.now())
  // `onDone` suele ser un setState inline: si entra en las dependencias, cada
  // render reprograma los timers y la intro nunca termina.
  const done = useRef(onDone)
  done.current = onDone

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
            {DUMBBELL_PATHS.map((d, i) => (
              <path
                key={d}
                d={d}
                pathLength={1}
                className="splash-stroke"
                style={{ animationDelay: `${0.62 + i * 0.11}s` }}
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
            style={{ animationDelay: `${0.5 + i * 0.06}s` }}
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
          {STAGES.map((text, i) => (
            <span
              key={text}
              className={cn('splash-stage', i === STAGES.length - 1 && 'is-final')}
              style={{ animationDelay: `${0.45 + i * 0.62}s` }}
            >
              {text}
            </span>
          ))}
        </div>
      </div>

      {/* Esquinas tácticas */}
      {['tl', 'tr', 'bl', 'br'].map((corner, i) => (
        <i
          key={corner}
          aria-hidden
          className={`splash-corner splash-corner-${corner}`}
          style={{ animationDelay: `${0.75 + i * 0.09}s` }}
        />
      ))}
    </div>
  )
}
