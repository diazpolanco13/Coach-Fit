import type { Plan, PlanDay, PlanGoals, PlanItem, PlanPayloadIn } from '@/lib/api'
import { safeInsertIndex, safeReorderDay } from '@/lib/sessionSafety'
import { DEFAULT_SETS } from '@/lib/training'

export const DEFAULT_REP_MIN = 8
export const DEFAULT_REP_MAX = 12
export const MIN_SETS = 1
export const MAX_SETS = 10
export const MAX_EXERCISES_PER_DAY = 20

/** Espeja backend/app/plans.py. Solo se usa mientras no llega el plan real. */
export const DEFAULT_GOALS: PlanGoals = { base: { min: 10, max: 20 }, overrides: [] }

const WEEKDAY_LABELS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

export type PlanDraft = {
  planId: number | null
  name: string
  days: PlanDay[]
  goals: PlanGoals
  restSeconds: number
  indirectWeight: number
  gymId: number | null
  objective: string | null
  /** Serialización de lo último confirmado por el servidor: base de `isDirty`. */
  saved: string
}

export type PlanAction =
  | { type: 'LOAD'; plan: Plan }
  | { type: 'RENAME'; name: string }
  | { type: 'PATCH_DAY'; weekday: number; patch: Partial<Pick<PlanDay, 'label' | 'focus'>> }
  | { type: 'ADD_EXERCISE'; weekday: number; exerciseId: string; exercise: PlanItem['exercise'] }
  | { type: 'REMOVE_EXERCISE'; weekday: number; index: number }
  | { type: 'MOVE_EXERCISE'; weekday: number; index: number; dir: -1 | 1 }
  | { type: 'MOVE_EXERCISE_TO_DAY'; fromWeekday: number; fromIndex: number; toWeekday: number }
  | { type: 'REORDER_DAY_SAFE'; weekday: number }
  | { type: 'PATCH_ITEM'; weekday: number; index: number; patch: Partial<PlanItem> }
  | { type: 'NORMALIZE_ITEM'; weekday: number; index: number }
  | { type: 'CLEAR_DAY'; weekday: number }
  | { type: 'SET_BASE_GOAL'; min: number; max: number }
  | { type: 'SET_MUSCLE_GOAL'; muscle: string; min: number; max: number }
  | { type: 'REMOVE_MUSCLE_GOAL'; muscle: string }
  | { type: 'SET_REST_SECONDS'; seconds: number }
  | { type: 'SET_GYM'; gymId: number | null }
  | { type: 'SET_OBJECTIVE'; objective: string | null }
  /** El objetivo nunca escribe los objetivos de volumen por su cuenta: se
   *  aplica en un paso aparte y explícito, para no pisar lo que el usuario ya
   *  hubiera ajustado. */
  | { type: 'APPLY_OBJECTIVE_GOALS'; goals: PlanGoals; mode: 'reemplazar' | 'rellenar' }
  | { type: 'SET_INDIRECT_WEIGHT'; weight: number }

const emptyDays = (): PlanDay[] =>
  WEEKDAY_LABELS.map((label, weekday) => ({ weekday, label, focus: 'rest', items: [] }))

export const emptyDraft: PlanDraft = {
  planId: null,
  name: '',
  days: emptyDays(),
  goals: DEFAULT_GOALS,
  restSeconds: 90,
  indirectWeight: 0.5,
  gymId: null,
  objective: null,
  saved: '',
}

const editableDays = (days: PlanDay[]) =>
  days.map((day) => ({
    weekday: day.weekday,
    label: day.label,
    focus: day.focus,
    // `exercise` lo rellena el servidor y no forma parte de lo editable, así que
    // dejarlo fuera evita marcar el plan como sucio tras un simple refetch.
    items: day.items.map(({ exercise: _exercise, ...rest }) => rest),
  }))

/** Todo campo editable TIENE que aparecer aquí. Si se añade al borrador y se
 *  olvida en `serialize`, cambiarlo no marca el plan como sucio y no se guarda
 *  nunca, en silencio. */
export const serialize = (d: Omit<PlanDraft, 'planId' | 'saved'>) =>
  JSON.stringify({
    name: d.name,
    goals: d.goals,
    restSeconds: d.restSeconds,
    indirectWeight: d.indirectWeight,
    gymId: d.gymId,
    objective: d.objective,
    days: editableDays(d.days),
  })

