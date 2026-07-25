import { useMemo, useState } from 'react'
import type { Exercise, UserEquipment } from '@/lib/api'
import { availableEquipment, equipmentES } from '@/lib/equipment'
import { muscleES } from '@/lib/muscle'

/** Filtrado del catálogo, compartido por la biblioteca a pantalla completa y
 *  por el panel lateral del editor de planes. Antes eran dos copias del mismo
 *  código que solo diferían en el rol `cardio` y en el filtro por equipo. */
export type ExerciseFilter = {
  query: string
  /** Rol del catálogo, o 'todos'. */
  role: string
  /** Clave del catálogo (`quads`), NO la etiqueta en español. */
  muscle: string
  /** Clave del catálogo (`dumbbell`). */
  equip: string
  onlyMine: boolean
  /** `todos` = disponibles + favoritos, los ocultos quedan fuera. `ocultos`
   *  solo se usa en la pantalla de curación del espacio. */
  curated: 'todos' | 'favoritos' | 'ocultos'
}

/** Curación de un espacio, ya en Sets para consultar en O(1).
 *
 *  Va como argumento aparte de `ExerciseFilter` a propósito: el filtro es
 *  estado de UI serializable, la curación es dato del espacio. */
export type Curation = { favorites: Set<string>; hidden: Set<string> }

export const EMPTY_CURATION: Curation = { favorites: new Set(), hidden: new Set() }

export const curationOf = (raw?: { favorites: string[]; hidden: string[] } | null): Curation =>
  raw
    ? { favorites: new Set(raw.favorites), hidden: new Set(raw.hidden) }
    : EMPTY_CURATION

export const ALL = 'todos'

export const ROLES = [
  { id: ALL, label: 'Todos' },
  { id: 'push', label: 'Empuje' },
  { id: 'pull', label: 'Tirón' },
  { id: 'legs', label: 'Piernas' },
  { id: 'core', label: 'Core' },
  { id: 'cardio', label: 'Cardio' },
]

export const EMPTY_FILTER: ExerciseFilter = {
  query: '',
  role: ALL,
  muscle: ALL,
  equip: ALL,
  onlyMine: true,
  curated: 'todos',
}

export const DEFAULT_PAGE = 60

export function filterExercises(
  exercises: Exercise[],
  f: ExerciseFilter,
  mine: Set<string>,
  cur: Curation = EMPTY_CURATION,
): Exercise[] {
  const q = f.query.trim().toLowerCase()
  const out = exercises.filter((e) => {
    if (f.curated === 'ocultos') {
      if (!cur.hidden.has(e.id)) return false
    } else {
      // Un ejercicio oculto desaparece del espacio: es justo lo que se pidió al
      // marcarlo. Solo la pantalla de curación lo vuelve a mostrar.
      if (cur.hidden.has(e.id)) return false
      if (f.curated === 'favoritos' && !cur.favorites.has(e.id)) return false
    }
    if (f.role !== ALL && e.role !== f.role) return false
    if (f.muscle !== ALL && e.target !== f.muscle) return false
    if (f.equip !== ALL && e.equipment !== f.equip) return false
    if (f.onlyMine && !mine.has(e.equipment)) return false
    if (q && !e.name_es.toLowerCase().includes(q) && !e.name.toLowerCase().includes(q)) return false
    return true
  })
  // Los favoritos delante: es para lo que sirve marcarlos.
  if (f.curated !== 'ocultos' && cur.favorites.size) {
    out.sort((a, b) => Number(cur.favorites.has(b.id)) - Number(cur.favorites.has(a.id)))
  }
  return out
}

export function muscleOptions(exercises: Exercise[]): string[] {
  const set = new Set(exercises.map((e) => e.target).filter(Boolean))
  return [...set].sort((a, b) => muscleES(a).localeCompare(muscleES(b), 'es'))
}

export function equipmentOptions(exercises: Exercise[]): string[] {
  const set = new Set(exercises.map((e) => e.equipment).filter(Boolean))
  return [...set].sort((a, b) => equipmentES(a).localeCompare(equipmentES(b), 'es'))
}

export function useExerciseFilter(
  exercises: Exercise[],
  equipment: UserEquipment[],
  unlocks: Record<string, string[]>,
  page = DEFAULT_PAGE,
  curation: Curation = EMPTY_CURATION,
) {
  const [filter, setFilter] = useState<ExerciseFilter>(EMPTY_FILTER)
  const [visible, setVisible] = useState(page)

  const mine = useMemo(() => availableEquipment(equipment, unlocks), [equipment, unlocks])
  const muscles = useMemo(() => muscleOptions(exercises), [exercises])
  const equipments = useMemo(() => equipmentOptions(exercises), [exercises])
  const results = useMemo(
    () => filterExercises(exercises, filter, mine, curation),
    [exercises, filter, mine, curation],
  )

  /** Cualquier cambio de filtro vuelve a empezar por la primera página. */
  const patch = (p: Partial<ExerciseFilter>) => {
    setFilter((prev) => ({ ...prev, ...p }))
    setVisible(page)
  }

  return {
    filter,
    patch,
    results,
    shown: results.slice(0, visible),
    visible,
    showMore: () => setVisible((v) => v + page),
    muscles,
    equipments,
    mine,
  }
}
