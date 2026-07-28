import type { PlanItem, SessionSet, UserEquipment } from '@/lib/api'
import type { AfterSetPref, SessionViewPref } from '@/lib/settings'

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
  view: SessionViewPref
  /** La franja de ejercicios pide atención (p. ej. tras completar con afterSet=strip). */
  stripHint: boolean
}

export type TrainingAction =
  | { type: 'INIT'; exs: TrainingExercise[]; log?: CompletedSet[]; view?: SessionViewPref; now: number }
  | {
      type: 'COMPLETE_SET'
      rpe: number
      restSeconds: number
      advance: AfterSetPref
      now: number
    }
  | { type: 'TICK' }
  | { type: 'SKIP_REST' }
  | { type: 'ADD_REST'; seconds: number }
  | { type: 'ADJUST'; field: 'reps' | 'weight_kg'; delta: number }
  | { type: 'SELECT_EXERCISE'; ti: number }
  | { type: 'REORDER'; from: number; to: number }
  | { type: 'SET_VIEW'; view: SessionViewPref }
  | { type: 'CLEAR_STRIP_HINT' }
  | { type: 'GO_DONE'; now: number }
  | { type: 'RESUME_EDIT' }
  | { type: 'REMOVE_EXERCISE'; exerciseId: string }
  | { type: 'REPLACE_EXERCISE_SETS'; exerciseId: string; sets: CompletedSet[] }

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
  view: 'focus',
  stripHint: false,
}

const round1 = (n: number) => Math.round(n * 10) / 10

export function stepWeight(current: number, delta: number, available: number[]): number {
  if (!available.length) return Math.max(0, round1(current + delta * FREE_STEP_KG))
  const sorted = [...available].sort((a, b) => a - b)
  if (delta > 0) return sorted.find((w) => w > current) ?? sorted[sorted.length - 1]
  return [...sorted].reverse().find((w) => w < current) ?? 0
}

export function setsDoneFor(exerciseId: string, log: CompletedSet[]): number {
  return log.filter((s) => s.exercise_id === exerciseId).length
}

/** Cursor para un índice de ejercicio: si = series ya hechas (o sets si está completo). */
export function cursorForExercise(
  exs: TrainingExercise[],
  log: CompletedSet[],
  ti: number,
): { ti: number; si: number } {
  const ex = exs[ti]
  if (!ex) return { ti: 0, si: 0 }
  const done = setsDoneFor(ex.exercise_id, log)
  return { ti, si: Math.min(done, ex.sets) }
}

function nextIncompleteAfter(
  exs: TrainingExercise[],
  log: CompletedSet[],
  fromTi: number,
): { ti: number; si: number } | null {
  for (let i = fromTi + 1; i < exs.length; i++) {
    const done = setsDoneFor(exs[i].exercise_id, log)
    if (done < exs[i].sets) return { ti: i, si: done }
  }
  for (let i = 0; i <= fromTi; i++) {
    const done = setsDoneFor(exs[i].exercise_id, log)
    if (done < exs[i].sets) return { ti: i, si: done }
  }
  return null
}

