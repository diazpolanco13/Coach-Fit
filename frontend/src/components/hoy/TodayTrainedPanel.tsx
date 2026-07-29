import { useMemo } from 'react'
import type { Exercise, PlanGoals, SessionSet, WeekDay } from '@/lib/api'
import { doneCountByExercise, doneSetsAsDays } from '@/lib/hoy'
import { formatSets, goalFor, weeklyVolume } from '@/lib/volume'
import { cn } from '@/lib/utils'

const MAX_ROWS = 8

/** Avance semanal por músculo: hecho acumulado / tope del plan.
 *
 *  El tope es el objetivo semanal (`goals.max`), el mismo que usa el radar —
 *  no el volumen del día en pantalla. Así una sesión de pecho no pinta
 *  «12.5/12.5»: pinta «12.5/40» y se va llenando al marcar series otros días.
 *
 *  Dentro de cada barra: tramo neutro = días anteriores; naranja = hoy.
 *  Cuando un músculo es solo de un día (p. ej. pecho el lunes, gemelos hoy)
 *  no hay apilado interno — el color entero de la barra es la señal.
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
    const todayCounts = doneCountByExercise(todaySets)
    // Si weekly-sets aún no incluye hoy: prev = weekly, total = weekly + hoy.
    // Si ya lo incluye: prev = weekly − hoy, total = weekly.
    const prevCounts: Record<string, number> = {}
    for (const [id, n] of Object.entries(weeklySets)) {
      prevCounts[id] = Math.max(0, n - (todayCounts[id] ?? 0))
    }
    const totalCounts = { ...prevCounts }
    for (const [id, n] of Object.entries(todayCounts)) {
      totalCounts[id] = (totalCounts[id] ?? 0) + n
    }

    // Volumen de hoy en crudo (no total−prev): si un músculo solo se trabajó
    // hoy, toda la barra debe pintarse naranja aunque no haya tramo previo.
    const todayDone = weeklyVolume(doneSetsAsDays(todayCounts, exMap), exMap, indirectWeight)
    const totalDone = weeklyVolume(doneSetsAsDays(totalCounts, exMap), exMap, indirectWeight)
    const planned = weeklyVolume(days, exMap, indirectWeight)

    const todayBy = new Map(todayDone.map((v) => [v.muscle, v.total]))
    const totalBy = new Map(totalDone.map((v) => [v.muscle, v.total]))

    return planned
      .filter((v) => v.programmed)
      .sort((a, b) => {
        const da = totalBy.get(a.muscle) ?? 0
        const db = totalBy.get(b.muscle) ?? 0
        // Con trabajo: más hecho arriba. Sin trabajo: más programado primero.
        if (da !== db) return db - da
        return b.total - a.total
      })
      .slice(0, MAX_ROWS)
      .map((v) => {
        const goal = goalFor(goals, v.muscle).max
        const total = totalBy.get(v.muscle) ?? 0
        const today = Math.min(total, todayBy.get(v.muscle) ?? 0)
        const prev = Math.max(0, total - today)
        const prevPct = goal > 0 ? Math.min(100, (prev / goal) * 100) : 0
        const todayPct = goal > 0 ? Math.min(100 - prevPct, (today / goal) * 100) : 0
        return {
          muscle: v.muscle,
          total,
          today,
          planned: goal,
          prevPct,
          todayPct,
          pct: prevPct + todayPct,
        }
      })
  }, [days, weeklySets, todaySets, goals, exMap, indirectWeight])

  const doneSets = todaySets.filter((s) => s.done).length
  const hasToday = rows.some((r) => r.today > 0)
  const hasPrev = rows.some((r) => r.total - r.today > 0)

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <div className="kicker">Avance semanal</div>
        <div className="shrink-0 text-xs text-muted-foreground">
          {doneSets > 0 ? (
            <>
              hoy {doneSets} {doneSets === 1 ? 'serie' : 'series'}
              {sessionRpe != null ? ` · RPE ${sessionRpe}` : ''}
            </>
          ) : sessionRpe != null ? (
            <>RPE {sessionRpe}</>
          ) : null}
        </div>
      </div>

      {hasToday && hasPrev && (
        <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-sm bg-foreground/25" aria-hidden />
            previos
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-sm bg-primary" aria-hidden />
            hoy
          </span>
        </div>
      )}

      {rows.length ? (
        <div className={cn('space-y-2.5', hasToday && hasPrev ? 'mt-2.5' : 'mt-3')}>
          {rows.map((r) => (
            <div key={r.muscle} className="grid grid-cols-[92px_1fr_auto] items-center gap-2.5 text-sm">
              <span
                className={cn(
                  'truncate',
                  r.today > 0 ? 'font-medium text-foreground' : 'text-muted-foreground',
                )}
              >
                {r.muscle}
              </span>
              <div
                className="relative h-3 w-full overflow-hidden rounded-full bg-muted"
                title={
                  r.today > 0
                    ? `${formatSets(r.total - r.today)} previos + ${formatSets(r.today)} hoy / ${formatSets(r.planned)}`
                    : r.total > 0
                      ? `${formatSets(r.total)} en días previos / ${formatSets(r.planned)}`
                      : undefined
                }
              >
                {/* Días anteriores: neutro, sin naranja — así un músculo solo
                    de lunes no se confunde con el aporte de hoy. */}
                {r.prevPct > 0 && (
                  <div
                    className="absolute inset-y-0 left-0 bg-foreground/25 transition-[width]"
                    style={{ width: `${r.prevPct}%` }}
                  />
                )}
                {/* Hoy: naranja de marca a pleno. */}
                {r.todayPct > 0 && (
                  <div
                    className="absolute inset-y-0 bg-primary transition-[left,width]"
                    style={{ left: `${r.prevPct}%`, width: `${r.todayPct}%` }}
                  />
                )}
              </div>
              <span className="text-xs tabular-nums text-muted-foreground">
                {r.today > 0 ? (
                  <>
                    <span className="text-primary">{formatSets(r.total)}</span>/{formatSets(r.planned)}
                  </>
                ) : (
                  <>
                    {formatSets(r.total)}/{formatSets(r.planned)}
                  </>
                )}
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
