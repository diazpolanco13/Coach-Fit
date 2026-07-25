import type { PlanDay, PlanItem } from '@/lib/api'
import { midReps } from '@/lib/training'

/** Segundos de trabajo por serie ≈ 3 s/rep (tempo razonable en casa). */
const SEC_PER_REP = 3
const MIN_WORK_PER_SET = 20
/** Cambio de ejercicio / setup. */
const EXERCISE_TRANSITION_SEC = 40

function workSeconds(item: PlanItem): number {
  return Math.max(MIN_WORK_PER_SET, midReps(item) * SEC_PER_REP)
}

/** Minutos estimados del día según series, descanso del plan e ítem. */
export function estimateDayMinutes(day: PlanDay, defaultRestSeconds: number): number {
  if (!day.items.length) return 0
  let seconds = 0
  day.items.forEach((item, i) => {
    const sets = item.sets > 0 ? item.sets : 1
    const rest = item.rest_seconds ?? defaultRestSeconds
    seconds += sets * workSeconds(item)
    seconds += Math.max(0, sets - 1) * rest
    if (i < day.items.length - 1) seconds += EXERCISE_TRANSITION_SEC
  })
  return Math.max(1, Math.round(seconds / 60))
}

export function formatDayMinutes(min: number): string {
  if (min <= 0) return '—'
  if (min < 60) return `~${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `~${h} h ${m} min` : `~${h} h`
}
