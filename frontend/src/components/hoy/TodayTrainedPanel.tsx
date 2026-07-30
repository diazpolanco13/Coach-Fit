import { useMemo } from 'react'
import type { Exercise, PlanGoals, SessionSet, WeekDay } from '@/lib/api'
import { doneCountByExercise, doneSetsAsDays } from '@/lib/hoy'
import { muscleBodyRank } from '@/lib/muscle'
import { formatSets, goalFor, weeklyVolume } from '@/lib/volume'
import { cn } from '@/lib/utils'

const MAX_ROWS = 8

/** Avance semanal por músculo: hecho acumulado / tope del plan.
 *
 *  El tope es el objetivo semanal (`goals.max`), el mismo que usa el radar —
 *  no el volumen del día en pantalla. Así una sesión de pecho no pinta
 *  «12.5/12.5»: pinta «12.5/40» y se va llenando al marcar series otros días.
 *
 *  Dentro de cada barra: naranja = día en pantalla; neutro = resto de la
 *  semana. El orden de filas es anatómico (arriba → abajo) y no cambia al
 *  pasear la tira — solo se mueve el tramo naranja. */
export function TodayTrainedPanel({
  days,
  weeklySets,
  daySets,
  focusLabel,
  goals,
  exMap,
  indirectWeight,
  sessionRpe,
}: {
  days: WeekDay[]
  /** Series hechas por ejercicio esta semana (`GET /api/dashboard/weekly-sets`). */
  weeklySets: Record<string, number>
  /** Series del día en pantalla: cubre el desfase si el acumulado aún no refrescó. */
  daySets: SessionSet[]
  /** Etiqueta corta del tramo naranja: «hoy», «ayer», «30 jul»… */
  focusLabel: string
  goals: PlanGoals
  exMap: Map<string, Exercise>
  indirectWeight: number
  sessionRpe: number | null
}) {
  const rows = useMemo(() => {
    const dayCounts = doneCountByExercise(daySets)
    // Si weekly-sets aún no incluye el día: rest = weekly, total = weekly + día.
    // Si ya lo incluye: rest = weekly − día, total = weekly.
    const restCounts: Record<string, number> = {}
    for (const [id, n] of Object.entries(weeklySets)) {
      restCounts[id] = Math.max(0, n - (dayCounts[id] ?? 0))
    }
    const totalCounts = { ...restCounts }
    for (const [id, n] of Object.entries(dayCounts)) {
      totalCounts[id] = (totalCounts[id] ?? 0) + n
    }

    // Volumen del día en crudo (no total−rest): si un músculo solo se trabajó
    // ese día, toda la barra debe pintarse naranja aunque no haya tramo previo.
    const dayDone = weeklyVolume(doneSetsAsDays(dayCounts, exMap), exMap, indirectWeight)
    const totalDone = weeklyVolume(doneSetsAsDays(totalCounts, exMap), exMap, indirectWeight)
    const planned = weeklyVolume(days, exMap, indirectWeight)

    const dayBy = new Map(dayDone.map((v) => [v.muscle, v.total]))
    const totalBy = new Map(totalDone.map((v) => [v.muscle, v.total]))

    // Orden anatómico fijo (arriba → abajo). El día solo pinta naranja; no
    // reordena filas. Si el día trabaja un músculo fuera del tope, se amplía
    // la lista pero se vuelve a ordenar por el cuerpo.
    const mapped = planned
      .filter((v) => v.programmed)
      .map((v) => {
        const goal = goalFor(goals, v.muscle).max
        const total = totalBy.get(v.muscle) ?? 0
        const day = Math.min(total, dayBy.get(v.muscle) ?? 0)
        const rest = Math.max(0, total - day)
        const restPct = goal > 0 ? Math.min(100, (rest / goal) * 100) : 0
        const dayPct = goal > 0 ? Math.min(100 - restPct, (day / goal) * 100) : 0
        return {
          muscle: v.muscle,
          total,
          day,
          planned: goal,
          restPct,
          dayPct,
          pct: restPct + dayPct,
        }
      })
      .sort((a, b) => muscleBodyRank(a.muscle) - muscleBodyRank(b.muscle))

    const head = mapped.slice(0, MAX_ROWS)
    const headKeys = new Set(head.map((r) => r.muscle))
    const extraDay = mapped.filter((r) => r.day > 0 && !headKeys.has(r.muscle))
    return [...head, ...extraDay].sort(
      (a, b) => muscleBodyRank(a.muscle) - muscleBodyRank(b.muscle),
    )
  }, [days, weeklySets, daySets, goals, exMap, indirectWeight])

  const doneSets = daySets.filter((s) => s.done).length
  const hasDay = rows.some((r) => r.day > 0)
  const hasRest = rows.some((r) => r.total - r.day > 0)

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <div className="kicker">Avance semanal</div>
        <div className="shrink-0 text-xs text-muted-foreground">
          {doneSets > 0 ? (
            <>
              {focusLabel} {doneSets} {doneSets === 1 ? 'serie' : 'series'}
              {sessionRpe != null ? ` · RPE ${sessionRpe}` : ''}
            </>
          ) : sessionRpe != null ? (
            <>RPE {sessionRpe}</>
          ) : null}
        </div>
      </div>

      {hasDay && hasRest && (
        <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-sm bg-primary" aria-hidden />
            {focusLabel}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-sm bg-foreground/25" aria-hidden />
            resto
          </span>
        </div>
      )}

      {rows.length ? (
        <div className={cn('space-y-2.5', hasDay && hasRest ? 'mt-2.5' : 'mt-3')}>
          {rows.map((r) => (
            <div key={r.muscle} className="grid grid-cols-[92px_1fr_auto] items-center gap-2.5 text-sm">
              <span
                className={cn(
                  'truncate',
                  r.day > 0 ? 'font-medium text-foreground' : 'text-muted-foreground',
                )}
              >
                {r.muscle}
              </span>
              <div
                className="relative h-3 w-full overflow-hidden rounded-full bg-muted"
                title={
                  r.day > 0
                    ? `${formatSets(r.day)} ${focusLabel} + ${formatSets(r.total - r.day)} resto / ${formatSets(r.planned)}`
                    : r.total > 0
                      ? `${formatSets(r.total)} el resto de la semana / ${formatSets(r.planned)}`
                      : undefined
                }
              >
                {/* Día en pantalla primero (naranja): al cambiar con las flechas
                    el tramo se lee como «esto aportó esta sesión». */}
                {r.dayPct > 0 && (
                  <div
                    className="absolute inset-y-0 left-0 bg-primary transition-[width]"
                    style={{ width: `${r.dayPct}%` }}
                  />
                )}
                {/* Resto de la semana: neutro, a continuación del día. */}
                {r.restPct > 0 && (
                  <div
                    className="absolute inset-y-0 bg-foreground/25 transition-[left,width]"
                    style={{ left: `${r.dayPct}%`, width: `${r.restPct}%` }}
                  />
                )}
              </div>
              <span className="text-xs tabular-nums text-muted-foreground">
                {r.day > 0 ? (
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