function allComplete(exs: TrainingExercise[], log: CompletedSet[]): boolean {
  if (!exs.length) return true
  return exs.every((e) => setsDoneFor(e.exercise_id, log) >= e.sets)
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
        view: action.view ?? 'focus',
        stripHint: false,
      }
    }

    case 'COMPLETE_SET': {
      const ex = state.exs[state.ti]
      if (!ex || state.phase !== 'work') return state
      if (state.si >= ex.sets) return state
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
      if (allComplete(state.exs, log)) {
        return {
          ...state,
          log,
          si: state.si + 1,
          phase: 'done',
          restLeft: 0,
          finishedAt: action.now,
          stripHint: false,
        }
      }

      const moreSets = state.si + 1 < ex.sets
      let ti = state.ti
      let si = state.si + 1
      let stripHint = false

      if (moreSets) {
        // Siguiente serie del mismo ejercicio.
        si = state.si + 1
        if (action.advance === 'strip') stripHint = true
      } else if (action.advance === 'next') {
        const next = nextIncompleteAfter(state.exs, log, state.ti)
        if (next) {
          ti = next.ti
          si = next.si
        }
      } else {
        // stay / strip: ejercicio agotado; el usuario elige el siguiente.
        si = ex.sets
        stripHint = action.advance === 'strip' || action.advance === 'stay'
      }

      const rest = action.restSeconds > 0
      return {
        ...state,
        log,
        ti,
        si,
        phase: rest ? 'rest' : 'work',
        restLeft: rest ? action.restSeconds : 0,
        restTotal: rest ? action.restSeconds : 0,
        stripHint,
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

    case 'SELECT_EXERCISE': {
      if (action.ti < 0 || action.ti >= state.exs.length) return state
      const { ti, si } = cursorForExercise(state.exs, state.log, action.ti)
      const ex = state.exs[ti]
      const pending = ex && si < ex.sets
      return {
        ...state,
        ti,
        si,
        phase: pending ? 'work' : state.phase === 'done' ? 'done' : 'work',
        restLeft: 0,
        stripHint: false,
        finishedAt: pending ? null : state.finishedAt,
      }
    }

    case 'REORDER': {
      const { from, to } = action
      if (
        from === to ||
        from < 0 ||
        to < 0 ||
        from >= state.exs.length ||
        to >= state.exs.length
      ) {
        return state
      }
      const currentId = state.exs[state.ti]?.exercise_id
      const exs = [...state.exs]
      const [moved] = exs.splice(from, 1)
      exs.splice(to, 0, moved)
      const ti = currentId ? Math.max(0, exs.findIndex((e) => e.exercise_id === currentId)) : state.ti
      const { si } = cursorForExercise(exs, state.log, ti)
      return { ...state, exs, ti, si }
    }

    case 'SET_VIEW':
      return { ...state, view: action.view, stripHint: false }

    case 'CLEAR_STRIP_HINT':
      return { ...state, stripHint: false }

    case 'GO_DONE':
      return {
        ...state,
        phase: 'done',
        restLeft: 0,
        finishedAt: action.now,
        stripHint: false,
      }

    case 'RESUME_EDIT':
      return {
        ...state,
        phase: 'work',
        view: 'list',
        finishedAt: null,
        stripHint: false,
        restLeft: 0,
      }

    case 'REMOVE_EXERCISE': {
      const exs = state.exs.filter((e) => e.exercise_id !== action.exerciseId)
      const log = state.log.filter((s) => s.exercise_id !== action.exerciseId)
      if (!exs.length) {
        return {
          ...state,
          exs,
          log,
          ti: 0,
          si: 0,
          phase: 'done',
          finishedAt: state.finishedAt ?? Date.now(),
          stripHint: false,
        }
      }
      const ti = Math.min(state.ti, exs.length - 1)
      const { si } = cursorForExercise(exs, log, ti)
      const pending = !allComplete(exs, log)
      return {
        ...state,
        exs,
        log,
        ti,
        si,
        phase: pending ? 'work' : 'done',
        finishedAt: pending ? null : state.finishedAt ?? Date.now(),
        stripHint: false,
      }
    }

    case 'REPLACE_EXERCISE_SETS': {
      const others = state.log.filter((s) => s.exercise_id !== action.exerciseId)
      const log = [...others, ...action.sets].sort((a, b) => {
        if (a.exercise_id !== b.exercise_id) return a.exercise_id.localeCompare(b.exercise_id)
        return a.set_index - b.set_index
      })
      const maxIdx = action.sets.reduce((m, s) => Math.max(m, s.set_index), 0)
      const exs = state.exs.map((e) =>
        e.exercise_id === action.exerciseId && maxIdx > e.sets ? { ...e, sets: maxIdx } : e,
      )
      const { ti, si } = cursorForExercise(exs, log, state.ti)
      const pending = !allComplete(exs, log)
      return {
        ...state,
        exs,
        log,
        ti,
        si,
        phase: pending ? (state.phase === 'rest' ? 'rest' : 'work') : 'done',
        finishedAt: pending ? null : state.finishedAt ?? Date.now(),
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
  for (let i = 0; i < exs.length; i++) {
    const done = setsDoneFor(exs[i].exercise_id, log)
    if (done < exs[i].sets) return { ti: i, si: done }
  }
  return null
}

export const totalSets = (exs: TrainingExercise[]) => exs.reduce((n, e) => n + e.sets, 0)

export const sessionVolume = (log: CompletedSet[]) => log.reduce((v, s) => v + s.reps * s.weight_kg, 0)

export const avgRpe = (log: CompletedSet[]) =>
  log.length ? Math.round((log.reduce((n, s) => n + s.rpe, 0) / log.length) * 10) / 10 : 7

export const toSessionSets = (log: CompletedSet[]): SessionSet[] => log.map((s) => ({ ...s, done: true }))
