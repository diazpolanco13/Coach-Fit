import { useMemo, useState } from 'react'
import {
  BookOpen,
  Check,
  CheckCircle2,
  Copy,
  Loader2,
  MoreHorizontal,
  Pencil,
  Save,
  Trash2,
} from 'lucide-react'
import type { Exercise, PlanItem, WeekDay } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ExerciseLibraryPanel } from '@/components/exercise/ExerciseLibraryPanel'
import { PlanDayCard } from '@/components/plan/PlanDayCard'
import { PlanDiagnosis } from '@/components/plan/PlanDiagnosis'
import { PlanGoalsEditor } from '@/components/plan/PlanGoalsEditor'
import { ObjectivePicker } from '@/components/plan/ObjectivePicker'
import { VolumePanel } from '@/components/VolumePanel'
import { useData } from '@/components/shell/DataContext'
import { MAX_EXERCISES_PER_DAY, type PlanAction, type PlanDraft } from '@/lib/plan'
import { curationOf } from '@/lib/exerciseFilter'
import { cn } from '@/lib/utils'
import { dayMuscleStimulus } from '@/lib/dayStimulus'
import { overloadedMuscles, weeklyVolume } from '@/lib/volume'

export function PlanScreen({
  draft,
  dispatch,
  dirty,
  saving,
  error,
  onSave,
  sub,
  isActive,
  weekDays,
  onDuplicate,
  onActivate,
  onDelete,
  onMarkDay,
  onGoRegister,
  onGoTrain,
}: {
  draft: PlanDraft
  dispatch: (a: PlanAction) => void
  dirty: boolean
  saving: boolean
  error: string
  onSave: () => void
  sub: 'dias' | 'objetivos'
  isActive: boolean
  weekDays: WeekDay[]
  onDuplicate: () => void
  onActivate: () => void
  onDelete: () => void
  onMarkDay: (day: WeekDay, completed: boolean) => void
  onGoRegister: (day: WeekDay) => void
  onGoTrain: (day: WeekDay) => void
}) {
  const { exercises, gyms, activeGym, openGuide } = useData()
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [focusedWeekday, setFocusedWeekday] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  /** Por defecto solo se mira el plan; los inputs salen al entrar a editar. */
  const [editing, setEditing] = useState(false)

  const exMap = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises])
  const volumes = useMemo(
    () => weeklyVolume(draft.days, exMap, draft.indirectWeight),
    [draft.days, exMap, draft.indirectWeight],
  )
  const overloaded = useMemo(() => overloadedMuscles(volumes, draft.goals), [volumes, draft.goals])
  const dayStimulus = useMemo(() => {
    const map = new Map<number, ReturnType<typeof dayMuscleStimulus>>()
    for (const day of draft.days) {
      map.set(day.weekday, dayMuscleStimulus(day, exMap, draft.indirectWeight))
    }
    return map
  }, [draft.days, exMap, draft.indirectWeight])
  const weekByWeekday = useMemo(() => new Map(weekDays.map((d) => [d.weekday, d])), [weekDays])

  // El plan se edita con el material de SU espacio, no el del selector: si estás
  // mirando «Parque» mientras editas un plan de casa, la biblioteca tiene que
  // seguir ofreciéndote mancuernas.
  const planGym = useMemo(
    () => gyms.find((g) => g.id === draft.gymId) ?? activeGym,
    [gyms, draft.gymId, activeGym],
  )
  const curation = useMemo(() => curationOf(planGym?.curation), [planGym])

  const focusedDay = draft.days.find((d) => d.weekday === focusedWeekday) ?? draft.days[0]
  const alreadyIn = useMemo(
    () => new Set(focusedDay?.items.map((i) => i.exercise_id) ?? []),
    [focusedDay],
  )

  const openLibraryFor = (weekday: number) => {
    setEditing(true)
    setFocusedWeekday(weekday)
    setLibraryOpen(true)
  }

  const addExercise = (ex: Exercise) =>
    dispatch({ type: 'ADD_EXERCISE', weekday: focusedWeekday, exerciseId: ex.id, exercise: ex })

  const patchItem = (weekday: number, index: number, patch: Partial<PlanItem>) =>
    dispatch({ type: 'PATCH_ITEM', weekday, index, patch })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {editing ? (
          <Input
            value={draft.name}
            onChange={(e) => dispatch({ type: 'RENAME', name: e.target.value })}
            aria-label="Nombre del plan"
            className="w-44 font-heading font-extrabold sm:w-72"
          />
        ) : (
          <h2 className="max-w-[18rem] truncate font-heading text-lg font-extrabold sm:max-w-md">
            {draft.name}
          </h2>
        )}
        {isActive && <Badge variant="brand">Activo</Badge>}
        {planGym && (
          <Badge variant="outline" className="gap-1">
            <span aria-hidden>{planGym.icon || '📍'}</span>
            {planGym.name}
          </Badge>
        )}

        <div className="ml-auto flex items-center gap-2">
          {dirty && (
            <span className="hidden text-xs text-muted-foreground sm:inline">
              Cambios sin guardar
            </span>
          )}
          <Button
            variant={editing ? 'secondary' : 'outline'}
            className="gap-1.5"
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? <Check className="size-3.5" /> : <Pencil className="size-3.5" />}
            {editing ? 'Listo' : 'Editar'}
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Más acciones"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <MoreHorizontal />
          </Button>
          {/* Guardar es un FAB en móvil: dos barras pegajosas a 390px son
              demasiado cromo, así que la acción baja a la esquina. */}
          {(editing || dirty) && (
            <Button
              className="fixed right-4 bottom-[4.5rem] z-30 gap-1.5 shadow-lg md:static md:shadow-none"
              disabled={saving || !dirty}
              onClick={onSave}
            >
              {saving ? <Loader2 className="animate-spin" /> : <Save />}
              Guardar plan
            </Button>
          )}
        </div>
      </div>

      {menuOpen && (
        <div className="flex flex-wrap gap-2 rounded-lg border p-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={onDuplicate}>
            <Copy className="size-3.5" /> Duplicar
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={isActive}
            title={isActive ? 'Ya es el plan activo' : 'Usar este plan en Hoy y Registrar'}
            onClick={onActivate}
          >
            <CheckCircle2 className="size-3.5" /> Activar
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-muted-foreground hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="size-3.5" /> Eliminar
          </Button>
        </div>
      )}

      {error && (
        <p className="rounded-lg border border-destructive/40 p-2.5 text-sm text-destructive">
          {error}
        </p>
      )}

      {sub === 'dias' && (
        <>
          <Card>
            <CardContent className="space-y-0 p-0">
              <VolumePanel volumes={volumes} goals={draft.goals} compact />
              <PlanDiagnosis
                days={draft.days}
                volumes={volumes}
                objective={draft.objective}
                exMap={exMap}
              />
            </CardContent>
          </Card>

          {editing && (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" className="gap-1.5" onClick={() => setLibraryOpen(true)}>
                <BookOpen className="size-3.5" />
                Biblioteca
              </Button>
              {curation.hidden.size > 0 && (
                <span className="text-xs text-muted-foreground">
                  {curation.hidden.size} ejercicios ocultos en {planGym?.name}
                </span>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {draft.days.map((day) => (
              <PlanDayCard
                key={day.weekday}
                day={day}
                week={isActive ? weekByWeekday.get(day.weekday) : undefined}
                focused={day.weekday === focusedWeekday}
                editing={editing}
                stimulus={dayStimulus.get(day.weekday) ?? []}
                restSeconds={draft.restSeconds}
                onFocus={() => setFocusedWeekday(day.weekday)}
                onRelabel={(label) =>
                  dispatch({ type: 'PATCH_DAY', weekday: day.weekday, patch: { label } })
                }
                onPatchItem={(index, patch) => patchItem(day.weekday, index, patch)}
                onCommitItem={(index) =>
                  dispatch({ type: 'NORMALIZE_ITEM', weekday: day.weekday, index })
                }
                onMoveItem={(index, dir) =>
                  dispatch({ type: 'MOVE_EXERCISE', weekday: day.weekday, index, dir })
                }
                onRemoveItem={(index) =>
                  dispatch({ type: 'REMOVE_EXERCISE', weekday: day.weekday, index })
                }
                onClearDay={() => dispatch({ type: 'CLEAR_DAY', weekday: day.weekday })}
                onAddExercise={() => openLibraryFor(day.weekday)}
                onOpenExercise={openGuide}
                onMarkDay={onMarkDay}
                onGoRegister={onGoRegister}
                onGoTrain={onGoTrain}
              />
            ))}
          </div>
        </>
      )}

      {sub === 'objetivos' && (
        <div className="space-y-4">
          <ObjectivePicker
            objective={draft.objective}
            goals={draft.goals}
            onSetObjective={(objective) => dispatch({ type: 'SET_OBJECTIVE', objective })}
            onApply={(goals, mode) => dispatch({ type: 'APPLY_OBJECTIVE_GOALS', goals, mode })}
          />
          <PlanGoalsEditor
            goals={draft.goals}
            volumes={volumes}
            indirectWeight={draft.indirectWeight}
            onSetIndirectWeight={(weight) => dispatch({ type: 'SET_INDIRECT_WEIGHT', weight })}
            onSetBase={(min, max) => dispatch({ type: 'SET_BASE_GOAL', min, max })}
            onSetMuscle={(muscle, min, max) =>
              dispatch({ type: 'SET_MUSCLE_GOAL', muscle, min, max })
            }
            onRemoveMuscle={(muscle) => dispatch({ type: 'REMOVE_MUSCLE_GOAL', muscle })}
          />
        </div>
      )}

      {/* Biblioteca en Dialog centrado: el Sheet de ~440px ya no alcanza para
          filtros + progresiones + anatomía. Se mantiene abierto al añadir. */}
      <Dialog open={libraryOpen} onOpenChange={setLibraryOpen}>
        <DialogContent
          className={cn(
            'flex w-[min(96vw,1100px)] max-w-none flex-col gap-0 overflow-hidden p-0',
            'h-[min(88vh,820px)] max-h-[90vh]',
          )}
        >
          <DialogHeader className="shrink-0 border-b border-border px-5 py-4 pr-12">
            <DialogTitle>Añadir ejercicio</DialogTitle>
            <DialogDescription>
              {focusedDay
                ? `Eligiendo para ${focusedDay.label}. Las progresiones muestran nivel y carga.`
                : 'Elige un día del plan para poder añadir.'}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 px-5 py-4">
            <ExerciseLibraryPanel
              exercises={exercises}
              equipment={planGym?.equipment ?? []}
              curation={curation}
              targetDayLabel={focusedDay?.label ?? null}
              alreadyIn={alreadyIn}
              dayFull={(focusedDay?.items.length ?? 0) >= MAX_EXERCISES_PER_DAY}
              overloaded={overloaded}
              goals={draft.goals}
              volumes={volumes}
              onAdd={addExercise}
              onOpenGuide={openGuide}
              layout="dialog"
              className="h-full"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
