import type { DragEvent } from 'react'
import { AlertTriangle, Clock, Moon, Play, Plus, ShieldCheck } from 'lucide-react'
import type { Exercise, PlanDay, PlanGoals, PlanItem, WeekDay } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { DayStimulusPanel } from '@/components/plan/DayStimulusPanel'
import { PlanItemRow } from '@/components/plan/PlanItemRow'
import type { DayMusclePoint } from '@/lib/dayStimulus'
import { estimateDayMinutes, formatDayMinutes } from '@/lib/dayTime'
import type { DayOrderConflict } from '@/lib/sessionSafety'
import type { MuscleVolume } from '@/lib/volume'
import { cn } from '@/lib/utils'

export function PlanDayCard({
  day,
  week,
  focused,
  editing,
  stimulus,
  volumes,
  goals,
  safetyConflicts,
  draggingIndex,
  draggedOver,
  isDragging,
  restSeconds,
  onFocus,
  onRelabel,
  onPatchItem,
  onCommitItem,
  onMoveItem,
  onReorderSafe,
  onDragItemStart,
  onDragItemEnd,
  onDragOverDay,
  onDropOnDay,
  onRemoveItem,
  onClearDay,
  onAddExercise,
  onOpenExercise,
  onMarkDay,
  onGoRegister,
  onGoTrain,
}: {
  day: PlanDay
  /** El mismo día proyectado sobre la semana en curso. Solo llega cuando el
   *  plan seleccionado es el activo: es lo que habilita ejecutar desde aquí. */
  week: WeekDay | undefined
  focused: boolean
  editing: boolean
  stimulus: DayMusclePoint[]
  /** Volumen semanal del plan: sitúa lo del día dentro de la semana. */
  volumes: MuscleVolume[]
  goals: PlanGoals
  safetyConflicts: DayOrderConflict[]
  draggingIndex: number | null
  draggedOver: boolean
  isDragging: boolean
  /** Descanso por defecto del plan (s), para estimar duración. */
  restSeconds: number
  onFocus: () => void
  onRelabel: (label: string) => void
  onPatchItem: (index: number, patch: Partial<PlanItem>) => void
  onCommitItem: (index: number) => void
  onMoveItem: (index: number, dir: -1 | 1) => void
  onReorderSafe: () => void
  onDragItemStart: (index: number) => void
  onDragItemEnd: () => void
  onDragOverDay: () => void
  onDropOnDay: () => void
  onRemoveItem: (index: number) => void
  onClearDay: () => void
  onAddExercise: () => void
  onOpenExercise: (ex: Exercise) => void
  onMarkDay: (day: WeekDay, completed: boolean) => void
  onGoRegister: (day: WeekDay) => void
  onGoTrain: (day: WeekDay) => void
}) {
  const isRest = !day.items.length
  const sets = day.items.reduce((n, i) => n + i.sets, 0)
  const minutes = estimateDayMinutes(day, restSeconds)
  const complete = week?.status === 'completed'
  const partial = week?.status === 'partial'
  const conflictsByIndex = new Map(safetyConflicts.map((c) => [c.atIndex, c]))
  const firstConflict = safetyConflicts[0]
  const handleDragOver = (event: DragEvent<HTMLElement>) => {
    if (!editing || !isDragging) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    onDragOverDay()
  }
  const handleDrop = (event: DragEvent<HTMLElement>) => {
    if (!editing || !isDragging) return
    event.preventDefault()
    onDropOnDay()
  }

  return (
    <Card
      onClick={onFocus}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={cn(
        'transition-shadow',
        focused && 'ring-2 ring-primary/40',
        (complete || partial) && !focused && 'ring-primary/40',
        draggedOver && 'ring-2 ring-amber-500/60',
      )}
    >
      <CardHeader className="space-y-0 px-3 py-2.5 sm:px-4">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            {week && <div className="kicker leading-none">{week.date}</div>}
            {editing ? (
              <Input
                value={day.label}
                onChange={(e) => onRelabel(e.target.value)}
                className="mt-0.5 h-8 font-heading font-extrabold"
                aria-label={`Nombre del día ${day.weekday + 1}`}
              />
            ) : (
              <h3 className="truncate font-heading text-sm font-extrabold sm:text-base">
                {day.label}
              </h3>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
            {!isRest && (
              <Badge
                variant="outline"
                className="gap-1 font-normal tabular-nums"
                title="Tiempo estimado según series, reps y descanso del plan"
              >
                <Clock className="size-3" />
                {formatDayMinutes(minutes)}
              </Badge>
            )}
            {complete ? (
              <Badge variant="brand">Hecho</Badge>
            ) : partial ? (
              <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary">
                Parcial {week.done_sets}/{week.planned_sets}
              </Badge>
            ) : (
              <Badge variant={isRest ? 'outline' : 'secondary'} className="font-normal">
                {isRest ? 'Descanso' : `${day.items.length} ej. · ${sets} series`}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-2 px-3 pb-3 sm:px-4">
        {isRest ? (
          <p className="text-sm text-muted-foreground">
            {editing && isDragging
              ? 'Suelta aquí para mover el ejercicio a este día.'
              : editing
              ? 'Día de descanso. Añade ejercicios para convertirlo en día de entreno.'
              : 'Día de descanso.'}
          </p>
        ) : (
          <div className="space-y-0.5">
            {day.items.map((item, i) => (
              <PlanItemRow
                key={`${item.exercise_id}-${i}`}
                item={item}
                index={i}
                count={day.items.length}
                editing={editing}
                compact={!editing}
                onPatch={(patch) => onPatchItem(i, patch)}
                onCommit={() => onCommitItem(i)}
                onMove={(dir) => onMoveItem(i, dir)}
                onRemove={() => onRemoveItem(i)}
                onOpenGuide={() => item.exercise && onOpenExercise(item.exercise)}
                onDragStart={() => onDragItemStart(i)}
                onDragEnd={onDragItemEnd}
                dragging={draggingIndex === i}
                safetyConflict={conflictsByIndex.get(i)}
              />
            ))}
          </div>
        )}

        {editing && firstConflict && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
            <p className="flex items-start gap-1.5">
              <AlertTriangle className="mt-px size-3.5 shrink-0" />
              <span>
                {safetyConflicts.length === 1
                  ? 'Hay 1 conflicto de orden.'
                  : `Hay ${safetyConflicts.length} conflictos de orden.`}{' '}
                {firstConflict.message}
              </span>
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-2 h-7 gap-1.5 bg-background/70"
              onClick={onReorderSafe}
            >
              <ShieldCheck className="size-3.5" />
              Reordenar seguro
            </Button>
          </div>
        )}

        {!isRest && <DayStimulusPanel points={stimulus} volumes={volumes} goals={goals} />}

        {editing && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="gap-1.5" onClick={onAddExercise}>
              <Plus className="size-3.5" />
              Añadir ejercicio
            </Button>
            {!isRest && (
              <Button size="sm" variant="outline" className="gap-1.5" onClick={onClearDay}>
                <Moon className="size-3.5" />
                Convertir en descanso
              </Button>
            )}
          </div>
        )}

        {week && (
          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2">
            {!isRest && week.volume_kg > 0 && (
              <span className="mr-auto text-xs text-muted-foreground">
                {Math.round(week.volume_kg)} kg
                {week.session_rpe != null ? ` · RPE ${week.session_rpe}` : ''}
              </span>
            )}
            <Button size="sm" variant="outline" onClick={() => onMarkDay(week, !week.completed)}>
              {week.completed ? 'Desmarcar' : 'Marcar'}
            </Button>
            {!isRest && (
              <>
                <Button size="sm" className="gap-1.5" onClick={() => onGoTrain(week)}>
                  <Play className="size-3.5" />
                  Sesión
                </Button>
                <Button size="sm" variant="outline" onClick={() => onGoRegister(week)}>
                  Historial
                </Button>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
