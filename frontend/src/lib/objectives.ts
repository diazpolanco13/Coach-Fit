import type { PlanGoals } from '@/lib/api'
import { MUSCLE_LABELS_ES } from '@/lib/muscle'

/** Las claves de músculo de los presets son las etiquetas canónicas en español
 *  que produce `muscleES()`. Este tipo las valida en tiempo de compilación: un
 *  typo aquí produciría un override que nunca casa con nada — fallo silencioso,
 *  no excepción. */
type MuscleLabel = (typeof MUSCLE_LABELS_ES)[number]

export type Objective = {
  id: string
  label: string
  hint: string
  goals: PlanGoals & { overrides: Array<{ muscle: MuscleLabel; min: number; max: number }> }
}

/**
 * Presets de volumen semanal (series duras por músculo).
 *
 * Rangos anclados a la literatura de hipertrofia / periodización (dosis-respuesta
 * tipo Schoenfeld; marcos MEV–MAV–MRV): el mínimo es estímulo útil, el máximo
 * la zona productiva antes de recuperar mal. El app cuenta directo + indirecto
 * (p. ej. presses → hombros), así que los topes de Hombros van más holgados.
 *
 * El objetivo es un PRESET, no un candado: al aplicarlo rellena el editor y el
 * usuario puede editarlo. El servidor guarda `objective` y `goals` por separado.
 */
export const OBJECTIVES: Objective[] = [
  {
    id: 'integral',
    label: 'Integral',
    hint: 'Zona productiva (~10–20 series/músculo·semana) para un desarrollo equilibrado.',
    goals: { base: { min: 10, max: 20 }, overrides: [] },
  },
  {
    id: 'torso',
    label: 'Enfoque torso',
    hint: 'MAV en pecho/espalda/hombros; piernas en mantenimiento (MEV).',
    goals: {
      base: { min: 6, max: 12 },
      overrides: [
        { muscle: 'Pecho', min: 12, max: 20 },
        { muscle: 'Dorsales', min: 12, max: 20 },
        { muscle: 'Espalda alta', min: 10, max: 18 },
        // Tope holgado: presses suman mucho hombro anterior vía indirecto.
        { muscle: 'Hombros', min: 12, max: 24 },
        { muscle: 'Tríceps', min: 8, max: 16 },
        { muscle: 'Bíceps', min: 8, max: 16 },
        { muscle: 'Cuádriceps', min: 6, max: 10 },
        { muscle: 'Isquios', min: 6, max: 10 },
        { muscle: 'Glúteos', min: 6, max: 10 },
        { muscle: 'Abdomen', min: 6, max: 12 },
      ],
    },
  },
  {
    id: 'piernas',
    label: 'Enfoque piernas',
    hint: 'MAV en glúteos/cuádriceps/isquios; torso en mantenimiento (MEV).',
    goals: {
      base: { min: 6, max: 12 },
      overrides: [
        { muscle: 'Glúteos', min: 12, max: 20 },
        { muscle: 'Cuádriceps', min: 12, max: 20 },
        { muscle: 'Isquios', min: 10, max: 18 },
        { muscle: 'Gemelos', min: 8, max: 16 },
        { muscle: 'Abdomen', min: 6, max: 12 },
        { muscle: 'Pecho', min: 6, max: 10 },
        { muscle: 'Dorsales', min: 6, max: 10 },
        { muscle: 'Espalda alta', min: 4, max: 10 },
        { muscle: 'Hombros', min: 6, max: 12 },
      ],
    },
  },
  {
    id: 'hipertrofia',
    label: 'Hipertrofia',
    hint: 'Volumen alto en zona MAV; series cercanas al fallo técnico.',
    goals: { base: { min: 12, max: 22 }, overrides: [] },
  },
  {
    id: 'fuerza',
    label: 'Fuerza',
    hint: 'Pocas series duras, más carga y rangos bajos de repeticiones.',
    goals: { base: { min: 6, max: 12 }, overrides: [] },
  },
  {
    id: 'carrera10k',
    label: 'Carrera 10k',
    hint: 'Fuerza de soporte (MEV–MAV baja) para piernas y core, sin hinchar hipertrofia.',
    goals: {
      base: { min: 4, max: 10 },
      overrides: [
        { muscle: 'Cuádriceps', min: 8, max: 16 },
        { muscle: 'Isquios', min: 8, max: 16 },
        { muscle: 'Glúteos', min: 8, max: 16 },
        { muscle: 'Gemelos', min: 8, max: 16 },
        // El radar usa «Abdomen» (plancha); «Core» casi no recibe series directas.
        { muscle: 'Abdomen', min: 6, max: 12 },
      ],
    },
  },
]

export const objectiveByLabel = (label: string | null) =>
  label ? OBJECTIVES.find((o) => o.label === label) ?? null : null
