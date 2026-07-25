import type { Exercise, PlanDay } from '@/lib/api'
import { muscleES } from '@/lib/muscle'
import { DEFAULT_SETS } from '@/lib/training'

/** Una serie del músculo objetivo cuenta entera; como secundario cuenta media.
 *  Es la convención habitual para volumen directo vs. indirecto. */
const INDIRECT_WEIGHT = 0.5

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
  setsPerExercise = DEFAULT_SETS,
): MuscleVolume[] {
  const acc = new Map<string, { direct: number; indirect: number }>()
  const bump = (muscle: string, field: 'direct' | 'indirect', amount: number) => {
    const cur = acc.get(muscle) ?? { direct: 0, indirect: 0 }
    cur[field] += amount
    acc.set(muscle, cur)
  }

  for (const day of days) {
    for (const id of day.exercise_ids) {
      const ex = exMap.get(id)
      if (!ex) continue
      if (ex.target) bump(muscleES(ex.target), 'direct', setsPerExercise)
      for (const sec of ex.secondary_muscles ?? []) {
        const key = muscleES(sec)
        // Un músculo que ya es el objetivo no suma además como secundario.
        if (ex.target && key === muscleES(ex.target)) continue
        bump(key, 'indirect', setsPerExercise * INDIRECT_WEIGHT)
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

export function volumeStatus(v: MuscleVolume, min: number, max: number): VolumeStatus {
  if (!v.programmed) return 'incidental'
  if (v.total > max) return 'high'
  if (v.total < min) return 'low'
  return 'ok'
}

/** Músculos que ya están en el tope o por encima. Sirve para avisar en el
 *  selector antes de añadir todavía más trabajo del mismo grupo. */
export function overloadedMuscles(volumes: MuscleVolume[], max: number): Set<string> {
  return new Set(volumes.filter((v) => v.programmed && v.total >= max).map((v) => v.muscle))
}

export const formatSets = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))
