import type { Exercise, PlanDay, PlanGoals, VolumeRange } from '@/lib/api'
import { exerciseLoad, regionES } from '@/lib/anatomy'
import { isEnduranceCardio } from '@/lib/cardio'
import { muscleES } from '@/lib/muscle'
import { DEFAULT_SETS } from '@/lib/training'

/** Fallback si el ejercicio aún no trae `stimulus` (catálogo viejo en caché).
 *  Una serie al objetivo cuenta entera; como secundario, media. */
export const DEFAULT_INDIRECT_WEIGHT = 0.5

export type RegionVolume = {
  /** Etiqueta en español de la región (superior, anti-extensión…). */
  region: string
  total: number
}

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
  /** Desglose por región del trabajo directo (si el catálogo trae región). */
  regions: RegionVolume[]
}

export type VolumeStatus = 'low' | 'ok' | 'high' | 'incidental'

export function weeklyVolume(
  days: PlanDay[],
  exMap: Map<string, Exercise>,
  indirectWeight = DEFAULT_INDIRECT_WEIGHT,
): MuscleVolume[] {
  const acc = new Map<string, { direct: number; indirect: number; regions: Map<string, number> }>()
  const bump = (
    muscle: string,
    field: 'direct' | 'indirect',
    amount: number,
    region?: string | null,
  ) => {
    const cur = acc.get(muscle) ?? { direct: 0, indirect: 0, regions: new Map() }
    cur[field] += amount
    if (field === 'direct' && region) {
      const label = regionES(region)
      if (label) cur.regions.set(label, (cur.regions.get(label) ?? 0) + amount)
    }
    acc.set(muscle, cur)
  }

  for (const day of days) {
    for (const item of day.items) {
      // `item.exercise` viene hidratado por el servidor; el mapa del catálogo es
      // el respaldo para un borrador local que aún no ha ido y vuelto.
      const ex = item.exercise ?? exMap.get(item.exercise_id)
      if (!ex) continue
      // Cardio de resistencia no aporta series musculares al radar de volumen.
      if (isEnduranceCardio(ex)) continue
      const sets = (item.sets || DEFAULT_SETS) * exerciseLoad(ex)
      if (ex.stimulus?.length) {
        for (const s of ex.stimulus) {
          const key = muscleES(s.muscle)
          const amount = sets * s.weight
          if (s.role === 'primary') bump(key, 'direct', amount, s.region ?? ex.target_region)
          else {
            if (ex.target && key === muscleES(ex.target)) continue
            // `indirectWeight` del plan escala todos los secundarios a la vez.
            bump(key, 'indirect', amount * (indirectWeight / DEFAULT_INDIRECT_WEIGHT))
          }
        }
      } else {
        if (ex.target) bump(muscleES(ex.target), 'direct', sets, ex.target_region)
        for (const sec of ex.secondary_muscles ?? []) {
          const key = muscleES(sec)
          if (ex.target && key === muscleES(ex.target)) continue
          bump(key, 'indirect', sets * indirectWeight)
        }
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
      regions: [...v.regions.entries()]
        .map(([region, total]) => ({ region, total }))
        .sort((a, b) => b.total - a.total),
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
