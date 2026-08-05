import type { DragEvent } from 'react'
import { AlertTriangle, Check, Clock, Moon, Pencil, Play, Plus, ShieldCheck } from 'lucide-react'
import type { Exercise, PlanDay, PlanGoals, PlanItem, PlanSection, WeekDay } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { MediaImg } from '@/components/MediaImg'
import { DayStimulusPanel } from '@/components/plan/DayStimulusPanel'
import { PlanItemRow } from '@/components/plan/PlanItemRow'
import { formatCardioPrescription, isEnduranceCardioItem } from '@/lib/cardio'
import type { DayMusclePoint } from '@/lib/dayStimulus'
import { estimateDayMinutes, formatDayMinutes } from '@/lib/dayTime'
import {
  PLAN_SECTION_BADGE,
  PLAN_SECTION_STYLE,
  PLAN_SECTIONS,
  resolveSection,
} from '@/lib/plan'
import type { DayOrderConflict } from '@/lib/sessionSafety'
import type { PlanViewPref } from '@/lib/settings'
import type { MuscleVolume } from '@/lib/volume'
import { cn } from '@/lib/utils'

function itemPrescription(item: PlanItem): string {
  if (isEnduranceCardioItem(item)) return formatCardioPrescription(item)
  if (item.rep_min === item.rep_max) return `${item.sets}×${item.rep_min}`
  return `${item.sets}×${item.rep_min}–${item.rep_max}`
}

function PlanItemTile({
  item,
  onOpen,
}: {
  item: PlanItem
  onOpen: () => void
}) {
  const ex = item.exercise
  const name = ex?.name_es || item.exercise_id
  const rx = itemPrescription(item)
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onOpen()
      }}
      aria-label={`Ver guía de ${name}. ${rx}`}
      title={`${name} · ${rx}`}
      className="group overflow-hidden rounded-lg border bg-card text-left shadow-sm transition-colors hover:border-primary/40 hover:bg-muted/30"
    >
      <div className="aspect-square bg-muted/40">
        {ex ? (
          <MediaImg
            image={ex.image}
            gif={ex.gif}
            alt={name}
            className="h-full w-full object-contain p-1"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[10px] text-muted-foreground">
            ?
          </div>
        )}
      </div>
      <div className="space-y-0.5 px-1 py-1">
        <div className="truncate text-[11px] leading-tight font-medium">{name}</div>
        <div className="truncate text-[10px] leading-tight tabular-nums text-muted-foreground">
          {rx}
        </div>
      </div>
    </button>
  )
}

