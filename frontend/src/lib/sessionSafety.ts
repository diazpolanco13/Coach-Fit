import type { Exercise, PlanDay, PlanItem } from '@/lib/api'
import { exerciseLoad } from '@/lib/anatomy'
import { muscleES } from '@/lib/muscle'
import { DEFAULT_SETS } from '@/lib/training'

export type SafetySeverity = 'warning' | 'danger'

export type ExerciseSafetyProfile = {
  flags: Set<string>
  demandsFresh: Set<string>
  orderBucket: number
}

export type DayOrderConflict = {
  atIndex: number
  fromIndex: number
  muscle: string
  severity: SafetySeverity
  message: string
  suggestion: string
}

export type HandoffWarning = {
  muscle: string
  severity: SafetySeverity
  message: string
  suggestion: string
}

const FATIGUE_THRESHOLD = 3
const DANGER_THRESHOLD = 6
const HIGH_EFFORT_RPE = 8

const FLAG_VERTICAL_PULL = 'verticalPull'
const FLAG_GRIP_HEAVY = 'gripHeavy'
const FLAG_UNSTABLE_FREE_PUSH = 'unstableFreePush'
const FLAG_POWER = 'power'
const FLAG_ISOLATION = 'isolation'
const FLAG_CORE = 'core'
const STABILITY_PRIORITY = ['Espalda alta', 'Dorsales', 'Core', 'Glúteos', 'Hombros', 'Antebrazos']
const stabilityRank = (muscle: string) => {
  const rank = STABILITY_PRIORITY.indexOf(muscle)
  return rank === -1 ? STABILITY_PRIORITY.length : rank
}

const label = (s: string) => muscleES(s)
const norm = (s: string) => s.toLocaleLowerCase('es')

function exerciseName(ex: Exercise): string {
  return norm(`${ex.name_es || ex.name} ${ex.name}`)
}

function hasAny(text: string, words: string[]): boolean {
  return words.some((word) => text.includes(word))
}

export function classifyExercise(ex: Exercise | null | undefined): ExerciseSafetyProfile {
  const flags = new Set<string>()
  const demandsFresh = new Set<string>()
  if (!ex) return { flags, demandsFresh, orderBucket: 3 }

  const name = exerciseName(ex)
  const target = label(ex.target)
  const isDumbbell = ex.equipment === 'dumbbell'
  const isPressOrFly =
    hasAny(name, ['press', 'flexiones', 'fondos', 'aperturas']) ||
    ['Pecho', 'Hombros'].includes(target)
  const isPull =
    ex.role === 'pull' ||
    hasAny(name, ['dominada', 'chin', 'pull-up', 'pullup', 'jalon', 'jalón', 'remo'])
  const isVerticalPull =
    target === 'Dorsales' &&
    hasAny(name, ['dominada', 'chin', 'pull-up', 'pullup', 'jalon', 'jalón'])
  const isCore = ex.role === 'core' || ['Abdomen', 'Core', 'Oblicuos'].includes(target)
  const isPower = hasAny(name, ['salto', 'jump', 'plyo', 'burpee', 'sprint'])
  const isIsolation = hasAny(name, ['curl', 'extension', 'extensión', 'elevaciones', 'aperturas'])

  if (isPull) flags.add(FLAG_GRIP_HEAVY)
  if (isVerticalPull) flags.add(FLAG_VERTICAL_PULL)
  if (isPower) flags.add(FLAG_POWER)
  if (isCore) flags.add(FLAG_CORE)
  if (isIsolation) flags.add(FLAG_ISOLATION)

  if (isDumbbell && isPressOrFly) {
    flags.add(FLAG_UNSTABLE_FREE_PUSH)
    demandsFresh.add('Espalda alta')
    demandsFresh.add('Dorsales')
    demandsFresh.add('Antebrazos')
    if (target === 'Hombros') demandsFresh.add('Hombros')
  }

  if (hasAny(name, ['zancada', 'bulgara', 'búlgara', 'step-up', 'a una pierna'])) {
    demandsFresh.add('Core')
    demandsFresh.add('Glúteos')
  }

  const orderBucket = flags.has(FLAG_UNSTABLE_FREE_PUSH)
    ? 0
    : isPower || (ex.role === 'legs' && !isIsolation)
      ? 1
      : flags.has(FLAG_VERTICAL_PULL) || flags.has(FLAG_GRIP_HEAVY)
        ? 2
        : flags.has(FLAG_ISOLATION)
          ? 3
          : flags.has(FLAG_CORE)
            ? 4
            : 1

  return { flags, demandsFresh, orderBucket }
}

function itemExercise(item: PlanItem, exMap: Map<string, Exercise>): Exercise | null {
  return item.exercise ?? exMap.get(item.exercise_id) ?? null
}

function itemName(item: PlanItem, exMap: Map<string, Exercise>): string {
  return itemExercise(item, exMap)?.name_es ?? item.exercise_id
}

function fatigueContrib(item: PlanItem, ex: Exercise): Map<string, number> {
  const out = new Map<string, number>()
  const sets = (item.sets || DEFAULT_SETS) * exerciseLoad(ex)
  const bump = (muscle: string, amount: number) => {
    out.set(muscle, (out.get(muscle) ?? 0) + amount)
  }

  if (ex.stimulus?.length) {
    for (const s of ex.stimulus) {
      const amount = sets * s.weight * (s.role === 'primary' ? 1 : 0.85)
      bump(label(s.muscle), amount)
    }
  } else if (ex.target) {
    bump(label(ex.target), sets)
    for (const sec of ex.secondary_muscles ?? []) bump(label(sec), sets * 0.5)
  }

  const profile = classifyExercise(ex)
  if (profile.flags.has(FLAG_VERTICAL_PULL)) {
    bump('Espalda alta', sets * 0.75)
    bump('Antebrazos', sets * 0.6)
  }
  if (profile.flags.has(FLAG_GRIP_HEAVY)) bump('Antebrazos', sets * 0.35)
  if (profile.flags.has(FLAG_POWER)) bump('Core', sets * 0.4)

  return out
}

