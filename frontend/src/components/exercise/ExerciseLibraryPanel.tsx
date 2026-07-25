import { useMemo, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import type { Exercise, PlanGoals, UserEquipment } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { ExerciseFamilyCard } from '@/components/exercise/ExerciseFamilyCard'
import { ExerciseFilterBar, ExerciseRoleChips } from '@/components/exercise/ExerciseFilterBar'
import { ExerciseResultRow } from '@/components/exercise/ExerciseResultRow'
import { useData } from '@/components/shell/DataContext'
import { groupExerciseResults, type Experience } from '@/lib/anatomy'
import { EMPTY_CURATION, useExerciseFilter, type Curation } from '@/lib/exerciseFilter'
import { muscleES } from '@/lib/muscle'
import { getExperience, setExperience } from '@/lib/settings'
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

const EXPERIENCE_OPTIONS: { id: Experience; label: string }[] = [
  { id: 'beginner', label: 'Principiante' },
  { id: 'intermediate', label: 'Intermedio' },
  { id: 'advanced', label: 'Avanzado' },
]

export function ExerciseLibraryPanel({
  exercises,
  equipment,
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
  const { equipmentUnlocks } = useData()
  const { filter, patch, results, visible, showMore, muscles, equipments } = useExerciseFilter(
    exercises,
    equipment,
    equipmentUnlocks,
    dialog ? PAGE_DIALOG : PAGE,
    curation,
  )
  const [experience, setExp] = useState<Experience>(() => getExperience())

  // Agrupar todo el resultado y paginar por entradas (no por ejercicio suelto),
  // para no partir una progresión entre «Ver más».
  const groupedAll = useMemo(() => groupExerciseResults(results), [results])
  const grouped = useMemo(() => groupedAll.slice(0, visible), [groupedAll, visible])
  const familyCount = useMemo(
    () => groupedAll.filter((g) => g.kind === 'family').length,
    [groupedAll],
  )

  const under = useMemo(() => {
    if (!volumes?.length) return []
    return volumes.filter((v) => v.programmed && volumeStatus(v, goals) === 'low').slice(0, 5)
  }, [volumes, goals])

  const over = useMemo(() => {
    if (!volumes?.length) return []
    return volumes.filter((v) => v.programmed && volumeStatus(v, goals) === 'high').slice(0, 4)
  }, [volumes, goals])

  const onExperience = (level: Experience) => {
    setExp(level)
    setExperience(level)
  }

  const filters = (
    <div className={cn('space-y-3', dialog && 'shrink-0 border-b border-border pb-3')}>
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
          onClick={() => patch({ curated: filter.curated === 'favoritos' ? 'todos' : 'favoritos' })}
        >
          Solo favoritos
        </Button>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="shrink-0">Mi nivel</span>
          <select
            className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground"
            value={experience}
            onChange={(e) => onExperience(e.target.value as Experience)}
          >
            {EXPERIENCE_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <ExerciseFilterBar
        filter={filter}
        onPatch={patch}
        muscles={muscles}
        equipments={equipments}
        layout={dialog ? 'grid' : 'stack'}
        showEquip={false}
      />
    </div>
  )

  const resultsList = (
    <>
      <p className="shrink-0 text-xs text-muted-foreground">
        {results.length} {results.length === 1 ? 'resultado' : 'resultados'}
        {familyCount > 0 &&
          ` · ${familyCount} ${familyCount === 1 ? 'progresión' : 'progresiones'}`}
      </p>

      <div
        className={cn(
          'min-h-0 flex-1 overflow-auto',
          dialog ? 'grid content-start gap-2 sm:grid-cols-2' : 'space-y-1.5',
        )}
      >
        {grouped.map((entry) =>
          entry.kind === 'family' ? (
            <ExerciseFamilyCard
              key={entry.familyId}
              label={entry.label}
              members={entry.members}
              experience={experience}
              alreadyIn={alreadyIn}
              disabled={!targetDayLabel || dayFull}
              onAdd={onAdd}
              onOpenGuide={onOpenGuide}
            />
          ) : (
            <ExerciseResultRow
              key={entry.ex.id}
              ex={entry.ex}
              added={alreadyIn.has(entry.ex.id)}
              favorite={curation.favorites.has(entry.ex.id)}
              disabled={!targetDayLabel || dayFull}
              overloadedMax={
                overloaded.has(muscleES(entry.ex.target))
                  ? goalFor(goals, muscleES(entry.ex.target)).max
                  : null
              }
              onAdd={onAdd}
              onOpenGuide={onOpenGuide}
            />
          ),
        )}

        {!results.length && (
          <p className="col-span-full py-8 text-center text-sm text-muted-foreground">
            Nada coincide. Prueba a quitar filtros o desactivar «Solo con mi equipo».
          </p>
        )}

        {visible < groupedAll.length && (
          <div className="col-span-full pt-2 pb-1 text-center">
            <Button variant="outline" size="sm" onClick={showMore}>
              Ver más ({groupedAll.length - visible} restantes)
            </Button>
          </div>
        )}
      </div>
    </>
  )

  const context = dialog && (
    <aside className="hidden w-56 shrink-0 flex-col gap-3 border-l border-border pl-4 lg:flex">
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
            ? 'Volumen en rango. Buscá por hueco o progresión.'
            : 'Añade ejercicios y aquí verás qué músculos faltan.'}
        </p>
      )}

      <p className="mt-auto text-[11px] leading-snug text-muted-foreground">
        Tip: con «Mi nivel» la progresión marca la variante recomendada.
      </p>
    </aside>
  )

  if (dialog) {
    return (
      <div className={cn('flex h-full min-h-0 flex-col gap-3', className)}>
        {filters}
        <div className="flex min-h-0 flex-1 gap-0">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">{resultsList}</div>
          {context}
        </div>
      </div>
    )
  }

  return (
    <div className={cn('flex min-h-0 flex-col gap-3', className)}>
      {filters}
      {resultsList}
    </div>
  )
}
