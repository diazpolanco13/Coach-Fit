import type { Exercise, PlanDay } from '@/lib/api'
import { exerciseLoad } from '@/lib/anatomy'
import { muscleES } from '@/lib/muscle'
import { DEFAULT_SETS } from '@/lib/training'
import { DEFAULT_INDIRECT_WEIGHT } from '@/lib/volume'

/** Eje del radar: estímulo primario vs secundario de un músculo en el día. */
export type DayMusclePoint = {
  muscle: string
  primary: number
  secondary: number
  total: number
}

const MAX_AXES = 6

/** Series efectivas del día, separadas en primario / secundario por músculo.
 *  Misma lógica que `weeklyVolume`, acotada a un solo día y top-N ejes. */
export function dayMuscleStimulus(
  day: PlanDay,
  exMap: Map<string, Exercise>,
  indirectWeight = DEFAULT_INDIRECT_WEIGHT,
): DayMusclePoint[] {
  const acc = new Map<string, { primary: number; secondary: number }>()
  const bump = (muscle: string, field: 'primary' | 'secondary', amount: number) => {
    const cur = acc.get(muscle) ?? { primary: 0, secondary: 0 }
    cur[field] += amount
    acc.set(muscle, cur)
  }

  for (const item of day.items) {
    const ex = item.exercise ?? exMap.get(item.exercise_id)
    if (!ex) continue
    const sets = (item.sets || DEFAULT_SETS) * exerciseLoad(ex)

    if (ex.stimulus?.length) {
      for (const s of ex.stimulus) {
        const key = muscleES(s.muscle)
        const amount = sets * s.weight
        if (s.role === 'primary') bump(key, 'primary', amount)
        else {
          if (ex.target && key === muscleES(ex.target)) continue
          bump(key, 'secondary', amount * (indirectWeight / DEFAULT_INDIRECT_WEIGHT))
        }
      }
    } else {
      if (ex.target) bump(muscleES(ex.target), 'primary', sets)
      for (const sec of ex.secondary_muscles ?? []) {
        const key = muscleES(sec)
        if (ex.target && key === muscleES(ex.target)) continue
        bump(key, 'secondary', sets * indirectWeight)
      }
    }
  }

  return [...acc.entries()]
    .map(([muscle, v]) => ({
      muscle,
      primary: v.primary,
      secondary: v.secondary,
      total: v.primary + v.secondary,
    }))
    .filter((p) => p.total > 0)
    .sort((a, b) => b.total - a.total || b.primary - a.primary)
    .slice(0, MAX_AXES)
}
