import { useMemo } from 'react'
import type { Exercise } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { ExerciseCard } from '@/components/ExerciseCard'
import { ExerciseFilterBar, ExerciseRoleChips } from '@/components/exercise/ExerciseFilterBar'
import { useData } from '@/components/shell/DataContext'
import { curationOf, DEFAULT_PAGE, useExerciseFilter } from '@/lib/exerciseFilter'

/** Catálogo del espacio activo: el inventario y la curación salen del contexto,
 *  así no hay que arrastrar tres props hasta aquí. */
export function EjerciciosTab({
  exercises,
  onOpenExercise,
}: {
  exercises: Exercise[]
  onOpenExercise: (ex: Exercise) => void
}) {
  const { activeEquipment, equipmentUnlocks, activeGym, gyms } = useData()
  const curation = useMemo(() => curationOf(activeGym?.curation), [activeGym])
  const { filter, patch, results, shown, visible, showMore, muscles, equipments, counts } =
    useExerciseFilter(exercises, activeEquipment, equipmentUnlocks, DEFAULT_PAGE, curation, {
      list: gyms,
      defaultId: activeGym?.id ?? null,
    })
  const filterGym = useMemo(
    () => gyms.find((g) => g.id === filter.spaceId) ?? activeGym,
    [gyms, filter.spaceId, activeGym],
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
          <ExerciseRoleChips role={filter.role} onChange={(role) => patch({ role })} />
        </div>

        <ExerciseFilterBar
          filter={filter}
          onPatch={patch}
          muscles={muscles}
          equipments={equipments}
          spaces={gyms}
          counts={counts}
        />
      </div>

      {results.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Ningún ejercicio coincide. Prueba a quitar filtros o a desactivar el de equipo
          {activeGym ? ` de ${activeGym.name}` : ''}.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {shown.map((ex) => (
              <ExerciseCard key={ex.id} ex={ex} onOpen={onOpenExercise} />
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
