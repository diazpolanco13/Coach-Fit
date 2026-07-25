import { useMemo } from 'react'
import type { DayMusclePoint } from '@/lib/dayStimulus'
import { formatSets } from '@/lib/volume'
import { cn } from '@/lib/utils'

const MAX_ROWS = 4

/**
 * Lectura compacta del estímulo del día: barras apiladas primario/secundario.
 * Sustituye al radar (ocupaba demasiado y costaba leer).
 */
export function DayMuscleRadar({
  points,
  className,
}: {
  points: DayMusclePoint[]
  className?: string
}) {
  const rows = useMemo(() => points.slice(0, MAX_ROWS), [points])
  const peak = Math.max(...rows.map((r) => r.total), 1)
  const empty = !rows.length

  if (empty) {
    return (
      <div
        className={cn(
          'rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground',
          className,
        )}
      >
        Sin estímulo muscular
      </div>
    )
  }

  return (
    <div className={cn('rounded-lg border border-border/80 bg-muted/30 px-3 py-2', className)}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-foreground">Estímulo</span>
        <span className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-primary" />
            Primario
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-teal-600" />
            Secundario
          </span>
        </span>
      </div>
      <ul className="space-y-1.5">
        {rows.map((row) => (
          <li key={row.muscle} className="grid grid-cols-[minmax(0,4.5rem)_1fr_1.75rem] items-center gap-1.5">
            <span className="truncate text-[11px] font-medium">{row.muscle}</span>
            <div className="flex h-1.5 overflow-hidden rounded-full bg-background">
              <div
                className="h-full bg-primary"
                style={{ width: `${(row.primary / peak) * 100}%` }}
              />
              <div
                className="h-full bg-teal-600/85"
                style={{ width: `${(row.secondary / peak) * 100}%` }}
              />
            </div>
            <span className="text-right text-[10px] tabular-nums text-muted-foreground">
              {formatSets(row.total)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
