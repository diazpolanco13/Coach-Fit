import type { Plan, PlanDay, PlanGoals, PlanItem, PlanPayloadIn, PlanSection } from '@/lib/api'
import { defaultCardioPlanFields, isEnduranceCardio } from '@/lib/cardio'
import { safeReorderDay } from '@/lib/sessionSafety'
import { DEFAULT_SETS } from '@/lib/training'

export const DEFAULT_REP_MIN = 8
export const DEFAULT_REP_MAX = 12
export const MIN_SETS = 1
export const MAX_SETS = 10
export const MAX_EXERCISES_PER_DAY = 20

/** Espeja backend/app/plans.py. Solo se usa mientras no llega el plan real. */
export const DEFAULT_GOALS: PlanGoals = { base: { min: 10, max: 20 }, overrides: [] }

export const PLAN_SECTIONS: { id: PlanSection; label: string }[] = [
  { id: 'warmup', label: 'Calentamiento' },
  { id: 'cardio', label: 'Cardio' },
  { id: 'strength', label: 'Fuerza' },
]

/** Estilos compartidos plan / Hoy: borde+fondo del bloque y badge del título. */
export const PLAN_SECTION_STYLE: Record<PlanSection, string> = {
  warmup: 'border-sky-500/35 bg-sky-500/5',
  cardio: 'border-amber-500/40 bg-amber-500/5',
  strength: 'border-border bg-muted/20',
}

export const PLAN_SECTION_BADGE: Record<PlanSection, string> = {
  warmup: 'border-sky-500/40 bg-sky-500/10 text-sky-800 dark:text-sky-300',
  cardio: 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300',
  strength: 'border-border bg-background text-muted-foreground',
}

const SECTION_RANK: Record<PlanSection, number> = { warmup: 0, cardio: 1, strength: 2 }

/** Agrupa ítems por sección en orden fijo. Solo bloques con algo (vista lectura). */
export function groupItemsBySection<T extends Pick<PlanItem, 'section' | 'cardio_kind'>>(
  items: T[],
): { id: PlanSection; label: string; entries: { item: T; index: number }[] }[] {
  return PLAN_SECTIONS.map(({ id, label }) => ({
    id,
    label,
    entries: items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => resolveSection(item) === id),
  })).filter((s) => s.entries.length > 0)
}

/** Sección efectiva: la guardada, o cardio si hay cardio_kind, o fuerza (legacy). */
export function resolveSection(
  item: Pick<PlanItem, 'section' | 'cardio_kind'>,
): PlanSection {
  if (item.section === 'warmup' || item.section === 'cardio' || item.section === 'strength') {
    return item.section
  }
  return item.cardio_kind ? 'cardio' : 'strength'
}