export const isDirty = (d: PlanDraft) => d.saved !== serialize(d)

export function toPayload(d: PlanDraft): PlanPayloadIn & { name: string } {
  return {
    name: d.name,
    goals: d.goals,
    rest_seconds: d.restSeconds,
    indirect_weight: d.indirectWeight,
    gym_id: d.gymId,
    objective: d.objective,
    days: editableDays(d.days),
  }
}

const clampInt = (n: number, lo: number, hi: number, fallback: number) =>
  Number.isFinite(n) ? Math.max(lo, Math.min(hi, Math.round(n))) : fallback

/** Se aplica al salir del input, no al teclear: si no, no puedes borrar el
 *  contenido para reescribirlo. Si el rango de reps queda cruzado cede el
 *  máximo, mismo criterio que el normalizador del backend. */
export function clampItem(item: PlanItem): PlanItem {
  const repMin = clampInt(item.rep_min, 1, 100, DEFAULT_REP_MIN)
  const repMax = clampInt(item.rep_max, 1, 100, DEFAULT_REP_MAX)
  return {
    ...item,
    sets: clampInt(item.sets, MIN_SETS, MAX_SETS, DEFAULT_SETS),
    rep_min: repMin,
    rep_max: Math.max(repMin, repMax),
  }
}

const mapDay = (days: PlanDay[], weekday: number, fn: (d: PlanDay) => PlanDay) =>
  days.map((d) => (d.weekday === weekday ? fn(d) : d))

const mapItem = (day: PlanDay, index: number, fn: (i: PlanItem) => PlanItem) => ({
  ...day,
  items: day.items.map((it, i) => (i === index ? fn(it) : it)),
})

