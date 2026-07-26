import type { PlanItem, SessionSet, UserEquipment } from '@/lib/api'

export const DEFAULT_SETS = 3
export const DEFAULT_REPS = 10
const FREE_STEP_KG = 2.5

export type TrainingExercise = {
  exercise_id: string
  name_es: string
  image: string | null
  gif: string | null
  target: string
  equipment: string
  sets: number
  reps: number
  weight_kg: number
  /** Pesos que el usuario realmente tiene; vacío = incremento libre de 2.5 kg. */
  availableWeights: number[]
}

export type CompletedSet = {
  exercise_id: string
  set_index: number
  reps: number
  weight_kg: number
  rpe: number
}

export type TrainingState = {
  exs: TrainingExercise[]
  ti: number
  si: number
  phase: 'loading' | 'work' | 'rest' | 'done'
  restLeft: number
  restTotal: number
  log: CompletedSet[]
  /** Cuántas de las series de `log` venían ya guardadas al abrir el modo. Sirve
   *  para distinguir «no he hecho nada todavía» de «ya tenía trabajo hecho»: sin
   *  esto, salir de una sesión retomada avisaría de pérdidas inexistentes. */
  hydrated: number
  startedAt: number
  finishedAt: number | null
}

export type TrainingAction =
  | { type: 'INIT'; exs: TrainingExercise[]; log?: CompletedSet[]; now: number }
  | { type: 'COMPLETE_SET'; rpe: number; restSeconds: number; now: number }
  | { type: 'TICK' }
  | { type: 'SKIP_REST' }
  | { type: 'ADD_REST'; seconds: number }
  | { type: 'ADJUST'; field: 'reps' | 'weight_kg'; delta: number }

export const initialTrainingState: TrainingState = {
  exs: [],
  ti: 0,
  si: 0,
  phase: 'loading',
  restLeft: 0,
  restTotal: 0,
  log: [],
  hydrated: 0,
  startedAt: 0,
  finishedAt: null,
}

const round1 = (n: number) => Math.round(n * 10) / 10

export function stepWeight(current: number, delta: number, available: number[]): number {
  if (!available.length) return Math.max(0, round1(current + delta * FREE_STEP_KG))
  const sorted = [...available].sort((a, b) => a - b)
  if (delta > 0) return sorted.find((w) => w > current) ?? sorted[sorted.length - 1]
  return [...sorted].reverse().find((w) => w < current) ?? 0
}

export function trainingReducer(state: TrainingState, action: TrainingAction): TrainingState {
  switch (action.type) {
    case 'INIT': {
      const log = action.log ?? []
      const cursor = resumeCursor(action.exs, log)
      const pending = action.exs.length > 0 && cursor !== null
      return {
        ...initialTrainingState,
        exs: action.exs,
        log,
        hydrated: log.length,
        ti: cursor?.ti ?? 0,
        si: cursor?.si ?? 0,
        phase: pending ? 'work' : 'done',
        startedAt: action.now,
        finishedAt: pending ? null : action.now,
      }
    }

    case 'COMPLETE_SET': {
      const ex = state.exs[state.ti]
      if (!ex || state.phase !== 'work') return state
      const log = [
        ...state.log,
        {
          exercise_id: ex.exercise_id,
          set_index: state.si + 1,
          reps: ex.reps,
          weight_kg: ex.weight_kg,
          rpe: action.rpe,
        },
      ]
      const moreSets = state.si + 1 < ex.sets
      const moreExs = state.ti + 1 < state.exs.length
      if (!moreSets && !moreExs) {
        return { ...state, log, phase: 'done', restLeft: 0, finishedAt: action.now }
      }
      return {
        ...state,
        log,
        ti: moreSets ? state.ti : state.ti + 1,
        si: moreSets ? state.si + 1 : 0,
        phase: 'rest',
        restLeft: action.restSeconds,
        restTotal: action.restSeconds,
      }
    }

    case 'TICK': {
      if (state.phase !== 'rest') return state
      const restLeft = state.restLeft - 1
      return restLeft <= 0 ? { ...state, restLeft: 0, phase: 'work' } : { ...state, restLeft }
    }

    case 'SKIP_REST':
      return state.phase === 'rest' ? { ...state, restLeft: 0, phase: 'work' } : state

    case 'ADD_REST':
      return state.phase === 'rest'
        ? { ...state, restLeft: state.restLeft + action.seconds, restTotal: state.restTotal + action.seconds }
        : state

    case 'ADJUST': {
      if (!state.exs[state.ti]) return state
      return {
        ...state,
        exs: state.exs.map((e, i) => {
          if (i !== state.ti) return e
          return action.field === 'reps'
            ? { ...e, reps: Math.max(0, e.reps + action.delta) }
            : { ...e, weight_kg: stepWeight(e.weight_kg, action.delta, e.availableWeights) }
        }),
      }
    }

    default:
      return state
  }
}