function strongestDemand(
  profile: ExerciseSafetyProfile,
  fatigue: Map<string, { amount: number; fromIndex: number }>,
): { muscle: string; amount: number; fromIndex: number } | null {
  const muscles = [...profile.demandsFresh].sort(
    (a, b) => stabilityRank(a) - stabilityRank(b),
  )
  let worstDanger: { muscle: string; amount: number; fromIndex: number } | null = null
  let firstWarning: { muscle: string; amount: number; fromIndex: number } | null = null
  for (const muscle of muscles) {
    const found = fatigue.get(muscle)
    if (!found || found.amount < FATIGUE_THRESHOLD) continue
    const match = { muscle, ...found }
    if (found.amount >= DANGER_THRESHOLD && !worstDanger) worstDanger = match
    if (!firstWarning) firstWarning = match
  }
  return worstDanger ?? firstWarning
}

function conflictMessage(muscle: string, source: string, current: string): string {
  return `Fatiga en ${muscle} por ${source}; ${current} necesita ese estabilizador fresco.`
}

export function dayOrderConflicts(
  day: PlanDay,
  exMap: Map<string, Exercise>,
): DayOrderConflict[] {
  const fatigue = new Map<string, { amount: number; fromIndex: number }>()
  const conflicts: DayOrderConflict[] = []

  day.items.forEach((item, index) => {
    const ex = itemExercise(item, exMap)
    if (!ex) return

    const demand = strongestDemand(classifyExercise(ex), fatigue)
    if (demand) {
      const source = itemName(day.items[demand.fromIndex], exMap)
      const current = itemName(item, exMap)
      conflicts.push({
        atIndex: index,
        fromIndex: demand.fromIndex,
        muscle: demand.muscle,
        severity: demand.amount >= DANGER_THRESHOLD ? 'danger' : 'warning',
        message: conflictMessage(demand.muscle, source, current),
        suggestion: `Pon ${current} antes de ${source} o sepáralos en otro día.`,
      })
    }

    for (const [muscle, amount] of fatigueContrib(item, ex)) {
      const current = fatigue.get(muscle)
      const nextAmount = (current?.amount ?? 0) + amount
      fatigue.set(muscle, {
        amount: nextAmount,
        fromIndex: current && current.amount >= amount ? current.fromIndex : index,
      })
    }
  })

  return conflicts
}

function mapFromItems(items: PlanItem[], extra?: Exercise | null): Map<string, Exercise> {
  const map = new Map<string, Exercise>()
  for (const item of items) {
    if (item.exercise) map.set(item.exercise_id, item.exercise)
  }
  if (extra) map.set(extra.id, extra)
  return map
}

function conflictCost(conflicts: DayOrderConflict[]): number {
  return conflicts.reduce((sum, c) => sum + (c.severity === 'danger' ? 10 : 3), 0)
}

export function safeInsertIndex(day: PlanDay, newEx: Exercise | null): number {
  if (!newEx) return day.items.length

  const item: PlanItem = {
    exercise_id: newEx.id,
    sets: DEFAULT_SETS,
    rep_min: 8,
    rep_max: 12,
    rest_seconds: null,
    notes: null,
    exercise: newEx,
  }
  const exMap = mapFromItems(day.items, newEx)
  let best = day.items.length
  let bestCost = Number.POSITIVE_INFINITY

  for (let index = 0; index <= day.items.length; index += 1) {
    const items = [...day.items.slice(0, index), item, ...day.items.slice(index)]
    const cost = conflictCost(dayOrderConflicts({ ...day, items }, exMap))
    if (cost < bestCost) {
      best = index
      bestCost = cost
    }
  }

  return best
}

export function safeReorderDay(day: PlanDay, exMap: Map<string, Exercise>): PlanItem[] {
  return day.items
    .map((item, index) => ({
      item,
      index,
      bucket: classifyExercise(itemExercise(item, exMap)).orderBucket,
    }))
    .sort((a, b) => a.bucket - b.bucket || a.index - b.index)
    .map((entry) => entry.item)
}

export function sessionHandoffWarning(
  prevEx: Exercise | null | undefined,
  prevSetRpe: number,
  nextEx: Exercise | null | undefined,
): HandoffWarning | null {
  if (!prevEx || !nextEx || prevSetRpe < HIGH_EFFORT_RPE) return null

  const prevProfile = classifyExercise(prevEx)
  const nextProfile = classifyExercise(nextEx)
  if (!nextProfile.demandsFresh.size) return null

  const overlap = new Set<string>()
  if (prevProfile.flags.has(FLAG_VERTICAL_PULL)) {
    overlap.add('Espalda alta')
    overlap.add('Dorsales')
    overlap.add('Antebrazos')
  }
  if (prevProfile.flags.has(FLAG_GRIP_HEAVY)) overlap.add('Antebrazos')

  const muscle = [...nextProfile.demandsFresh].find((m) => overlap.has(m))
  if (!muscle) return null

  return {
    muscle,
    severity: prevSetRpe >= 9 ? 'danger' : 'warning',
    message: `${muscle} viene fatigado por ${prevEx.name_es}; ${nextEx.name_es} puede perder estabilidad.`,
    suggestion: 'Baja peso, añade descanso o cambia el orden antes de seguir.',
  }
}
