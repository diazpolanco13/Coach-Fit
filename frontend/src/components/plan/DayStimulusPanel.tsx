import { useMemo } from 'react'
import type { PlanGoals } from '@/lib/api'
import type { DayMusclePoint } from '@/lib/dayStimulus'
import { formatSets, goalFor, type MuscleVolume } from '@/lib/volume'
import { cn } from '@/lib/utils'

/**
 * Qué entrena este día, situado dentro de la semana.
 *
 * La versión anterior normalizaba las barras contra el músculo más trabajado
 * del propio día: el primero siempre llegaba al final y no se sabía si 12.5
 * series era mucho o poco. Aquí la barra es el **objetivo semanal**, el mismo
 * que juzga la vista de la semana, así que cada día se lee en la escala en la
 * que de verdad se decide si un músculo va corto o pasado.
 *
 * Cada barra lleva tres tramos y una marca:
 *  - naranja sólido: lo que este día aporta como trabajo directo
 *  - naranja claro: lo que aporta de forma indirecta (secundario)
 *  - gris: lo que ponen los otros días de la semana
 *  - la muesca: el mínimo semanal del músculo
 */
export function DayStimulusPanel({
  points,
  volumes,
  goals,
  className,
}: {
  points: DayMusclePoint[]
  /** Volumen semanal completo del plan, para saber cuánto pone el resto. */
  volumes: MuscleVolume[]
  goals: PlanGoals
  className?: string
}) {
  const weekByMuscle = useMemo(() => new Map(volumes.map((v) => [v.muscle, v])), [volumes])

  const rows = useMemo(
    () =>
      points.map((point) => {
        const weekly = weekByMuscle.get(point.muscle)
        // El resto de la semana nunca es negativo: si el volumen semanal no
        // trae el músculo (catálogo desincronizado), el día es todo lo que hay.
        const week = Math.max(weekly?.total ?? point.total, point.total)
        // Un músculo que en toda la semana solo aparece como secundario no
        // tiene objetivo que cumplir: enseñarle «10–17» a los tobillos, que
        // arrastran una serie de las sentadillas, es ruido. Misma regla que usa
        // `volumeStatus` para marcarlos «incidental».
        const programmed = weekly?.programmed ?? false
        const goal = goalFor(goals, point.muscle)
        // La barra llega hasta el tope del objetivo, o hasta la semana si ya lo
        // pasó: pasarse tiene que verse, no salirse del gráfico en silencio.
        const scale = programmed ? Math.max(goal.max, week, 1) : Math.max(week, 1)
        return {
          ...point,
          week,
          goal,
          programmed,
          scale,
          share: point.total / week,
          overMax: programmed && week > goal.max,
        }
      }),
    [points, goals, weekByMuscle],
  )

  const dayTotal = points.reduce((n, p) => n + p.total, 0)
  const lead = rows[0]

  if (!rows.length) {
    return (
      <div className={cn('rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground', className)}>
        Sin estímulo muscular
      </div>
    )
  }

  return (
    <div className={cn('rounded-lg border border-border/80 bg-muted/30 px-3 py-2.5', className)}>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-medium text-foreground">Qué entrena este día</span>
        <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
          {formatSets(dayTotal)} series efectivas
        </span>
      </div>

      {/* Una frase antes que cuatro barras: de un vistazo, de qué día es. */}
      {lead && (
        <p className="mb-2.5 text-[11px] text-muted-foreground">
          Sobre todo <strong className="font-medium text-foreground">{lead.muscle}</strong> (
          {Math.round((lead.total / dayTotal) * 100)}% del estímulo
          {rows.length > 1 ? `, con ${rows.length - 1} grupo${rows.length > 2 ? 's' : ''} más` : ''}
          ).
        </p>
      )}

      <ul className="space-y-2">
        {rows.map((row) => {
          const pct = (n: number) => `${(n / row.scale) * 100}%`
          return (
            <li key={row.muscle} className="space-y-1">
              <div className="flex items-baseline justify-between gap-2 text-[11px]">
                <span className="truncate font-medium">{row.muscle}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  <strong className="font-medium text-foreground">{formatSets(row.total)}</strong>
                  {' de '}
                  {formatSets(row.week)} sem.
                </span>
              </div>
              <div
                className="relative h-2 overflow-hidden rounded-full bg-background"
                title={`${row.muscle}: ${formatSets(row.total)} series este día (${formatSets(row.primary)} directas + ${formatSets(row.secondary)} indirectas). En la semana ${formatSets(row.week)}${
                  row.programmed
                    ? `, objetivo ${row.goal.min}–${row.goal.max}.`
                    : ', solo como músculo secundario.'
                }`}
              >
                <div className="flex h-full">
                  <div className="h-full bg-primary" style={{ width: pct(row.primary) }} />
                  <div className="h-full bg-primary/45" style={{ width: pct(row.secondary) }} />
                  <div
                    className="h-full bg-muted-foreground/25"
                    style={{ width: pct(row.week - row.total) }}
                  />
                </div>
                {/* Muesca del mínimo semanal: lo que separa «va corto» de «va
                    bien» en la vista de la semana, traído aquí para que el día
                    se lea contra el mismo listón. */}
                {row.programmed && row.goal.min < row.scale && (
                  <span
                    aria-hidden
                    className="absolute inset-y-0 w-px bg-foreground/45"
                    style={{ left: pct(row.goal.min) }}
                  />
                )}
              </div>
              <div className="flex items-baseline justify-between gap-2 text-[10px] text-muted-foreground">
                <span>
                  {Math.round(row.share * 100)}% de la semana lo pone este día
                </span>
                <span className={cn('shrink-0 tabular-nums', row.overMax && 'text-amber-600')}>
                  {row.programmed ? (
                    <>
                      objetivo {row.goal.min}–{row.goal.max}
                      {row.overMax ? ' · pasado' : ''}
                    </>
                  ) : (
                    'solo indirecto'
                  )}
                </span>
              </div>
            </li>
          )
        })}
      </ul>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/70 pt-2 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span className="h-1.5 w-3 rounded-full bg-primary" />
          Directo
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-1.5 w-3 rounded-full bg-primary/45" />
          Indirecto
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-1.5 w-3 rounded-full bg-muted-foreground/25" />
          Otros días
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-px bg-foreground/45" />
          Mínimo semanal
        </span>
      </div>
    </div>
  )
}
