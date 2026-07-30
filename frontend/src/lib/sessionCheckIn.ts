/** Escalas de check-in: índice 0 = bien (default). Solo se toca al empeorar. */

import { muscleES } from '@/lib/muscle'

export type MoodId = 'good' | 'neutral' | 'low' | 'irritable'
export type HealthId = 'good' | 'sore' | 'pain' | 'injured'
export type EnergyId = 'high' | 'normal' | 'low' | 'drained'
/** Solo lo que no es ok se persiste. */
export type PainLevel = 'sore' | 'pain'

/** Motivo al omitir un ejercicio sin completar series. */
export type SkipReason = 'pain' | 'fatigue' | 'time' | 'other'

export type ScaleStep<T extends string> = { id: T; label: string }

/** Izquierda = bien. Deslizar a la derecha = peor. */
export const MOOD_SCALE: ScaleStep<MoodId>[] = [
  { id: 'good', label: 'Bien' },
  { id: 'neutral', label: 'Neutro' },
  { id: 'low', label: 'Bajo' },
  { id: 'irritable', label: 'Irritable' },
]

export const HEALTH_SCALE: ScaleStep<HealthId>[] = [
  { id: 'good', label: 'Bien' },
  { id: 'sore', label: 'Molestia' },
  { id: 'pain', label: 'Dolor' },
  { id: 'injured', label: 'Lesionado' },
]

export const ENERGY_SCALE: ScaleStep<EnergyId>[] = [
  { id: 'high', label: 'Alta' },
  { id: 'normal', label: 'Normal' },
  { id: 'low', label: 'Baja' },
  { id: 'drained', label: 'Agotado' },
]

export const DEFAULT_MOOD: MoodId = 'good'
export const DEFAULT_HEALTH: HealthId = 'good'
export const DEFAULT_ENERGY: EnergyId = 'high'

/** Compat: nombres viejos por si algo externo los importa. */
export const MOOD_OPTIONS = MOOD_SCALE
export const HEALTH_OPTIONS = HEALTH_SCALE
export const ENERGY_OPTIONS = ENERGY_SCALE

export const PAIN_LEVELS: { id: PainLevel | 'ok'; label: string }[] = [
  { id: 'ok', label: 'Ok' },
  { id: 'sore', label: 'Molestia' },
  { id: 'pain', label: 'Dolor' },
]

/** Zonas articulares que el catálogo a veces no lista como target. */
export const JOINT_ZONES: { id: string; label: string }[] = [
  { id: 'wrist', label: 'Muñeca' },
  { id: 'elbow', label: 'Codo' },
  { id: 'shoulder_joint', label: 'Hombro (art.)' },
  { id: 'lower_back_joint', label: 'Lumbar' },
  { id: 'knee', label: 'Rodilla' },
  { id: 'ankle', label: 'Tobillo' },
]

/** Por ejercicio: zona/músculo → severidad. Solo entradas ≠ ok. */
export type ExerciseFeedbackMap = Record<string, Record<string, PainLevel>>

/** Por ejercicio: motivo de omisión deliberada. */
export type ExerciseSkipsMap = Record<string, SkipReason>

export const SKIP_REASONS: { id: SkipReason; label: string; hint: string }[] = [
  { id: 'pain', label: 'Dolor / molestia', hint: 'Marca la zona para seguirla' },
  { id: 'fatigue', label: 'Fatiga', hint: 'Sin energía o demasiado castigado' },
  { id: 'time', label: 'Sin tiempo', hint: 'Cortaste la sesión' },
  { id: 'other', label: 'Otro', hint: 'Equipo, logística…' },
]

export const SKIP_REASON_LABEL: Record<SkipReason, string> = {
  pain: 'Dolor',
  fatigue: 'Fatiga',
  time: 'Sin tiempo',
  other: 'Omitido',
}

export function zoneLabel(zoneId: string): string {
  return JOINT_ZONES.find((z) => z.id === zoneId)?.label ?? muscleES(zoneId)
}

/** «Muñeca · dolor» / «Muñeca · molestia, Codo · dolor». */
export function formatExercisePain(row: Record<string, PainLevel> | undefined): string | null {
  if (!row) return null
  const parts = Object.entries(row).map(([zone, level]) => {
    const sev = level === 'pain' ? 'dolor' : 'molestia'
    return `${zoneLabel(zone)} · ${sev}`
  })
  return parts.length ? parts.join(', ') : null
}

export function hasExercisePain(
  feedback: ExerciseFeedbackMap,
  exerciseId: string,
): boolean {
  const row = feedback[exerciseId]
  return Boolean(row && Object.keys(row).length)
}

/** Estado de un ítem del plan en el día: hecho, pendiente u omitido. */
export function exerciseDayStatus(
  doneSets: number,
  feedback: Record<string, PainLevel> | undefined,
  skipReason: SkipReason | undefined,
): 'done' | 'pending' | 'skipped' {
  if (doneSets > 0) return 'done'
  if (skipReason || (feedback && Object.keys(feedback).length > 0)) return 'skipped'
  return 'pending'
}

export function setZonePain(
  feedback: ExerciseFeedbackMap,
  exerciseId: string,
  zoneId: string,
  level: PainLevel | 'ok',
): ExerciseFeedbackMap {
  const prev = { ...(feedback[exerciseId] ?? {}) }
  if (level === 'ok') delete prev[zoneId]
  else prev[zoneId] = level
  const next = { ...feedback }
  if (Object.keys(prev).length === 0) delete next[exerciseId]
  else next[exerciseId] = prev
  return next
}

export function removeExerciseFeedback(
  feedback: ExerciseFeedbackMap,
  exerciseId: string,
): ExerciseFeedbackMap {
  if (!(exerciseId in feedback)) return feedback
  const next = { ...feedback }
  delete next[exerciseId]
  return next
}

export function scaleIndex<T extends string>(
  scale: ScaleStep<T>[],
  id: T | null | undefined,
  fallback: T,
): number {
  const want = id ?? fallback
  const i = scale.findIndex((s) => s.id === want)
  return i < 0 ? 0 : i
}

/** Color del tramo de riesgo: 0 verde (bien) … último rojo (malo). */
export function scaleTone(index: number, maxIndex: number): {
  bar: string
  text: string
} {
  const t = maxIndex <= 0 ? 0 : index / maxIndex
  if (t <= 0.01) return { bar: 'bg-emerald-500', text: 'text-emerald-500' }
  if (t <= 0.4) return { bar: 'bg-lime-500', text: 'text-lime-500' }
  if (t <= 0.7) return { bar: 'bg-amber-500', text: 'text-amber-500' }
  return { bar: 'bg-red-500', text: 'text-red-500' }
}

/** Color del esfuerzo (RPE): bajo = gris apagado, alto = naranja de marca.
 *  El rojo de `scaleTone` aquí se lee como «malo»; el RPE alto es trabajo hecho. */
export function effortTone(index: number, maxIndex: number): {
  bar: string
  text: string
} {
  const t = maxIndex <= 0 ? 0 : index / maxIndex
  if (t <= 0.25) return { bar: 'bg-muted-foreground/40', text: 'text-muted-foreground' }
  if (t <= 0.5) return { bar: 'bg-muted-foreground/70', text: 'text-muted-foreground' }
  if (t <= 0.75) return { bar: 'bg-primary/70', text: 'text-primary' }
  return { bar: 'bg-primary', text: 'text-primary' }
}
