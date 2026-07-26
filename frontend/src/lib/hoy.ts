import type { MuscleCoverageItem, PlanSummary, WeekDay } from '@/lib/api'

/** Próximo día con ejercicios a partir de hoy, sin dar la vuelta a la semana:
 *  el domingo por la noche lo que importa no es el lunes que ya pasó. */
export function nextTrainingDay(days: WeekDay[], todayDate: string | undefined): WeekDay | null {
  if (!todayDate) return null
  return days.find((d) => d.date > todayDate && d.items.length > 0) ?? null
}

export const daySets = (day: WeekDay) => day.items.reduce((n, i) => n + i.sets, 0)

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
