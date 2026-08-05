import { useCallback, useEffect, useMemo, useState } from 'react'
import { Star } from 'lucide-react'
import { api, type Exercise } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { ExerciseCard } from '@/components/ExerciseCard'
import { ExerciseFilterBar, ExerciseRoleChips } from '@/components/exercise/ExerciseFilterBar'
import { useData } from '@/components/shell/DataContext'
import {
  curationOf,
  DEFAULT_PAGE,
  useExerciseFilter,
  type Curation,
} from '@/lib/exerciseFilter'

/** Catálogo del espacio activo: el inventario y la curación salen del contexto,
 *  así no hay que arrastrar tres props hasta aquí. */
export function EjerciciosTab({
  exercises,
  onOpenExercise,
}: {
  exercises: Exercise[]
  onOpenExercise: (ex: Exercise) => void
}) {
  const { activeEquipment, equipmentUnlocks, activeGym, gyms, reloadGyms } = useData()
  const serverCuration = useMemo(() => curationOf(activeGym?.curation), [activeGym])
  const [localCuration, setLocalCuration] = useState<Curation>(serverCuration)
  useEffect(() => setLocalCuration(serverCuration), [serverCuration])

  const { filter, patch, results, shown, visible, showMore, muscles, bodyParts, equipments, counts } =
    useExerciseFilter(exercises, activeEquipment, equipmentUnlocks, DEFAULT_PAGE, localCuration, {
      list: gyms,
      defaultId: activeGym?.id ?? null,
    })
  const filterGym = useMemo(
    () => gyms.find((g) => g.id === filter.spaceId) ?? activeGym,
    [gyms, filter.spaceId, activeGym],
  )
  const favoriteCount = localCuration.favorites.size

  const toggleFavorite = useCallback(
    (exerciseId: string) => {
      if (activeGym == null) return
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
        .markExercise(activeGym.id, exerciseId, state)
        .then(() => reloadGyms())
        .catch(() => setLocalCuration(serverCuration))
    },
    [activeGym, localCuration.favorites, serverCuration, reloadGyms],
  )

  return (
    <div>
      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="kicker">Biblioteca</div>
            <h1 className="font-heading text-3xl leading-tight font-extrabold">
              {results.length} {results.length === 1 ? 'ejercicio' : 'ejercicios'}
              {filter.onlyMine && (
                <span className="text-muted-foreground">
                  {filterGym ? ` en ${filterGym.name}` : ' con tu equipo'}
                </span>
              )}
            </h1>
          </div>
          <ExerciseRoleChips
            role={filter.role}
            onChange={(role) => patch({ role })}
            className="flex-wrap"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={filter.curated === 'favoritos' ? 'default' : 'outline'}
            aria-pressed={filter.curated === 'favoritos'}
            className="gap-1.5"
            onClick={() =>
              patch({ curated: filter.curated === 'favoritos' ? 'todos' : 'favoritos' })
            }
          >
            <Star
              className={
                filter.curated === 'favoritos' ? 'size-3.5 fill-current' : 'size-3.5'
              }
            />
            Favoritos
            {favoriteCount > 0 && (
              <span className="tabular-nums opacity-80">{favoriteCount}</span>
            )}
          </Button>
        </div>

        <ExerciseFilterBar
          filter={filter}
          onPatch={patch}
          muscles={muscles}
          bodyParts={bodyParts}
          equipments={equipments}
          showBodyPart={false}
          showMuscle={false}
          spaces={gyms}
          counts={counts}
        />
      </div>

      {results.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {filter.curated === 'favoritos'
            ? 'Aún no tienes favoritos en este espacio. Márcalos con la estrella en la tarjeta o en la ficha del ejercicio.'
            : `Ningún ejercicio coincide. Prueba a quitar filtros o a desactivar el de equipo${
                activeGym ? ` de ${activeGym.name}` : ''
              }.`}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {shown.map((ex) => (
              <ExerciseCard
                key={ex.id}
                ex={ex}
                favorite={localCuration.favorites.has(ex.id)}
                onOpen={onOpenExercise}
                onToggleFavorite={
                  activeGym ? () => toggleFavorite(ex.id) : undefined
                }
              />
            ))}
          </div>
          {visible < results.length && (
            <div className="mt-4 flex justify-center">
              <Button variant="outline" onClick={showMore}>
                Ver más ({results.length - visible} restantes)
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
