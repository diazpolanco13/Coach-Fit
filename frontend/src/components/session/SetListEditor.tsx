import { ArrowLeft, Plus, Trash2, TrendingUp, X } from 'lucide-react'
import type { Exercise, PlanItem, SessionSet } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { muscleES } from '@/lib/muscle'

/** Serie del borrador con su posición en el array plano de la sesión. */
export type DraftSet = SessionSet & { idx: number }

/** Editor de las series de UN ejercicio dentro de la sesión.
 *
 *  Arranca en una sola fila y crece con «Añadir serie», en vez de sembrar las
 *  que el plan prescribe: el registro cuenta lo que pasó, y hacer 2 de las 3
 *  previstas es normal. La prescripción no se pierde, se muestra como contexto.
 */
export function SetListEditor({
  exerciseId,
  exercise,
  planItem,
  sets,
  onUpdate,
  onAddSet,
  onRemoveSet,
  onRemoveExercise,
  onBack,
  onOpenGuide,
  onSuggestProgression,
}: {
  exerciseId: string
  exercise?: Exercise
  /** Lo que el plan pide para este ejercicio hoy, si es que lo pide. */
  planItem?: PlanItem
  sets: DraftSet[]
  onUpdate: (idx: number, patch: Partial<SessionSet>) => void
  onAddSet: () => void
  onRemoveSet: (setIndex: number) => void
  onRemoveExercise: () => void
  onBack: () => void
  onOpenGuide: (ex: Exercise) => void
  onSuggestProgression: (exerciseId: string, reps: number, weightKg: number, rpe: number) => void
}) {
  const isBodyweight = exercise?.equipment === 'body weight'
  const last = sets[sets.length - 1]

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
          Quitar
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
            . Registra solo las que hiciste.
          </p>
        )}
        {isBodyweight && (
          <p className="text-xs text-muted-foreground">
            Peso corporal: deja Kg vacío (o 0). Solo pon kg si usas lastre.
          </p>
        )}

        <div className="grid grid-cols-[2.5rem_1fr_1fr_1fr_2rem] gap-2 px-0.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          <span>Serie</span>
          <span>Reps</span>
          <span>{isBodyweight ? 'Kg lastre' : 'Kg'}</span>
          <span>RPE</span>
          <span />
        </div>
      </div>

      {sets.map((s) => (
        <div key={s.idx} className="mb-2 grid grid-cols-[2.5rem_1fr_1fr_1fr_2rem] items-center gap-2">
          <div className="text-xs text-muted-foreground">{s.set_index}</div>
          <Input
            type="number"
            inputMode="numeric"
            aria-label={`Serie ${s.set_index} repeticiones`}
            placeholder="10"
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
            placeholder={isBodyweight ? '0' : '12.5'}
            value={s.weight_kg ?? ''}
            onChange={(e) => onUpdate(s.idx, { weight_kg: Number(e.target.value) })}
          />
          <Input
            type="number"
            inputMode="numeric"
            aria-label={`Serie ${s.set_index} RPE del 1 al 10`}
            placeholder="7"
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
      ))}

      <Button variant="outline" size="sm" className="mt-1 mb-3 gap-1.5" onClick={onAddSet}>
        <Plus className="size-3.5" />
        Añadir serie
      </Button>

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
    </div>
  )
}
