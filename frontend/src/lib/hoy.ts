import type {
  Exercise,
  MuscleCoverageItem,
  PlanDay,
  PlanSummary,
  SessionSet,
  WeekDay,
} from '@/lib/api'
/** Próximo día con ejercicios a partir de hoy, sin dar la vuelta a la semana:
 *  el domingo por la noche lo que importa no es el lunes que ya pasó. */
export function nextTrainingDay(days: WeekDay[], todayDate: string | undefined): WeekDay | null {
  if (!todayDate) return null
  return days.find((d) => d.date > todayDate && d.items.length > 0) ?? null
}

export const daySets = (day: WeekDay) => day.items.reduce((n, i) => n + i.sets, 0)

/** Resumen de lo hecho en un ejercicio hoy: series, reps, peso y RPE. */
export type DoneExerciseSummary = {
  exercise_id: string
  sets: number
  /** Una cifra (`12`) o rango (`12–15`) a partir de las series hechas. */
  repsLabel: string
  /** `20 kg`, `12.5–20 kg`, o null si todas fueron sin peso. */
  weightLabel: string | null
  avgRpe: number | null
}

function rangeLabel(values: number[]): string {
  const min = Math.min(...values)
  const max = Math.max(...values)
  if (min === max) return String(min)
  return `${min}–${max}`
}

function weightLabel(values: number[]): string {
  const min = Math.min(...values)
  const max = Math.max(...values)
  if (min === max) return `${min} kg`
  return `${min}–${max} kg`
}

/** Agrupa series `done` por ejercicio para pintar la home sin abrir el día. */
export function summarizeDoneByExercise(sets: SessionSet[]): Map<string, DoneExerciseSummary> {
  const byEx = new Map<string, SessionSet[]>()
  for (const s of sets) {
    if (!s.done) continue
    const list = byEx.get(s.exercise_id) ?? []
    list.push(s)
    byEx.set(s.exercise_id, list)
  }

  const out = new Map<string, DoneExerciseSummary>()
  for (const [exercise_id, rows] of byEx) {
    const reps = rows.map((r) => r.reps).filter((n): n is number => n != null && n > 0)
    const weights = rows
      .map((r) => r.weight_kg)
      .filter((n): n is number => n != null && n > 0)
    const rpes = rows.map((r) => r.rpe).filter((n): n is number => n != null)
    out.set(exercise_id, {
      exercise_id,
      sets: rows.length,
      repsLabel: reps.length ? rangeLabel(reps) : '—',
      weightLabel: weights.length ? weightLabel(weights) : null,
      avgRpe: rpes.length
        ? Math.round((rpes.reduce((a, b) => a + b, 0) / rpes.length) * 10) / 10
        : null,
    })
  }
  return out
}

/** `4×12 @ 20 kg` · o `3×15` si fue peso corporal. */
export function formatDoneSummary(s: DoneExerciseSummary): string {
  const base = `${s.sets}×${s.repsLabel}`
  return s.weightLabel ? `${base} @ ${s.weightLabel}` : base
}

/** Misma forma que un día del plan, para pasar series hechas por `weeklyVolume`. */
export function doneSetsAsDays(
  setsByExercise: Record<string, number>,
  exMap: Map<string, Exercise>,
): PlanDay[] {
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

export function doneCountByExercise(sets: SessionSet[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const s of sets) {
    if (!s.done) continue
    out[s.exercise_id] = (out[s.exercise_id] ?? 0) + 1
  }
  return out
}

/** Posición del plan activo dentro de los guardados, ordenados como el selector
 *  (por id). No hay concepto de ciclo en el modelo, así que esto no lo inventa:
 *  dice «plan 2 de 4», que es literalmente cierto y basta para ubicarse cuando
 *  las semanas se rotan a mano. */
export function planPosition(plans: PlanSummary[], activeId: number | null): string | null {
  if (!activeId || plans.length < 2) return null
  const i = plans.findIndex((p) => p.id === activeId)
  return i < 0 ? null : `Plan ${i + 1} de ${plans.length}`
}

/** Los más atrasados primero, y los que nunca se han entrenado al final.
 *
 *  `get_muscle_stats` rellena con ceros los 19 targets del catálogo — serrato,
 *  elevador escapular, aductores…—, así que sin acotar esto son diez y pico
 *  filas idénticas. Y un músculo sin `last_date` no lleva «— días sin»: no es
 *  que lleve mucho, es que nunca hubo dato. */
export function laggingMuscles(groups: MuscleCoverageItem[], limit = 3): MuscleCoverageItem[] {
  return groups
    .filter((g) => g.sessions === 0)
    .sort((a, b) => {
      if ((a.days_since_last == null) !== (b.days_since_last == null)) {
        return a.days_since_last == null ? 1 : -1
      }
      return (b.days_since_last ?? 0) - (a.days_since_last ?? 0)
    })
    .slice(0, limit)
}

/** Antigüedad en días de una fecha ISO, o null si no la hay o no se entiende. */
export function daysSince(iso: string | undefined, today = new Date()): number | null {
  if (!iso) return null
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return null
  const a = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  const b = Date.UTC(then.getFullYear(), then.getMonth(), then.getDate())
  return Math.max(0, Math.round((a - b) / 86400000))
}

export function freshnessLabel(days: number | null): string | null {
  if (days == null) return null
  if (days === 0) return 'Generado hoy'
  if (days === 1) return 'Generado ayer'
  return `Generado hace ${days} días`
}
