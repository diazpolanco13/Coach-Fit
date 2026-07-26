import type { Exercise, Gym, PlanDay } from '@/lib/api'
import { availableEquipment } from '@/lib/equipment'

/**
 * Encaje entre un plan y el espacio al que está anclado.
 *
 * La biblioteca ya filtra por el material del espacio, pero nada revisaba el
 * plan DESPUÉS: mover un plan de casa al parque, o quitar las mancuernas del
 * inventario, dejaba ejercicios que no se pueden hacer allí sin una sola señal.
 * El plan es lo que te vas a encontrar el lunes, así que el desajuste tiene que
 * salir en el plan, no solo al buscar.
 */

export type EquipmentGap = {
  weekday: number
  dayLabel: string
  index: number
  exercise: Exercise
  /** Sustituto del mismo patrón que sí se puede hacer, o null si no hay. */
  suggestion: Exercise | null
}

/** Ejercicios del plan que el material de `mine` no permite.
 *
 *  `mine` es el conjunto de valores `equipment` del catálogo que el espacio
 *  habilita, tal como lo devuelve `availableEquipment()`. */
export function planEquipmentGaps(
  days: PlanDay[],
  exMap: Map<string, Exercise>,
  mine: Set<string>,
  catalog: Exercise[],
): EquipmentGap[] {
  const out: EquipmentGap[] = []
  for (const day of days) {
    // Lo que ya está en el día no vale como sustituto: no se puede repetir
    // ejercicio dentro de un día (`ADD_EXERCISE` lo rechaza).
    const inDay = new Set(day.items.map((i) => i.exercise_id))
    day.items.forEach((item, index) => {
      const ex = item.exercise ?? exMap.get(item.exercise_id)
      // Un ejercicio que no está ni en el plan hidratado ni en el catálogo no se
      // puede juzgar: se calla, en vez de acusar al espacio.
      if (!ex || mine.has(ex.equipment)) return
      out.push({
        weekday: day.weekday,
        dayLabel: day.label,
        index,
        exercise: ex,
        suggestion: suggestSwap(ex, catalog, mine, inDay),
      })
    })
  }
  return out
}

/** El mejor sustituto disponible: mismo músculo objetivo y mismo patrón, para
 *  que el volumen del plan no se mueva al cambiarlo. Empata a favor de la misma
 *  región (un press inclinado se cambia por otro inclinado) y luego alfabético,
 *  que hace la sugerencia estable entre renders. */
export function suggestSwap(
  ex: Exercise,
  catalog: Exercise[],
  mine: Set<string>,
  exclude: Set<string>,
): Exercise | null {
  const candidates = catalog.filter(
    (c) =>
      c.id !== ex.id &&
      !exclude.has(c.id) &&
      mine.has(c.equipment) &&
      c.target === ex.target &&
      c.role === ex.role,
  )
  if (!candidates.length) return null
  const score = (c: Exercise) => (c.target_region && c.target_region === ex.target_region ? 1 : 0)
  return candidates.sort(
    (a, b) => score(b) - score(a) || a.name_es.localeCompare(b.name_es, 'es'),
  )[0]
}

/** Cuantos ejercicios del plan no se podrian hacer en cada espacio.
 *
 *  `null` significa «no lo se»: un espacio sin inventario registrado no se puede
 *  juzgar —vacio puede ser «aqui solo hay peso corporal» o «no lo he
 *  rellenado»— y leerlo como cero diria que alli cabe todo. */
export function gapCountsByGym(
  gyms: Gym[],
  days: PlanDay[],
  exMap: Map<string, Exercise>,
  catalog: Exercise[],
  unlocks: Record<string, string[]>,
): Map<number, number | null> {
  const map = new Map<number, number | null>()
  for (const g of gyms) {
    if (!g.equipment.length) {
      map.set(g.id, null)
      continue
    }
    map.set(g.id, planEquipmentGaps(days, exMap, availableEquipment(g.equipment, unlocks), catalog).length)
  }
  return map
}
