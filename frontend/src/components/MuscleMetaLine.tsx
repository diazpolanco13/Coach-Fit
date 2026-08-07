import { muscleToneClass } from '@/lib/muscle'
import { cn } from '@/lib/utils'

/** Meta-línea con músculo coloreado (fijo por etiqueta) y cola muted (equipo, reps…). */
export function MuscleMetaLine({
  muscles,
  trailing = [],
  muted = false,
  className,
}: {
  muscles: string[]
  /** Equipo, prescripción, etc. — sin color de músculo. */
  trailing?: (string | null | undefined)[]
  /** Fila omitida: todo ámbar, sin pelear con el estado. */
  muted?: boolean
  className?: string
}) {
  const trail = trailing.filter((t): t is string => Boolean(t))
  const title = [...muscles, ...trail].join(' · ')
  if (!muscles.length && !trail.length) return null

  return (
    <span className={cn('leading-snug', className)} title={title}>
      {muscles.map((m, i) => (
        <span key={`${m}-${i}`}>
          {i > 0 && <span className="text-muted-foreground"> · </span>}
          <span className={muted ? 'text-amber-600 dark:text-amber-400' : muscleToneClass(m)}>
            {m}
          </span>
        </span>
      ))}
      {trail.map((t, i) => (
        <span key={`t-${i}`} className="text-muted-foreground">
          {(muscles.length > 0 || i > 0) && ' · '}
          {t}
        </span>
      ))}
    </span>
  )
}
