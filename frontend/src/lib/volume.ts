import type { Exercise, PlanDay, PlanGoals, VolumeRange } from '@/lib/api'
import { exerciseLoad, regionES } from '@/lib/anatomy'
import {
  contributesMuscleHypertrophy,
  isEnduranceCardio,
  isMuscleNeutralMetcon,
  isPassiveStretch,
} from '@/lib/cardio'
import { muscleES } from '@/lib/muscle'
import { resolveSection } from '@/lib/plan'
import { DEFAULT_SETS } from '@/lib/training'

/** Fallback si el ejercicio aún no trae `stimulus` (catálogo viejo en caché).
 *  Una serie al objetivo cuenta entera; como secundario, media. */
export const DEFAULT_INDIRECT_WEIGHT = 0.5

/** Si el exceso es mayoritariamente indirecto, el mensaje culpa a compuestos. */
export const INDIRECT_DOMINANCE_RATIO = 0.55

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
  /** Entra en el radar de objetivos. El total ya es series efectivas:
   *  lo secundario viene ponderado (p. ej. ×0.5) y sumado a lo directo. */
  programmed: boolean
  /** Desglose por región del trabajo directo (si el catálogo trae región). */
  regions: RegionVolume[]
}

/** Por debajo de esto el total es ruido (arrastre mínimo) y no se juzga
 *  contra el rango 10–30. Hombros a 16 por presses de pecho sí entra. */
export const VOLUME_TRACK_MIN = 3

export type VolumeStatus = 'low' | 'ok' | 'high' | 'incidental'

function isCardioAxis(muscleKey: string): boolean {
  return muscleKey === 'Cardio' || muscleKey === 'cardiovascular system'
}

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
      // Calentamiento y stretch pasivo: no hard sets. Cardio endurance tampoco.
      // Metcons del bloque Cardio solo pueden sumar al eje Cardio, no a músculos.
      if (resolveSection(item) === 'warmup') continue
      const ex = item.exercise ?? exMap.get(item.exercise_id)
      if (!ex) continue
      if (isEnduranceCardio(ex)) continue
      if (isPassiveStretch(ex)) continue

      const cardioOnly =
        resolveSection(item) === 'cardio' ||
        isMuscleNeutralMetcon(ex) ||
        !contributesMuscleHypertrophy(ex)

      const sets = (item.sets || DEFAULT_SETS) * exerciseLoad(ex)
      if (ex.stimulus?.length) {
        for (const s of ex.stimulus) {
          const key = muscleES(s.muscle)
          if (cardioOnly && !isCardioAxis(key)) continue
          const amount = sets * s.weight
          if (s.role === 'primary') bump(key, 'direct', amount, s.region ?? ex.target_region)
          else {
            if (ex.target && key === muscleES(ex.target)) continue
            bump(key, 'indirect', amount * (indirectWeight / DEFAULT_INDIRECT_WEIGHT))
          }
        }
      } else if (!cardioOnly) {
        if (ex.target) bump(muscleES(ex.target), 'direct', sets, ex.target_region)
        for (const sec of ex.secondary_muscles ?? []) {
          const key = muscleES(sec)
          if (ex.target && key === muscleES(ex.target)) continue
          bump(key, 'indirect', sets * indirectWeight)
        }
      } else if (ex.target && isCardioAxis(muscleES(ex.target))) {
        bump(muscleES(ex.target), 'direct', sets, ex.target_region)
      }
    }
  }

  return [...acc.entries()]
    .map(([muscle, v]) => {
      const total = v.direct + v.indirect
      return {
        muscle,
        direct: v.direct,
        indirect: v.indirect,
        total,
        programmed: total >= VOLUME_TRACK_MIN,
        regions: [...v.regions.entries()]
          .map(([region, total]) => ({ region, total }))
          .sort((a, b) => b.total - a.total),
      }
    })
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

/** Mensaje de exceso: si domina lo indirecto, culpa a presses/tirones. */
export function overvolumeMessage(v: MuscleVolume, goals: PlanGoals): string | null {
  if (volumeStatus(v, goals) !== 'high') return null
  const max = goalFor(goals, v.muscle).max
  const head = `${v.muscle} (${formatSets(v.total)}/${max})`
  if (v.total > 0 && v.indirect / v.total > INDIRECT_DOMINANCE_RATIO) {
    return (
      `${head}: exceso impulsado principalmente por series indirectas (presses / tirones). ` +
      `Considera reducir el aislamiento de este músculo o bajar el volumen de los compuestos que lo cargan.`
    )
  }
  return `${head}: pasas del tope en volumen directo. Baja series o quita algún aislamiento.`
}

/** Une mensajes de varios músculos overloaded (lista o párrafo). */
export function overvolumeMessages(volumes: MuscleVolume[], goals: PlanGoals): string[] {
  return volumes
    .filter((v) => volumeStatus(v, goals) === 'high')
    .map((v) => overvolumeMessage(v, goals))
    .filter((m): m is string => Boolean(m))
}