export function planReducer(state: PlanDraft, action: PlanAction): PlanDraft {
  switch (action.type) {
    case 'LOAD': {
      const next = {
        planId: action.plan.id,
        name: action.plan.name,
        days: action.plan.days,
        goals: action.plan.goals,
        restSeconds: action.plan.rest_seconds,
        indirectWeight: action.plan.indirect_weight,
        gymId: action.plan.gym?.id ?? null,
        objective: action.plan.objective,
      }
      // `saved` se fija aquí, así que `isDirty` es false justo después de cargar
      // y justo después de guardar (guardar refetchea y vuelve a pasar por aquí).
      return { ...next, saved: serialize(next) }
    }

    case 'RENAME':
      return { ...state, name: action.name }

    case 'PATCH_DAY':
      return {
        ...state,
        days: mapDay(state.days, action.weekday, (d) => ({ ...d, ...action.patch })),
      }

    case 'ADD_EXERCISE':
      return {
        ...state,
        days: mapDay(state.days, action.weekday, (d) => {
          // Sin repetidos dentro del día: permitirlo exigiría un id de hueco
          // propagado por toda la cadena de registro de sesiones.
          if (d.items.some((i) => i.exercise_id === action.exerciseId)) return d
          if (d.items.length >= MAX_EXERCISES_PER_DAY) return d
          const insertAt = safeInsertIndex(d, action.exercise)
          const item: PlanItem = {
            exercise_id: action.exerciseId,
            sets: DEFAULT_SETS,
            rep_min: DEFAULT_REP_MIN,
            rep_max: DEFAULT_REP_MAX,
            rest_seconds: null,
            notes: null,
            exercise: action.exercise,
          }
          const items = [...d.items.slice(0, insertAt), item, ...d.items.slice(insertAt)]
          return { ...d, items, focus: d.focus === 'rest' ? 'full' : d.focus }
        }),
      }

    case 'REMOVE_EXERCISE':
      return {
        ...state,
        days: mapDay(state.days, action.weekday, (d) => ({
          ...d,
          items: d.items.filter((_, i) => i !== action.index),
        })),
      }

    case 'MOVE_EXERCISE':
      return {
        ...state,
        days: mapDay(state.days, action.weekday, (d) => {
          const items = [...d.items]
          const to = action.index + action.dir
          if (to < 0 || to >= items.length) return d
          ;[items[action.index], items[to]] = [items[to], items[action.index]]
          return { ...d, items }
        }),
      }

    case 'MOVE_EXERCISE_TO_DAY': {
      if (action.fromWeekday === action.toWeekday) return state
      const source = state.days.find((d) => d.weekday === action.fromWeekday)
      const target = state.days.find((d) => d.weekday === action.toWeekday)
      const item = source?.items[action.fromIndex]
      if (!source || !target || !item) return state
      if (target.items.some((i) => i.exercise_id === item.exercise_id)) return state
      if (target.items.length >= MAX_EXERCISES_PER_DAY) return state

      const insertAt = safeInsertIndex(target, item.exercise)
      return {
        ...state,
        days: state.days.map((day) => {
          if (day.weekday === source.weekday) {
            const items = day.items.filter((_, i) => i !== action.fromIndex)
            return { ...day, items, focus: items.length ? day.focus : 'rest' }
          }
          if (day.weekday === target.weekday) {
            const items = [...day.items.slice(0, insertAt), item, ...day.items.slice(insertAt)]
            return { ...day, items, focus: day.focus === 'rest' ? 'full' : day.focus }
          }
          return day
        }),
      }
    }

    case 'REORDER_DAY_SAFE':
      return {
        ...state,
        days: mapDay(state.days, action.weekday, (d) => {
          const exMap = new Map(
            d.items.flatMap((item) => (item.exercise ? [[item.exercise_id, item.exercise]] : [])),
          )
          return { ...d, items: safeReorderDay(d, exMap) }
        }),
      }

    case 'PATCH_ITEM':
      return {
        ...state,
        days: mapDay(state.days, action.weekday, (d) =>
          mapItem(d, action.index, (it) => ({ ...it, ...action.patch })),
        ),
      }

    case 'NORMALIZE_ITEM':
      return {
        ...state,
        days: mapDay(state.days, action.weekday, (d) => mapItem(d, action.index, clampItem)),
      }

    case 'CLEAR_DAY':
      return {
        ...state,
        days: mapDay(state.days, action.weekday, (d) => ({ ...d, items: [], focus: 'rest' })),
      }

    case 'SET_BASE_GOAL':
      return { ...state, goals: { ...state.goals, base: { min: action.min, max: action.max } } }

    case 'SET_MUSCLE_GOAL': {
      const exists = state.goals.overrides.some((o) => o.muscle === action.muscle)
      const overrides = exists
        ? state.goals.overrides.map((o) =>
            o.muscle === action.muscle ? { ...o, min: action.min, max: action.max } : o,
          )
        : [...state.goals.overrides, { muscle: action.muscle, min: action.min, max: action.max }]
      return { ...state, goals: { ...state.goals, overrides } }
    }

    case 'REMOVE_MUSCLE_GOAL':
      return {
        ...state,
        goals: {
          ...state.goals,
          overrides: state.goals.overrides.filter((o) => o.muscle !== action.muscle),
        },
      }

    case 'SET_REST_SECONDS':
      return { ...state, restSeconds: action.seconds }

    case 'SET_GYM':
      return { ...state, gymId: action.gymId }

    case 'SET_OBJECTIVE':
      return { ...state, objective: action.objective }

    case 'APPLY_OBJECTIVE_GOALS': {
      if (action.mode === 'reemplazar') return { ...state, goals: action.goals }
      // «Rellenar»: conserva lo que el usuario parezca haber tocado — sus
      // overrides propios y una base distinta de la de fábrica— y solo añade lo
      // que falta. Es una heurística, pero es la que quita el miedo a pulsar.
      const mine = new Set(state.goals.overrides.map((o) => o.muscle))
      const touchedBase =
        state.goals.base.min !== DEFAULT_GOALS.base.min ||
        state.goals.base.max !== DEFAULT_GOALS.base.max
      return {
        ...state,
        goals: {
          base: touchedBase ? state.goals.base : action.goals.base,
          overrides: [
            ...state.goals.overrides,
            ...action.goals.overrides.filter((o) => !mine.has(o.muscle)),
          ],
        },
      }
    }

    case 'SET_INDIRECT_WEIGHT':
      return { ...state, indirectWeight: Math.max(0, Math.min(1, action.weight)) }

    default:
      return state
  }
}

export const planTotals = (days: PlanDay[]) => ({
  trainingDays: days.filter((d) => d.items.length).length,
  exercises: days.reduce((n, d) => n + d.items.length, 0),
  totalSets: days.reduce((n, d) => n + d.items.reduce((s, i) => s + i.sets, 0), 0),
})
