import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Star } from 'lucide-react'
import { api, type Exercise, type PlanGoals, type UserEquipment } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { ExerciseFilterBar, ExerciseRoleChips } from '@/components/exercise/ExerciseFilterBar'
import { ExerciseResultRow } from '@/components/exercise/ExerciseResultRow'
import { useData } from '@/components/shell/DataContext'
import { EMPTY_CURATION, useExerciseFilter, type Curation } from '@/lib/exerciseFilter'
import { muscleES } from '@/lib/muscle'
import {
  formatSets,
  goalFor,
  volumeStatus,
  type MuscleVolume,
} from '@/lib/volume'
import { cn } from '@/lib/utils'

/** Página del panel estrecho; en Dialog usamos más entradas por tanda. */
const PAGE = 40
const PAGE_DIALOG = 48

export function ExerciseLibraryPanel({
  exercises,
  equipment,
  spaceId,
  curation = EMPTY_CURATION,
  targetDayLabel,
  alreadyIn,
  dayFull,
  overloaded,
  goals,
  volumes,
  onAdd,
  onOpenGuide,
  layout = 'sheet',
  className,
}: {
  exercises: Exercise[]
  /** Inventario del espacio al que pertenece el plan. */
  equipment: UserEquipment[]
  /** Espacio del plan: manda como filtro al abrir, y el selector deja mirar el
   *  material de los otros espacios sin salir de aquí. */
  spaceId?: number | null
  curation?: Curation
  /** Día que recibe los ejercicios. `null` = ningún día enfocado. */
  targetDayLabel: string | null
  alreadyIn: Set<string>
  dayFull: boolean
  overloaded: Set<string>
  goals: PlanGoals
  /** Volumen del plan: columna de contexto en layout dialog. */
  volumes?: MuscleVolume[]
  onAdd: (ex: Exercise) => void
  onOpenGuide: (ex: Exercise) => void
  layout?: 'sheet' | 'dialog'
  className?: string
}) {
  const dialog = layout === 'dialog'
  const { equipmentUnlocks, gyms, reloadGyms } = useData()
  /** Copia local para que la estrella responda al toque sin esperar al reload. */
  const [localCuration, setLocalCuration] = useState(curation)
  useEffect(() => setLocalCuration(curation), [curation])

  const { filter, patch, results, shown, visible, showMore, muscles, bodyParts, equipments, counts } =
    useExerciseFilter(
      exercises,
      equipment,
      equipmentUnlocks,
      dialog ? PAGE_DIALOG : PAGE,
      localCuration,
      { list: gyms, defaultId: spaceId ?? null },
    )

  const toggleFavorite = useCallback(
    (exerciseId: string) => {
      if (spaceId == null) return
      const isFav = localCuration.favorites.has(exerciseId)
      const state = isFav ? 'disponible' : 'favorito'
      setLocalCuration((prev) => {
        const favorites = new Set(prev.favorites)
        const hidden = new Set(prev.hidden)
        favorites.delete(exerciseId)
        hidden.delete(exerciseId)
        if (state === 'favorito') favorites.add(exerciseId)
        return { favorites, hidden }
      })
      api
        .markExercise(spaceId, exerciseId, state)
        .then(() => reloadGyms())
        .catch(() => setLocalCuration(curation))
    },
    [spaceId, localCuration.favorites, curation, reloadGyms],
  )

  const under = useMemo(() => {
    if (!volumes?.length) return []
    return volumes.filter((v) => v.programmed && volumeStatus(v, goals) === 'low').slice(0, 5)
  }, [volumes, goals])

  const over = useMemo(() => {
    if (!volumes?.length) return []
    return volumes.filter((v) => v.programmed && volumeStatus(v, goals) === 'high').slice(0, 4)
  }, [volumes, goals])

  const filters = (
    <div className="space-y-2.5">
      {!dialog && (
        <p className="text-sm text-muted-foreground">
          {targetDayLabel ? (
            <>
              Añadiendo a <strong className="text-foreground">{targetDayLabel}</strong>
            </>
          ) : (
            'Elige un día para añadir ejercicios.'
          )}
        </p>
      )}

      <ExerciseRoleChips
        role={filter.role}
        onChange={(role) => patch({ role })}
        className="flex-wrap"
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={filter.curated === 'favoritos' ? 'default' : 'outline'}
          aria-pressed={filter.curated === 'favoritos'}
          className="gap-1.5"
          onClick={() => patch({ curated: filter.curated === 'favoritos' ? 'todos' : 'favoritos' })}
        >
          <Star
            className={
              filter.curated === 'favoritos' ? 'size-3.5 fill-current' : 'size-3.5'
            }
          />
          Favoritos
          {localCuration.favorites.size > 0 && (
            <span className="tabular-nums opacity-80">{localCuration.favorites.size}</span>
          )}
        </Button>
      </div>
      <ExerciseFilterBar
        filter={filter}
        onPatch={patch}
        muscles={muscles}
        bodyParts={bodyParts}
        equipments={equipments}
        layout={dialog ? 'grid' : 'stack'}
        showBodyPart={false}
        showMuscle={false}
        showEquip
        spaces={gyms}
        counts={counts}
      />
    </div>
  )

  const resultsMeta = (
    <p className="text-xs text-muted-foreground">
      {results.length} {results.length === 1 ? 'resultado' : 'resultados'}
      {/* El selector de equipo ya dice contra qué inventario se filtra; aquí
          solo se avisa de los dos casos en que la lista ofrece cosas que no vas
          a poder hacer en el espacio del plan. */}
      {!filter.onlyMine && <span className="text-warning-strong"> · todo el catálogo</span>}
      {filter.onlyMine && spaceId != null && filter.spaceId !== spaceId && (
        <span className="text-warning-strong">
          {' '}
          · material de otro espacio, no del plan
        </span>
      )}
    </p>
  )

  const resultsItems = (
    <>
      {shown.map((ex) => (
        <ExerciseResultRow
          key={ex.id}
          ex={ex}
          added={alreadyIn.has(ex.id)}
          favorite={localCuration.favorites.has(ex.id)}
          disabled={!targetDayLabel || dayFull}
          overloadedMax={
            overloaded.has(muscleES(ex.target))
              ? goalFor(goals, muscleES(ex.target)).max
              : null
          }
          onAdd={onAdd}
          onToggleFavorite={spaceId != null ? () => toggleFavorite(ex.id) : undefined}
          onOpenGuide={onOpenGuide}
        />
      ))}

      {!results.length && (
        <p className="col-span-full py-8 text-center text-sm text-muted-foreground">
          Nada coincide. Prueba a quitar filtros, o a mirar todo el catálogo en el selector de
          equipo.
        </p>
      )}

      {visible < results.length && (
        <div className="col-span-full pt-2 pb-1 text-center">
          <Button variant="outline" size="sm" onClick={showMore}>
            Ver más ({results.length - visible} restantes)
          </Button>
        </div>
      )}
    </>
  )

  const context = dialog && (
    <aside className="hidden w-56 shrink-0 flex-col gap-3 overflow-y-auto border-l border-border pl-4 lg:flex">
      <div>
        <div className="kicker">Contexto del plan</div>
        <p className="mt-1 text-xs text-muted-foreground">
          {targetDayLabel
            ? `Día: ${targetDayLabel}`
            : 'Sin día enfocado'}
        </p>
      </div>

      {under.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-amber-700 dark:text-amber-400">Por debajo del mínimo</p>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {under.map((v) => (
              <li key={v.muscle} className="flex justify-between gap-2">
                <span className="truncate">{v.muscle}</span>
                <span className="shrink-0 tabular-nums">
                  {formatSets(v.total)}/{goalFor(goals, v.muscle).min}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {over.length > 0 && (
        <div className="space-y-1.5">
          <p className="flex items-center gap-1 text-xs font-medium text-destructive">
            <AlertTriangle className="size-3" />
            En tope
          </p>
          <ul className="space-y-1 text-xs text-muted-foreground">
            {over.map((v) => (
              <li key={v.muscle} className="flex justify-between gap-2">
                <span className="truncate">{v.muscle}</span>
                <span className="shrink-0 tabular-nums">
                  {formatSets(v.total)}/{goalFor(goals, v.muscle).max}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!under.length && !over.length && (
        <p className="text-xs text-muted-foreground">
          {volumes?.some((v) => v.programmed)
            ? 'Volumen en rango. Filtrá por aparato o buscá por nombre.'
            : 'Añade ejercicios y aquí verás qué músculos faltan.'}
        </p>
      )}
    </aside>
  )

  if (dialog) {
    // Un solo scroll: filtros + resultados. Antes los filtros iban fijos y
    // comían la mitad de la pantalla en móvil.
    return (
      <div className={cn('flex h-full min-h-0 gap-0', className)}>
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain pr-1">
          <div className="space-y-3 pb-4">
            {filters}
            {resultsMeta}
            <div className="grid content-start gap-1 sm:grid-cols-2">{resultsItems}</div>
          </div>
        </div>
        {context}
      </div>
    )
  }

  return (
    <div className={cn('flex min-h-0 flex-col gap-3', className)}>
      {filters}
      {resultsMeta}
      <div className="min-h-0 flex-1 space-y-1.5 overflow-auto">{resultsItems}</div>
    </div>
  )
}
