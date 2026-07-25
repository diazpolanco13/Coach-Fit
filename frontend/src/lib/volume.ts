import type { Exercise, PlanDay, PlanGoals, VolumeRange } from '@/lib/api'
import { muscleES } from '@/lib/muscle'
import { DEFAULT_SETS } from '@/lib/training'

/** Una serie del músculo objetivo cuenta entera; como secundario cuenta media.
 *
 *  Es un único peso plano y no un peso por ejercicio a propósito: el catálogo
 *  trae `secondary_muscles` como lista sin ponderar en 1324 ejercicios, así que
 *  poner «Press banca → Tríceps 0.4, Hombros 0.3» serían ~3300 decisiones
 *  inventadas, no obtenidas. Un número inventado en un medidor de volumen es
 *  peor que una constante que todos sabemos aproximada: parece precisión y no lo
 *  es. Lo que sí se puede es ajustarlo por plan. */
export const DEFAULT_INDIRECT_WEIGHT = 0.5

export type MuscleVolume = {
  /** Etiqueta en español, que además hace de clave canónica: el catálogo usa
   *  `quads` como objetivo y `quadriceps` como secundario, y ambos mapean a
   *  «Cuádriceps», así que agrupar por aquí une los sinónimos. */
  muscle: string
  /** Series de ejercicios cuyo objetivo principal es este músculo. */
  direct: number
  /** Series donde aparece como secundario, ya ponderadas. */
  indirect: number
  total: number
  /** Si no hay trabajo directo el músculo solo se arrastra de otros
   *  ejercicios, y entonces no tiene sentido juzgar si va corto. */
  programmed: boolean
}

export type VolumeStatus = 'low' | 'ok' | 'high' | 'incidental'

export function weeklyVolume(
  days: PlanDay[],
  exMap: Map<string, Exercise>,
  indirectWeight = DEFAULT_INDIRECT_WEIGHT,
): MuscleVolume[] {
  const acc = new Map<string, { direct: number; indirect: number }>()
  const bump = (muscle: string, field: 'direct' | 'indirect', amount: number) => {
    const cur = acc.get(muscle) ?? { direct: 0, indirect: 0 }
    cur[field] += amount
    acc.set(muscle, cur)
  }

  for (const day of days) {
    for (const item of day.items) {
      // `item.exercise` viene hidratado por el servidor; el mapa del catálogo es
      // el respaldo para un borrador local que aún no ha ido y vuelto.
      const ex = item.exercise ?? exMap.get(item.exercise_id)
      if (!ex) continue
      const sets = item.sets || DEFAULT_SETS
      if (ex.target) bump(muscleES(ex.target), 'direct', sets)
      for (const sec of ex.secondary_muscles ?? []) {
        const key = muscleES(sec)
        // Un músculo que ya es el objetivo no suma además como secundario.
        if (ex.target && key === muscleES(ex.target)) continue
        bump(key, 'indirect', sets * indirectWeight)
      }
    }
  }

  return [...acc.entries()]
    .map(([muscle, v]) => ({
      muscle,
      direct: v.direct,
      indirect: v.indirect,
      total: v.direct + v.indirect,
      programmed: v.direct > 0,
    }))
    .sort((a, b) => b.total - a.total)
}

/** Objetivo efectivo de un músculo: su prioridad si la tiene, si no el rango
 *  base. La clave es la etiqueta en español, la misma que produce
 *  `weeklyVolume` en `MuscleVolume.muscle`. */
export function goalFor(goals: PlanGoals, muscle: string): VolumeRange {
  return goals.overrides.find((o) => o.muscle === muscle) ?? goals.base
}

export function volumeStatus(v: MuscleVolume, goals: PlanGoals): VolumeStatus {
  if (!v.programmed) return 'incidental'
  const { min, max } = goalFor(goals, v.muscle)
  if (v.total > max) return 'high'
  if (v.total < min) return 'low'
  return 'ok'
}

/** Músculos que ya están en su tope o por encima. Sirve para avisar en la
 *  biblioteca antes de añadir todavía más trabajo del mismo grupo. */
export function overloadedMuscles(volumes: MuscleVolume[], goals: PlanGoals): Set<string> {
  return new Set(
    volumes.filter((v) => v.programmed && v.total >= goalFor(goals, v.muscle).max).map((v) => v.muscle),
  )
}

/** Prioridades guardadas para músculos que ya no existen en el catálogo. Se
 *  muestran en el editor para que el usuario las limpie, en vez de quedar como
 *  objetivos fantasma que nunca se aplican. */
export function orphanGoals(goals: PlanGoals, known: string[]): string[] {
  const set = new Set(known)
  return goals.overrides.filter((o) => !set.has(o.muscle)).map((o) => o.muscle)
}

export const formatSets = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))
