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

/** El objetivo es un PRESET, no un candado: al aplicarlo rellena el editor de
 *  objetivos de volumen y a partir de ahí el usuario los edita libremente. El
 *  servidor guarda `objective` y `goals` por separado y nunca deriva uno del
 *  otro, así que editar los objetivos no cambia la intención ni al revés. */
export const OBJECTIVES: Objective[] = [
  {
    id: 'integral',
    label: 'Integral',
    hint: 'Reparto equilibrado; ningún grupo por debajo del mínimo.',
    goals: { base: { min: 10, max: 20 }, overrides: [] },
  },
  {
    id: 'torso',
    label: 'Enfoque torso',
    hint: 'Prioriza pecho, dorsales y hombros; piernas en mantenimiento.',
    goals: {
      base: { min: 8, max: 14 },
      overrides: [
        { muscle: 'Pecho', min: 14, max: 22 },
        { muscle: 'Dorsales', min: 12, max: 18 },
        { muscle: 'Espalda alta', min: 12, max: 18 },
        { muscle: 'Hombros', min: 12, max: 18 },
        { muscle: 'Tríceps', min: 10, max: 16 },
        { muscle: 'Bíceps', min: 10, max: 16 },
        { muscle: 'Cuádriceps', min: 6, max: 10 },
        { muscle: 'Isquios', min: 6, max: 10 },
      ],
    },
  },
  {
    id: 'hipertrofia',
    label: 'Hipertrofia',
    hint: 'Más volumen en todo, con series cerca del fallo.',
    goals: { base: { min: 12, max: 20 }, overrides: [] },
  },
  {
    id: 'fuerza',
    label: 'Fuerza',
    hint: 'Menos series, más carga y rangos cortos de repeticiones.',
    goals: { base: { min: 8, max: 14 }, overrides: [] },
  },
  {
    id: 'carrera10k',
    label: 'Carrera 10k',
    hint: 'Fuerza de tren inferior y core que sostenga la carrera.',
    goals: {
      base: { min: 6, max: 12 },
      overrides: [
        { muscle: 'Cuádriceps', min: 8, max: 14 },
        { muscle: 'Isquios', min: 8, max: 14 },
        { muscle: 'Glúteos', min: 8, max: 14 },
        { muscle: 'Gemelos', min: 8, max: 14 },
        { muscle: 'Core', min: 8, max: 14 },
      ],
    },
  },
]

export const objectiveByLabel = (label: string | null) =>
  label ? OBJECTIVES.find((o) => o.label === label) ?? null : null
