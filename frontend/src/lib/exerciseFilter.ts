import { useEffect, useMemo, useState } from 'react'
import type { Exercise, Gym, UserEquipment } from '@/lib/api'
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
  /** Si la lista se limita al material disponible. */
  onlyMine: boolean
  /** De QUÉ espacio es ese material. `null` = el que traiga el consumidor por
   *  defecto (el del plan, el activo). Separado de `onlyMine` porque son dos
   *  preguntas: si se filtra, y contra qué inventario. */
  spaceId: number | null
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
  spaceId: null,
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
  /** Espacios entre los que se puede elegir el inventario, y cuál manda al
   *  entrar (el del plan que se edita, o el activo). Sin esto el filtro es el de
   *  siempre: el inventario de `equipment` o todo el catálogo. */
  spaces?: { list: Gym[]; defaultId: number | null },
) {
  const [filter, setFilter] = useState<ExerciseFilter>(() => ({
    ...EMPTY_FILTER,
    spaceId: spaces?.defaultId ?? null,
  }))
  const [visible, setVisible] = useState(page)

  // Si el plan cambia de espacio, el filtro se muda con él: quedarse mirando el
  // material del espacio anterior seria ofrecer lo que no vas a tener.
  const defaultId = spaces?.defaultId ?? null
  useEffect(() => {
    setFilter((prev) => (prev.spaceId === defaultId ? prev : { ...prev, spaceId: defaultId }))
  }, [defaultId])

  /** Inventario contra el que se filtra: el del espacio elegido, o el que trae el
   *  consumidor si no hay lista de espacios. */
  const selected = useMemo(
    () => spaces?.list.find((g) => g.id === filter.spaceId)?.equipment ?? equipment,
    [spaces, filter.spaceId, equipment],
  )
  const mine = useMemo(() => availableEquipment(selected, unlocks), [selected, unlocks])
  const muscles = useMemo(() => muscleOptions(exercises), [exercises])
  const equipments = useMemo(() => equipmentOptions(exercises), [exercises])
  const results = useMemo(
    () => filterExercises(exercises, filter, mine, curation),
    [exercises, filter, mine, curation],
  )
  /** Cuántos ejercicios quedan con el inventario de CADA espacio y sin filtro
   *  ninguno, ya con el resto de filtros aplicados. Van en las opciones del
   *  selector: elegir espacio con el número al lado es lo que convierte el
   *  control en una decisión informada y no en una etiqueta. */
  const counts = useMemo(() => {
    const base = filterExercises(exercises, { ...filter, onlyMine: false }, mine, curation)
    const bySpace = new Map<number, number>()
    for (const g of spaces?.list ?? []) {
      const set = availableEquipment(g.equipment, unlocks)
      bySpace.set(
        g.id,
        base.reduce((n, e) => n + (set.has(e.equipment) ? 1 : 0), 0),
      )
    }
    return {
      all: base.length,
      mine: base.reduce((n, e) => n + (mine.has(e.equipment) ? 1 : 0), 0),
      bySpace,
    }
  }, [exercises, filter, mine, curation, spaces, unlocks])

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
    counts,
  }
}
