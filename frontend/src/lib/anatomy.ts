import type { Exercise } from '@/lib/api'

export const REGION_ES: Record<string, string> = {
  upper: 'superior',
  mid: 'medio',
  lower: 'inferior',
  anterior: 'anterior',
  lateral: 'lateral',
  posterior: 'posterior',
  obliques: 'oblicuos',
  anti_extension: 'anti-extensión',
}

export function regionES(region: string | null | undefined): string {
  if (!region) return ''
  return REGION_ES[region] || region
}

/** «Pecho superior», o solo «Pecho» si no hay región. */
export function muscleRegionLabel(muscleES: string, region: string | null | undefined): string {
  const r = regionES(region)
  return r ? `${muscleES} ${r}` : muscleES
}

export const DIFFICULTY_ES: Record<1 | 2 | 3, string> = {
  1: 'Principiante',
  2: 'Intermedio',
  3: 'Avanzado',
}

export type Experience = 'beginner' | 'intermediate' | 'advanced'

export const EXPERIENCE_TO_MAX_DIFFICULTY: Record<Experience, 1 | 2 | 3> = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
}

export function exerciseDifficulty(ex: Exercise): 1 | 2 | 3 {
  const d = ex.difficulty
  if (d === 1 || d === 2 || d === 3) return d
  return 2
}

export function exerciseLoad(ex: Exercise): number {
  return typeof ex.load === 'number' && ex.load > 0 ? ex.load : 1
}

/** Puntos de carga para UI (1–5), derivados de `load`. */
export function loadDots(load: number): number {
  if (load <= 0.7) return 2
  if (load <= 1.0) return 3
  if (load <= 1.2) return 4
  return 5
}

export type ResultEntry =
  | { kind: 'single'; ex: Exercise }
  | { kind: 'family'; familyId: string; label: string; members: Exercise[] }

/** Agrupa resultados filtrados por familia. Una sola variante visible → fila suelta. */
export function groupExerciseResults(exercises: Exercise[]): ResultEntry[] {
  const order: string[] = []
  const singles: Exercise[] = []
  const families = new Map<string, Exercise[]>()

  for (const ex of exercises) {
    const fid = ex.family_id
    if (!fid) {
      order.push(`s:${ex.id}`)
      singles.push(ex)
      continue
    }
    if (!families.has(fid)) {
      order.push(`f:${fid}`)
      families.set(fid, [])
    }
    families.get(fid)!.push(ex)
  }

  const singleById = new Map(singles.map((e) => [e.id, e]))
  const out: ResultEntry[] = []
  const seen = new Set<string>()

  for (const key of order) {
    if (seen.has(key)) continue
    seen.add(key)
    if (key.startsWith('s:')) {
      const ex = singleById.get(key.slice(2))
      if (ex) out.push({ kind: 'single', ex })
      continue
    }
    const fid = key.slice(2)
    const members = families.get(fid)
    if (!members?.length) continue
    if (members.length === 1) {
      out.push({ kind: 'single', ex: members[0] })
      continue
    }
    members.sort((a, b) => exerciseDifficulty(a) - exerciseDifficulty(b) || a.id.localeCompare(b.id))
    const label = members.find((m) => m.family_label_es)?.family_label_es || members[0].name_es
    out.push({ kind: 'family', familyId: fid, label, members })
  }
  return out
}

/** Variante recomendada: la más dura que aún cabe en el nivel del usuario. */
export function recommendedInFamily(members: Exercise[], experience: Experience): Exercise {
  const max = EXPERIENCE_TO_MAX_DIFFICULTY[experience]
  const fit = members.filter((m) => exerciseDifficulty(m) <= max)
  const pool = fit.length ? fit : members
  return pool.reduce((best, cur) =>
    exerciseDifficulty(cur) > exerciseDifficulty(best) ? cur : best,
  )
}
