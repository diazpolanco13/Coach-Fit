import { ArrowLeft, Check, CheckCheck, Plus, Trash2, TrendingUp, X } from 'lucide-react'
import type { Exercise, PlanItem, SessionSet } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ExercisePainPicker } from '@/components/session/ExercisePainPicker'
import { muscleES } from '@/lib/muscle'
import type { ExerciseFeedbackMap } from '@/lib/sessionCheckIn'
import { setKey } from '@/lib/sessionDraft'
import { cn } from '@/lib/utils'

/** Serie del borrador con su posición en el array plano de la sesión. */
export type DraftSet = SessionSet & { idx: number }

/** Editor de las series de UN ejercicio dentro de la sesión.
 *
 *  Sale una fila por cada serie que el plan prescribe y se marca la que se
 *  hizo. Hacer 2 de las 4 previstas es normal, así que ninguna fila viene
 *  marcada: la lista es el objetivo, las marcas son el registro. «Añadir serie»
 *  queda para lo que se hizo de más.
 *
 *  El modelo anterior —una fila y a fabricar el resto— evitaba dar por hechas
 *  series que nadie levantó, pero convertía cumplir el plan en el camino más
 *  largo y escondía «hecha» detrás de escribir en la fila.
 */
export function SetListEditor({
  exerciseId,
  exercise,
  planItem,
  sets,
  logged,
  onUpdate,
  onToggleLogged,
  onToggleAll,
  onAddSet,
  onRemoveSet,
  onRemoveExercise,
  onBack,
  onOpenGuide,
  onSuggestProgression,
  feedback,
  onFeedbackChange,
}: {
  exerciseId: string
  exercise?: Exercise
  /** Lo que el plan pide para este ejercicio hoy, si es que lo pide. */
  planItem?: PlanItem
  sets: DraftSet[]
  /** Claves (`setKey`) de las series que cuentan como registro real. Las demás
   *  son prescripción del plan que nadie ha confirmado todavía. */
  logged: Set<string>
  onUpdate: (idx: number, patch: Partial<SessionSet>) => void
  onToggleLogged: (idx: number) => void
  /** Marca todas las series del ejercicio, o las desmarca si ya lo estaban. */
  onToggleAll: () => void
  onAddSet: () => void
  onRemoveSet: (setIndex: number) => void
  onRemoveExercise: () => void
  onBack: () => void
  onOpenGuide: (ex: Exercise) => void
  onSuggestProgression: (exerciseId: string, reps: number, weightKg: number, rpe: number) => void
  feedback: ExerciseFeedbackMap
  onFeedbackChange: (next: ExerciseFeedbackMap) => void
}) {
  const isBodyweight = exercise?.equipment === 'body weight'
  const last = sets[sets.length - 1]
  const counted = sets.filter((s) => logged.has(setKey(s))).length

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <Button variant="outline" size="sm" className="gap-1.5" onClick={onBack}>
          <ArrowLeft />
          Volver a ejercicios
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground hover:text-destructive"
          onClick={onRemoveExercise}
        >
          <Trash2 className="size-3.5" />
          Omitir
        </Button>
      </div>

      <div className="mb-2 space-y-2">
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-lg border border-transparent p-1.5 text-left transition-colors hover:border-border hover:bg-muted/60"
          onClick={() => exercise && onOpenGuide(exercise)}
        >
          {exercise?.image && (
            <img src={exercise.image} alt="" className="size-9 shrink-0 rounded border object-contain" />
          )}
          <span className="min-w-0">
            <span className="block text-sm font-medium">{exercise?.name_es || exerciseId}</span>
            {exercise?.target && (
              <span className="block text-xs text-muted-foreground">
                {muscleES(exercise.target)}
                {exercise.secondary_muscles?.length
                  ? ` · ${exercise.secondary_muscles.map(muscleES).join(', ')}`
                  : ''}
              </span>
            )}
          </span>
          <span className="ml-auto shrink-0 pr-1 text-xs font-medium text-primary">Ver guía →</span>
        </button>

        {planItem && (
          <p className="text-xs text-muted-foreground">
            El plan pide{' '}
            <strong className="font-medium text-foreground">
              {planItem.sets} × {planItem.rep_min}–{planItem.rep_max}
            </strong>
            . Marca las que hiciste tocando su número.
          </p>
        )}
        {isBodyweight && (
          <p className="text-xs text-muted-foreground">
            Peso corporal: deja Kg vacío (o 0). Solo pon kg si usas lastre.
          </p>
        )}

        <div className="text-xs font-medium text-foreground">
          {counted} de {sets.length} {sets.length === 1 ? 'serie hecha' : 'series hechas'}
        </div>

        <div className="grid grid-cols-[2.5rem_1fr_1fr_1fr_2rem] gap-2 px-0.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          <span>Hecha</span>
          <span>Reps</span>
          <span>{isBodyweight ? 'Kg lastre' : 'Kg'}</span>
          <span>RPE</span>
          <span />
        </div>
      </div>

      {sets.map((s) => {
        const counts = logged.has(setKey(s))
        return (
        <div
          key={s.idx}
          // Sin atenuar la fila sin marcar: la casilla ya dice cuál cuenta, y
          // bajarle el contraste solo dificulta escribir los kilos en ella.
          className="mb-2 grid grid-cols-[2.5rem_1fr_1fr_1fr_2rem] items-center gap-2"
        >
          {/* El número ES la casilla. Un checkbox aparte junto a un número que
              no hace nada obliga a mirar dos veces qué está marcado; así el
              estado y la etiqueta de la fila son la misma cosa. */}
          <button
            type="button"
            role="checkbox"
            aria-checked={counts}
            aria-label={`Serie ${s.set_index} hecha`}
            title={counts ? 'Hecha. Toca para desmarcar' : 'Toca si hiciste esta serie'}
            onClick={() => onToggleLogged(s.idx)}
            className={cn(
              'flex size-7 items-center justify-center rounded-full border text-xs font-semibold transition-colors',
              counts
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-dashed border-muted-foreground/40 text-muted-foreground hover:border-primary hover:text-primary',
            )}
          >
            {counts ? <Check className="size-3.5" /> : s.set_index}
          </button>
          <Input
            type="number"
            inputMode="numeric"
            aria-label={`Serie ${s.set_index} repeticiones`}
            placeholder="reps"
            value={s.reps ?? ''}
            onChange={(e) => onUpdate(s.idx, { reps: Number(e.target.value) })}
          />
          <Input
            type="number"
            inputMode="decimal"
            aria-label={
              isBodyweight
                ? `Serie ${s.set_index} kilos de lastre (opcional)`
                : `Serie ${s.set_index} kilos`
            }
            // Un placeholder numérico («12.5») se lee como un valor ya puesto:
            // se guardaban series a peso nulo creyendo haber anotado los kilos.
            placeholder={isBodyweight ? 'lastre' : 'kg'}
            value={s.weight_kg ?? ''}
            onChange={(e) => onUpdate(s.idx, { weight_kg: Number(e.target.value) })}
          />
          <Input
            type="number"
            inputMode="numeric"
            aria-label={`Serie ${s.set_index} RPE del 1 al 10`}
            placeholder="rpe"
            min="1"
            max="10"
            value={s.rpe ?? ''}
            onChange={(e) => onUpdate(s.idx, { rpe: Number(e.target.value) })}
          />
          {/* Con una sola serie no se ofrece quitarla: para eso está «Quitar»,
              que se lleva el ejercicio entero y deja la sesión coherente. */}
          {sets.length > 1 ? (
            <button
              type="button"
              onClick={() => onRemoveSet(s.set_index)}
              aria-label={`Quitar la serie ${s.set_index}`}
              className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <X className="size-3.5" />
            </button>
          ) : (
            <span />
          )}
        </div>
        )
      })}

      <div className="mt-1 mb-3 flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" className="gap-1.5" onClick={onAddSet}>
          <Plus className="size-3.5" />
          Añadir serie
        </Button>
        {/* El caso normal es cumplir el plan entero. Que eso cueste cuatro
            toques y hacer la mitad cueste dos es al revés de lo que conviene. */}
        {sets.length > 1 && (
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={onToggleAll}>
            <CheckCheck className="size-3.5" />
            {counted === sets.length ? 'Desmarcar todas' : 'Marcar todas'}
          </Button>
        )}
      </div>

      {/* !! evita el clásico "0" fantasma de JSX cuando weight_kg es 0 */}
      {!!last?.reps && !!last?.rpe && (
        <Button
          variant="link"
          size="sm"
          className="mb-3 ml-3 gap-1.5 px-0"
          onClick={() => onSuggestProgression(exerciseId, last.reps!, last.weight_kg || 0, last.rpe!)}
        >
          <TrendingUp />
          Sugerir progresión
        </Button>
      )}

      <ExercisePainPicker
        exerciseId={exerciseId}
        exercise={exercise}
        feedback={feedback}
        onChange={onFeedbackChange}
      />
    </div>
  )
}
