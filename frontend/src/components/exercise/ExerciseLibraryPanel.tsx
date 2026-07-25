import type { Exercise, PlanGoals, UserEquipment } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { ExerciseFilterBar, ExerciseRoleChips } from '@/components/exercise/ExerciseFilterBar'
import { ExerciseResultRow } from '@/components/exercise/ExerciseResultRow'
import { useData } from '@/components/shell/DataContext'
import { EMPTY_CURATION, useExerciseFilter, type Curation } from '@/lib/exerciseFilter'
import { muscleES } from '@/lib/muscle'
import { goalFor } from '@/lib/volume'
import { cn } from '@/lib/utils'

/** Página del panel: más corta que la de la biblioteca a pantalla completa,
 *  porque aquí las filas son altas y la columna estrecha. */
const PAGE = 40

export function ExerciseLibraryPanel({
  exercises,
  equipment,
  curation = EMPTY_CURATION,
  targetDayLabel,
  alreadyIn,
  dayFull,
  overloaded,
  goals,
  onAdd,
  onOpenGuide,
  className,
}: {
  exercises: Exercise[]
  /** Inventario del espacio al que pertenece el plan. */
  equipment: UserEquipment[]
  curation?: Curation
  /** Día que recibe los ejercicios. `null` = ningún día enfocado. */
  targetDayLabel: string | null
  alreadyIn: Set<string>
  dayFull: boolean
  overloaded: Set<string>
  goals: PlanGoals
  onAdd: (ex: Exercise) => void
  onOpenGuide: (ex: Exercise) => void
  className?: string
}) {
  const { equipmentUnlocks } = useData()
  const { filter, patch, results, shown, visible, showMore, muscles, equipments } =
    useExerciseFilter(exercises, equipment, equipmentUnlocks, PAGE, curation)

  return (
    <div className={cn('flex min-h-0 flex-col gap-3', className)}>
      <p className="text-sm text-muted-foreground">
        {targetDayLabel ? (
          <>
            Añadiendo a <strong className="text-foreground">{targetDayLabel}</strong>
          </>
        ) : (
          'Elige un día para añadir ejercicios.'
        )}
      </p>

      <ExerciseRoleChips
        role={filter.role}
        onChange={(role) => patch({ role })}
        className="flex-wrap"
      />
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={filter.curated === 'favoritos' ? 'default' : 'outline'}
          aria-pressed={filter.curated === 'favoritos'}
          onClick={() => patch({ curated: filter.curated === 'favoritos' ? 'todos' : 'favoritos' })}
        >
          Solo favoritos
        </Button>
      </div>
      <ExerciseFilterBar
        filter={filter}
        onPatch={patch}
        muscles={muscles}
        equipments={equipments}
        layout="stack"
        showEquip={false}
      />

      <p className="text-xs text-muted-foreground">
        {results.length} {results.length === 1 ? 'resultado' : 'resultados'}
      </p>

      <div className="min-h-0 flex-1 space-y-1 overflow-auto">
        {shown.map((ex) => (
          <ExerciseResultRow
            key={ex.id}
            ex={ex}
            added={alreadyIn.has(ex.id)}
            favorite={curation.favorites.has(ex.id)}
            disabled={!targetDayLabel || dayFull}
            overloadedMax={
              overloaded.has(muscleES(ex.target)) ? goalFor(goals, muscleES(ex.target)).max : null
            }
            onAdd={onAdd}
            onOpenGuide={onOpenGuide}
          />
        ))}

        {!results.length && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nada coincide. Prueba a quitar filtros o desactivar «Solo con mi equipo».
          </p>
        )}

        {visible < results.length && (
          <div className="pt-2 pb-1 text-center">
            <Button variant="outline" size="sm" onClick={showMore}>
              Ver más ({results.length - visible} restantes)
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
