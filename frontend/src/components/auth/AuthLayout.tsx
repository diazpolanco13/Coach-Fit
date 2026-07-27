import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Marco de las pantallas de sesión. Reutiliza los tokens y las clases de la
 * intro (`.auth-root` comparte selector con `.splash-root` en index.css), para
 * que el login no parezca de otra aplicación.
 *
 * Se monta como hermano del splash y DEBAJO de él: cuando la intro se funde,
 * revela una pantalla ya pintada en vez de transicionar a un hueco.
 */
export function AuthLayout({
  children,
  overlay = false,
  exiting = false,
}: {
  children: ReactNode
  /** La sesión se cayó a mitad de uso: se pinta encima de la app, que sigue
   *  montada detrás con sus borradores intactos. */
  overlay?: boolean
  /** El login acertó y la app ya tiene datos: se funde en vez de desaparecer. */
  exiting?: boolean
}) {
  return (
    <div className={cn('auth-root', overlay && 'is-overlay', exiting && 'is-exiting')}>
      <div className="auth-grid" aria-hidden />

      {['tl', 'tr', 'bl', 'br'].map((corner) => (
        <i key={corner} aria-hidden className={`auth-corner splash-corner-${corner}`} />
      ))}

      <div className="relative z-2 flex w-full max-w-sm flex-col items-center">
        <h1 className="splash-title !mb-6 !text-[clamp(1.25rem,6vw,1.75rem)]">
          {'COACH FIT'.split('').map((letter, i) => (
            // El título es constante: el índice como key no reordena nada.
            <span key={i} className="splash-letter">
              {letter === ' ' ? ' ' : letter}
            </span>
          ))}
        </h1>
        {children}
      </div>
    </div>
  )
}
