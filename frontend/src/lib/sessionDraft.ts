import type { SessionSet } from '@/lib/api'
import { DEFAULT_REPS } from '@/lib/training'

/** Identifica una serie de forma estable, sin depender de su posición. */
export const setKey = (s: { exercise_id: string; set_index: number }) =>
  `${s.exercise_id}:${s.set_index}`

/** El borrador de la sesión: las series y cuáles de ellas son un registro real.
 *
 *  Van juntas porque la clave de `logged` incluye el `set_index`: cualquier
 *  operación que renumere tiene que rehacer las dos a la vez o quedan marcas
 *  apuntando a índices que ya no existen. */
export type SessionDraft = { sets: SessionSet[]; logged: Set<string> }

/** Una serie más para un ejercicio, copiando la anterior: repetir peso y reps es
 *  el caso normal dentro de un mismo ejercicio.
 *
 *  Nace ya registrada, a diferencia del prefill. La regla es la misma de
 *  siempre: el prefill aparece sin que lo pidas y por eso no afirma nada, pero
 *  pulsar «Añadir serie» SÍ es afirmar que la hiciste. */
export function addSet(draft: SessionDraft, exerciseId: string): SessionDraft {
  const mine = draft.sets.filter((s) => s.exercise_id === exerciseId)
  const last = mine[mine.length - 1]
  const next: SessionSet = {
    exercise_id: exerciseId,
    set_index: mine.length + 1,
    reps: last?.reps ?? DEFAULT_REPS,
    weight_kg: last?.weight_kg,
    rpe: last?.rpe ?? 7,
    done: true,
  }
  // Se inserta justo tras la última serie de ese ejercicio y no al final del
  // array: `exerciseGroups` respeta el orden de aparición, y añadirla al final
  // reordenaría las tarjetas de la sesión.
  const at = draft.sets.map((s) => s.exercise_id).lastIndexOf(exerciseId)
  return {
    sets: [...draft.sets.slice(0, at + 1), next, ...draft.sets.slice(at + 1)],
    logged: new Set(draft.logged).add(setKey(next)),
  }
}

/** Quita una serie y renumera las que quedan de ese ejercicio, arrastrando sus
 *  marcas de registrada. */
export function removeSet(
  draft: SessionDraft,
  exerciseId: string,
  setIndex: number,
): SessionDraft {
  const kept = draft.sets.filter(
    (s) => !(s.exercise_id === exerciseId && s.set_index === setIndex),
  )
  const sets: SessionSet[] = []
  const logged = new Set<string>()
  let n = 0
  for (const set of kept) {
    const moved = set.exercise_id === exerciseId ? { ...set, set_index: ++n } : set
    sets.push(moved)
    if (draft.logged.has(setKey(set))) logged.add(setKey(moved))
  }
  return { sets, logged }
}

/** Quita el ejercicio entero de la sesión. */
export function removeExercise(draft: SessionDraft, exerciseId: string): SessionDraft {
  const logged = new Set(draft.logged)
  for (const k of draft.logged) if (k.startsWith(`${exerciseId}:`)) logged.delete(k)
  return { sets: draft.sets.filter((s) => s.exercise_id !== exerciseId), logged }
}