/** Lista plana ordenada: calentamiento → cardio → fuerza (estable dentro). */
export function sortItemsBySection(items: PlanItem[]): PlanItem[] {
  return items
    .map((item, index) => ({ item, index, rank: SECTION_RANK[resolveSection(item)] }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => ({ ...entry.item, section: resolveSection(entry.item) }))
}

/** Agrupa por sección en orden fijo e inserta `item` al final de su bloque. */
function insertIntoSection(items: PlanItem[], item: PlanItem, section: PlanSection): PlanItem[] {
  const buckets: Record<PlanSection, PlanItem[]> = { warmup: [], cardio: [], strength: [] }
  for (const it of sortItemsBySection(items)) {
    buckets[resolveSection(it)].push(it)
  }
  buckets[section].push({ ...item, section })
  return [...buckets.warmup, ...buckets.cardio, ...buckets.strength]
}

/** Reordena seguro dentro de cada sección, sin mezclar bloques. */
function safeReorderBySection(
  day: PlanDay,
  exMap: Map<string, NonNullable<PlanItem['exercise']>>,
): PlanItem[] {
  const buckets: Record<PlanSection, PlanItem[]> = { warmup: [], cardio: [], strength: [] }
  for (const it of sortItemsBySection(day.items)) {
    buckets[resolveSection(it)].push(it)
  }
  return PLAN_SECTIONS.flatMap(({ id }) =>
    safeReorderDay({ ...day, items: buckets[id] }, exMap).map((it) => ({ ...it, section: id })),
  )
}

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
  | {
      type: 'ADD_EXERCISE'
      weekday: number
      exerciseId: string
      exercise: PlanItem['exercise']
      section?: PlanSection
    }
  | { type: 'REMOVE_EXERCISE'; weekday: number; index: number }
  /** Cambia el ejercicio de un hueco conservando series, reps y descanso: es lo
   *  que hace falta al sustituir material que el espacio no tiene, donde la
   *  prescripcion sigue siendo buena y solo cambia el aparato. */
  | { type: 'REPLACE_EXERCISE'; weekday: number; index: number; exerciseId: string; exercise: PlanItem['exercise'] }
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

/** Un borrador sin plan cargado no puede estar sucio.
 *
 *  `emptyDraft.saved` es la cadena vacía y `serialize()` nunca devuelve eso, así
 *  que comparando a secas el borrador nacía sucio. Fuera de la pantalla de Plan
 *  `selectedPlanId` es null, el efecto de carga no llega a correr y el borrador
 *  se quedaba en ese estado para siempre: el aviso de «los cambios no se
 *  guardarán» saltaba al recargar cualquier pantalla, sin nada que perder. */
export const isDirty = (d: PlanDraft) => d.planId != null && d.saved !== serialize(d)

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
  const next: PlanItem = {
    ...item,
    sets: clampInt(item.sets, MIN_SETS, MAX_SETS, DEFAULT_SETS),
    rep_min: repMin,
    rep_max: Math.max(repMin, repMax),
  }
  if (next.target_km != null && Number.isFinite(next.target_km)) {
    next.target_km = Math.max(0, Math.round(next.target_km * 100) / 100)
  }
  if (next.target_min != null && Number.isFinite(next.target_min)) {
    next.target_min = Math.max(0, Math.round(next.target_min * 10) / 10)
  }
  return next
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
      const days = action.plan.days.map((d) => ({
        ...d,
        items: sortItemsBySection(d.items),
      }))
      const next = {
        planId: action.plan.id,
        name: action.plan.name,
        days,
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
          const cardio =
            action.exercise && isEnduranceCardio(action.exercise)
              ? defaultCardioPlanFields(action.exercise)
              : null
          const section: PlanSection =
            action.section ?? (cardio ? 'cardio' : 'strength')
          const item: PlanItem = {
            exercise_id: action.exerciseId,
            sets: cardio?.sets ?? DEFAULT_SETS,
            rep_min: cardio?.rep_min ?? DEFAULT_REP_MIN,
            rep_max: cardio?.rep_max ?? DEFAULT_REP_MAX,
            rest_seconds: cardio?.rest_seconds ?? null,
            notes: null,
            exercise: action.exercise,
            section,
            ...(cardio
              ? {
                  cardio_kind: cardio.cardio_kind,
                  cardio_surface: cardio.cardio_surface,
                  session_type: cardio.session_type,
                  target_km: cardio.target_km,
                  target_min: cardio.target_min,
                }
              : {}),
          }
          return {
            ...d,
            items: insertIntoSection(d.items, item, section),
            focus: d.focus === 'rest' ? 'full' : d.focus,
          }
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

    case 'REPLACE_EXERCISE':
      return {
        ...state,
        days: mapDay(state.days, action.weekday, (d) => {
          // Si el sustituto ya esta en el dia, quitar el viejo y no meter un
          // repetido: la alternativa seria dejar el hueco intacto y que el boton
          // pareciera roto.
          if (d.items.some((i, idx) => idx !== action.index && i.exercise_id === action.exerciseId)) {
            return { ...d, items: d.items.filter((_, i) => i !== action.index) }
          }
          return {
            ...d,
            items: d.items.map((it, i) =>
              i === action.index
                ? { ...it, exercise_id: action.exerciseId, exercise: action.exercise }
                : it,
            ),
          }
        }),
      }

    case 'MOVE_EXERCISE':
      return {
        ...state,
        days: mapDay(state.days, action.weekday, (d) => {
          const items = [...d.items]
          const to = action.index + action.dir
          if (to < 0 || to >= items.length) return d
          // Solo dentro del mismo bloque: no cruzar Calentamiento/Cardio/Fuerza.
          if (resolveSection(items[action.index]) !== resolveSection(items[to])) return d
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

      const section = resolveSection(item)
      return {
        ...state,
        days: state.days.map((day) => {
          if (day.weekday === source.weekday) {
            const items = day.items.filter((_, i) => i !== action.fromIndex)
            return { ...day, items, focus: items.length ? day.focus : 'rest' }
          }
          if (day.weekday === target.weekday) {
            return {
              ...day,
              items: insertIntoSection(day.items, item, section),
              focus: day.focus === 'rest' ? 'full' : day.focus,
            }
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
          return { ...d, items: safeReorderBySection(d, exMap) }
        }),
      }

    case 'PATCH_ITEM':
      return {
        ...state,
        days: mapDay(state.days, action.weekday, (d) => {
          const current = d.items[action.index]
          if (!current) return d
          const next = { ...current, ...action.patch }
          // Si cambia de bloque, recolocarlo al final de la sección nueva.
          if (
            action.patch.section &&
            resolveSection(current) !== resolveSection(next)
          ) {
            const rest = d.items.filter((_, i) => i !== action.index)
            return { ...d, items: insertIntoSection(rest, next, resolveSection(next)) }
          }
          return mapItem(d, action.index, () => next)
        }),
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