/** Mancuernas registradas por el usuario, para que el stepper solo ofrezca pesos que tiene. */
export function dumbbellWeights(equipment: UserEquipment[]): number[] {
  const weights = equipment
    .filter((e) => e.equipment_type === 'dumbbell' && e.weight_kg != null)
    .map((e) => e.weight_kg as number)
  return Array.from(new Set(weights)).sort((a, b) => a - b)
}

/** Repetición inicial de una prescripción: el centro del rango. Con el 8–12 por
 *  defecto sale 10, el mismo valor que se sembraba antes a mano. */
export const midReps = (item: Pick<PlanItem, 'rep_min' | 'rep_max'>) =>
  item.rep_min && item.rep_max ? Math.round((item.rep_min + item.rep_max) / 2) : DEFAULT_REPS

export function seedExercise(
  item: PlanItem,
  last: { max_weight: number; max_reps: number } | undefined,
  weights: number[],
  /** Series de ESTE ejercicio ya registradas hoy, en orden. Manda sobre el
   *  histórico: si hoy ya moviste 20 kg, retomar en el peso de la semana
   *  pasada sería un paso atrás. */
  today?: CompletedSet[],
): TrainingExercise {
  const ex = item.exercise
  const resumed = today?.length ? today[today.length - 1] : undefined
  return {
    exercise_id: item.exercise_id,
    name_es: ex?.name_es ?? item.exercise_id,
    image: ex?.image ?? null,
    gif: ex?.gif ?? null,
    target: ex?.target ?? '',
    equipment: ex?.equipment ?? '',
    // Series y reps salen del plan; antes eran 3 y 10 fijos para todos.
    sets: item.sets || DEFAULT_SETS,
    reps: resumed?.reps || last?.max_reps || midReps(item),
    weight_kg: resumed?.weight_kg ?? last?.max_weight ?? 0,
    availableWeights: ex?.equipment === 'dumbbell' ? weights : [],
  }
}

/** Series ya guardadas hoy que pertenecen a los ejercicios de este día.
 *
 *  Las de ejercicios que el plan activo NO incluye se quedan fuera a propósito:
 *  no se muestran, no cuentan para el progreso, y el guardado en modo `merge`
 *  no las toca, así que sobreviven intactas sin pasar por aquí. Es el caso de
 *  haber cambiado de plan a mitad de semana.
 */
export function hydrateLog(saved: SessionSet[], items: PlanItem[]): CompletedSet[] {
  const planned = new Set(items.map((i) => i.exercise_id))
  return saved
    .filter((s) => s.done !== false && planned.has(s.exercise_id))
    .map((s) => ({
      exercise_id: s.exercise_id,
      set_index: s.set_index,
      reps: s.reps ?? 0,
      weight_kg: s.weight_kg ?? 0,
      rpe: s.rpe ?? 7,
    }))
    .sort((a, b) => a.set_index - b.set_index)
}

/** Dónde retomar: el primer ejercicio al que le falten series. `null` si el día
 *  ya está completo, que es cuando se entra directo a la pantalla de resumen. */
export function resumeCursor(
  exs: TrainingExercise[],
  log: CompletedSet[],
): { ti: number; si: number } | null {
  const doneBy = new Map<string, number>()
  for (const s of log) doneBy.set(s.exercise_id, (doneBy.get(s.exercise_id) ?? 0) + 1)
  for (let i = 0; i < exs.length; i++) {
    const done = doneBy.get(exs[i].exercise_id) ?? 0
    if (done < exs[i].sets) return { ti: i, si: done }
  }
  return null
}

export const totalSets = (exs: TrainingExercise[]) => exs.reduce((n, e) => n + e.sets, 0)

export const sessionVolume = (log: CompletedSet[]) => log.reduce((v, s) => v + s.reps * s.weight_kg, 0)

export const avgRpe = (log: CompletedSet[]) =>
  log.length ? Math.round((log.reduce((n, s) => n + s.rpe, 0) / log.length) * 10) / 10 : 7

export const toSessionSets = (log: CompletedSet[]): SessionSet[] => log.map((s) => ({ ...s, done: true }))
