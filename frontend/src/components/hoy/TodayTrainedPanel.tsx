import { useMemo } from 'react'
import type { Exercise, PlanGoals, SessionSet, WeekDay } from '@/lib/api'
import { Progress } from '@/components/ui/progress'
import { doneCountByExercise, doneSetsAsDays } from '@/lib/hoy'
import { formatSets, goalFor, weeklyVolume } from '@/lib/volume'

const MAX_ROWS = 8

/** Avance semanal por músculo: hecho acumulado / tope del plan.
 *
 *  El tope es el objetivo semanal (`goals.max`), el mismo que usa el radar —
 *  no el volumen del día en pantalla. Así una sesión de pecho no pinta
 *  «12.5/12.5»: pinta «12.5/40» y se va llenando al marcar series otros días.
 *
 *  Se monta siempre (no solo al mirar hoy): al pasear la tira el panel
 *  sigue ahí con el acumulado de la semana. */
export function TodayTrainedPanel({
  days,
  weeklySets,
  todaySets,
  goals,
  exMap,
  indirectWeight,
  sessionRpe,
}: {
  days: WeekDay[]
  /** Series hechas por ejercicio esta semana (`GET /api/dashboard/weekly-sets`). */
  weeklySets: Record<string, number>
  /** Series de hoy: cubre el desfase si el acumulado semanal aún no refrescó. */
  todaySets: SessionSet[]
  goals: PlanGoals
  exMap: Map<string, Exercise>
  indirectWeight: number
  sessionRpe: number | null
}) {
  const rows = useMemo(() => {
    // Si weekly-sets va un refresh detrás, las series de hoy no se pierden:
    // para un ejercicio solo hecho hoy, Math.max(0, n) = n; si ya venía de
    // otro día, el acumulado semanal gana.
    const counts = { ...weeklySets }
    for (const [id, n] of Object.entries(doneCountByExercise(todaySets))) {
      counts[id] = Math.max(counts[id] ?? 0, n)
    }

    const done = weeklyVolume(doneSetsAsDays(counts, exMap), exMap, indirectWeight)
    const planned = weeklyVolume(days, exMap, indirectWeight)
    const doneBy = new Map(done.map((v) => [v.muscle, v.total]))

    return planned
      .filter((v) => v.programmed)
      .sort((a, b) => {
        const da = doneBy.get(a.muscle) ?? 0
        const db = doneBy.get(b.muscle) ?? 0
        // Con trabajo: más hecho arriba. Sin trabajo: más programado primero.
        if (da !== db) return db - da
        return b.total - a.total
      })
      .slice(0, MAX_ROWS)
      .map((v) => {
        const goal = goalFor(goals, v.muscle).max
        const total = doneBy.get(v.muscle) ?? 0
        return {
          muscle: v.muscle,
          total,
          planned: goal,
          pct: goal > 0 ? Math.min(100, (total / goal) * 100) : 0,
        }
      })
  }, [days, weeklySets, todaySets, goals, exMap, indirectWeight])

  const doneSets = todaySets.filter((s) => s.done).length

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <div className="kicker">Hoy entrenaste</div>
        <div className="shrink-0 text-xs text-muted-foreground">
          {doneSets} {doneSets === 1 ? 'serie' : 'series'}
          {sessionRpe != null ? ` · RPE ${sessionRpe}` : ''}
        </div>
      </div>

      {rows.length ? (
        <div className="mt-3 space-y-2.5">
          {rows.map((r) => (
            <div key={r.muscle} className="grid grid-cols-[92px_1fr_auto] items-center gap-2.5 text-sm">
              <span className="truncate text-muted-foreground">{r.muscle}</span>
              <Progress
                value={r.pct}
                className="h-2.5"
                indicatorClassName={
                  r.total === 0 ? 'bg-muted-foreground/30' : r.pct >= 100 ? 'bg-primary' : 'bg-primary/50'
                }
              />
              <span className="text-xs tabular-nums text-muted-foreground">
                {formatSets(r.total)}/{formatSets(r.planned)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          Este plan no programa trabajo directo todavía.
        </p>
      )}
    </div>
  )
}