export function PlanDayCard({
  day,
  week,
  focused,
  editing,
  view,
  stimulus,
  volumes,
  goals,
  safetyConflicts,
  draggingIndex,
  draggedOver,
  isDragging,
  restSeconds,
  onFocus,
  onToggleEdit,
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
  /** Lista = filas; cards = miniaturas en cuadrícula. En edición siempre lista. */
  view: PlanViewPref
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
  onToggleEdit: () => void
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
  onAddExercise: (section: PlanSection) => void
  onOpenExercise: (
    ex: Exercise,
    cardio?: import('@/lib/cardio').CardioGuideContext | null,
  ) => void
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
  // Se puede soltar en cualquier día mientras se arrastra desde uno en edición.
  const handleDragOver = (event: DragEvent<HTMLElement>) => {
    if (!isDragging) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    onDragOverDay()
  }
  const handleDrop = (event: DragEvent<HTMLElement>) => {
    if (!isDragging) return
    event.preventDefault()
    onDropOnDay()
  }

  const sections = PLAN_SECTIONS.map(({ id, label }) => {
    const entries = day.items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => resolveSection(item) === id)
    return { id, label, entries }
  })
  const visibleSections = editing ? sections : sections.filter((s) => s.entries.length > 0)
  /** La cuadrícula no cabe con inputs de series/reps; al editar se fuerza lista. */
  const useGrid = !editing && view === 'cards'

  const openItemGuide = (item: PlanItem) => {
    if (!item.exercise) return
    onOpenExercise(
      item.exercise,
      item.cardio_kind || item.session_type
        ? {
            kind: item.cardio_kind,
            session_type: item.session_type,
            surface: item.cardio_surface,
            target_km: item.target_km,
            target_min: item.target_min,
            notes: item.notes,
          }
        : null,
    )
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
            <Button
              type="button"
              size="sm"
              variant={editing ? 'secondary' : 'outline'}
              className="h-7 gap-1 px-2"
              aria-label={editing ? `Listo con ${day.label}` : `Editar ${day.label}`}
              onClick={(e) => {
                e.stopPropagation()
                onToggleEdit()
              }}
            >
              {editing ? <Check className="size-3.5" /> : <Pencil className="size-3.5" />}
              <span className="hidden sm:inline">{editing ? 'Listo' : 'Editar'}</span>
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 px-3 pb-3 sm:px-4">
        {isRest && !editing && !isDragging ? (
          <p className="text-sm text-muted-foreground">Día de descanso.</p>
        ) : isRest && isDragging ? (
          <p className="text-sm text-muted-foreground">
            Suelta aquí para mover el ejercicio a este día.
          </p>
        ) : (
          <div className="space-y-3">
            {isRest && editing && (
              <p className="text-sm text-muted-foreground">
                Día de descanso. Añade ejercicios a una sección para convertirlo en día de entreno.
              </p>
            )}
            {visibleSections.map(({ id, label, entries }) => (
              <section
                key={id}
                className={cn('rounded-xl border p-2.5 sm:p-3', PLAN_SECTION_STYLE[id])}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <Badge variant="outline" className={cn('font-medium', PLAN_SECTION_BADGE[id])}>
                    {label}
                    {entries.length > 0 && (
                      <span className="ml-1.5 font-normal opacity-70">{entries.length}</span>
                    )}
                  </Badge>
                  {editing && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 gap-1 px-2 text-xs"
                      onClick={(e) => {
                        e.stopPropagation()
                        onAddExercise(id)
                      }}
                    >
                      <Plus className="size-3.5" />
                      Añadir
                    </Button>
                  )}
                </div>
                {entries.length === 0 ? (
                  editing && (
                    <p className="px-0.5 text-xs text-muted-foreground">Sin ejercicios todavía.</p>
                  )
                ) : useGrid ? (
                  <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5 md:grid-cols-6">
                    {entries.map(({ item, index }) => (
                      <PlanItemTile
                        key={`${item.exercise_id}-${index}`}
                        item={item}
                        onOpen={() => openItemGuide(item)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className={cn(editing ? 'space-y-2' : 'space-y-0.5')}>
                    {entries.map(({ item, index }, sectionPos) => (
                      <PlanItemRow
                        key={`${item.exercise_id}-${index}`}
                        item={item}
                        index={index}
                        count={day.items.length}
                        editing={editing}
                        compact={!editing}
                        canMoveUp={sectionPos > 0}
                        canMoveDown={sectionPos < entries.length - 1}
                        onPatch={(patch) => onPatchItem(index, patch)}
                        onCommit={() => onCommitItem(index)}
                        onMove={(dir) => onMoveItem(index, dir)}
                        onRemove={() => onRemoveItem(index)}
                        onOpenGuide={() => openItemGuide(item)}
                        onDragStart={() => onDragItemStart(index)}
                        onDragEnd={onDragItemEnd}
                        dragging={draggingIndex === index}
                        safetyConflict={conflictsByIndex.get(index)}
                      />
                    ))}
                  </div>
                )}
              </section>
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

        {!isRest && (
          <div className="border-t border-border pt-3">
            <DayStimulusPanel points={stimulus} volumes={volumes} goals={goals} />
          </div>
        )}

        {editing && !isRest && (
          <div className="flex flex-wrap gap-2 border-t border-border pt-3">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={onClearDay}>
              <Moon className="size-3.5" />
              Convertir en descanso
            </Button>
          </div>
        )}

        {week && (
          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
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
