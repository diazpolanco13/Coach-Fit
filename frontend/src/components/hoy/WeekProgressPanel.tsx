import { useMemo } from 'react'
import type { Exercise, PlanDay, PlanGoals, WeekDay } from '@/lib/api'
import { Progress } from '@/components/ui/progress'
import { formatSets, goalFor, weeklyVolume } from '@/lib/volume'
import { cn } from '@/lib/utils'

const MAX_ROWS = 6

/** Envuelve las series hechas en la misma forma que un día del plan, para poder
 *  medirlas con `weeklyVolume()`. Es lo que hace comparables las dos cifras: lo
 *  hecho y lo prescrito salen de la misma función, con el mismo reparto
 *  primario/secundario y la misma unión de sinónimos. */
function doneAsDays(setsByExercise: Record<string, number>, exMap: Map<string, Exercise>): PlanDay[] {
  const items = Object.entries(setsByExercise)
    .filter(([id]) => exMap.has(id))
    .map(([exercise_id, sets]) => ({
      exercise_id,
      sets,
      rep_min: 0,
      rep_max: 0,
      rest_seconds: null,
      notes: null,
      exercise: exMap.get(exercise_id) ?? null,
    }))
  return [{ weekday: 0, label: 'hecho', focus: 'full', items }]
}

export function WeekProgressPanel({
  days,
  weeklySets,
  goals,
  indirectWeight,
  exMap,
}: {
  days: WeekDay[]
  /** Series hechas por ejercicio esta semana. */
  weeklySets: Record<string, number>
  goals: PlanGoals
  indirectWeight: number
  exMap: Map<string, Exercise>
}) {
  const rows = useMemo(() => {
    const done = weeklyVolume(doneAsDays(weeklySets, exMap), exMap, indirectWeight)
    const planned = weeklyVolume(days, exMap, indirectWeight)
    const doneBy = new Map(done.map((v) => [v.muscle, v.total]))

    // Se listan los músculos que el PLAN programa, no los que se entrenaron: un
    // músculo sin trabajo previsto no tiene objetivo contra el que fallar, y uno
    // programado con cero series hechas es justo lo que hay que ver.
    return planned
      .filter((v) => v.programmed)
      .map((v) => {
        const goal = goalFor(goals, v.muscle)
        const total = doneBy.get(v.muscle) ?? 0
        return { muscle: v.muscle, total, min: goal.min, pct: Math.min(100, (total / goal.min) * 100) }
      })
      .sort((a, b) => a.pct - b.pct)
      .slice(0, MAX_ROWS)
  }, [days, weeklySets, goals, indirectWeight, exMap])

  const remainingDays = days.filter((d) => d.items.length && !d.completed).length
  const remainingSets = days
    .filter((d) => !d.completed)
    .reduce((n, d) => n + d.items.reduce((m, i) => m + i.sets, 0), 0)

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="kicker">Series hechas vs objetivo</div>
      {rows.length ? (
        <>
          <div className="mt-3 space-y-2.5">
            {rows.map((r) => (
              <div key={r.muscle} className="grid grid-cols-[92px_1fr_auto] items-center gap-2.5 text-sm">
                <span className="truncate text-muted-foreground">{r.muscle}</span>
                <Progress
                  value={r.pct}
                  className="h-2.5"
                  indicatorClassName={r.total === 0 ? 'bg-destructive' : r.pct >= 100 ? undefined : 'bg-primary/50'}
                />
                <span
                  className={cn(
                    'text-xs tabular-nums text-muted-foreground',
                    r.total === 0 && 'font-semibold text-destructive',
                  )}
                >
                  {formatSets(r.total)}/{r.min}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 border-t pt-2.5 text-xs text-muted-foreground">
            {remainingDays
              ? `Quedan ${remainingDays} ${remainingDays === 1 ? 'día' : 'días'} y ${remainingSets} series programadas.`
              : 'Semana cerrada: no quedan días pendientes.'}
          </p>
        </>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          Este plan no programa trabajo directo todavía.
        </p>
      )}
    </div>
  )
}
