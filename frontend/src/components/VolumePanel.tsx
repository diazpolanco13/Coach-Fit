import { AlertTriangle } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { formatSets, volumeStatus, type MuscleVolume } from '@/lib/volume'

const BAR = {
  low: 'bg-amber-500',
  ok: 'bg-emerald-500',
  high: 'bg-destructive',
  incidental: 'bg-muted-foreground/40',
} as const

const TEXT = {
  low: 'text-amber-600 dark:text-amber-400',
  ok: 'text-muted-foreground',
  high: 'text-destructive font-semibold',
  incidental: 'text-muted-foreground',
} as const

export function VolumePanel({
  volumes,
  min,
  max,
}: {
  volumes: MuscleVolume[]
  min: number
  max: number
}) {
  const programmed = volumes.filter((v) => v.programmed)
  const incidental = volumes.filter((v) => !v.programmed)
  const over = programmed.filter((v) => volumeStatus(v, min, max) === 'high')
  const under = programmed.filter((v) => volumeStatus(v, min, max) === 'low')

  return (
    <div className="p-4">
      <div className="flex items-baseline justify-between gap-2">
        <div className="kicker">Volumen semanal · series por músculo</div>
        <span className="shrink-0 text-xs text-muted-foreground">
          objetivo {min}–{max}
        </span>
      </div>

      {!programmed.length ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Añade ejercicios al plan para ver cuánto trabajo recibe cada músculo.
        </p>
      ) : (
        <div className="mt-3 space-y-2.5">
          {programmed.map((v) => {
            const status = volumeStatus(v, min, max)
            return (
              <div key={v.muscle} className="grid grid-cols-[104px_1fr_auto] items-center gap-2.5 text-sm">
                <span className="truncate">{v.muscle}</span>
                <Progress
                  value={Math.min(100, (v.total / max) * 100)}
                  className="h-3"
                  indicatorClassName={BAR[status]}
                />
                <span className={cn('text-xs tabular-nums', TEXT[status])}>
                  {formatSets(v.total)}
                  {v.indirect > 0 && (
                    <span className="text-muted-foreground"> ({formatSets(v.direct)} dir.)</span>
                  )}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {!!incidental.length && (
        <p className="mt-3 text-xs text-muted-foreground">
          Solo trabajo indirecto: {incidental.map((v) => `${v.muscle} ${formatSets(v.total)}`).join(' · ')}
        </p>
      )}

      {(over.length > 0 || under.length > 0) && (
        <div className="mt-3 space-y-1 border-t border-border pt-2.5 text-xs">
          {over.length > 0 && (
            <p className="flex items-start gap-1.5 text-destructive">
              <AlertTriangle className="mt-px size-3.5 shrink-0" />
              <span>
                Pasas de {max} series en {over.map((v) => v.muscle).join(', ')}. Reparte esos ejercicios en menos
                días o quita alguno.
              </span>
            </p>
          )}
          {under.length > 0 && (
            <p className="text-muted-foreground">
              Por debajo de {min}: {under.map((v) => v.muscle).join(', ')}.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
