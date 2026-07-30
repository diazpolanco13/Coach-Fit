import { useState } from 'react'
import type { Exercise } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { ExercisePainPicker } from '@/components/session/ExercisePainPicker'
import {
  SKIP_REASONS,
  type ExerciseFeedbackMap,
  type SkipReason,
} from '@/lib/sessionCheckIn'
import { cn } from '@/lib/utils'

/** Flujo corto: elegir por qué no se hace el ejercicio y, si es dolor, la zona. */
export function SkipExercisePanel({
  exerciseId,
  exercise,
  feedback,
  onFeedbackChange,
  onConfirm,
  onCancel,
}: {
  exerciseId: string
  exercise?: Exercise
  feedback: ExerciseFeedbackMap
  onFeedbackChange: (next: ExerciseFeedbackMap) => void
  onConfirm: (reason: SkipReason) => void
  onCancel: () => void
}) {
  const [reason, setReason] = useState<SkipReason | null>(null)
  const needsPain = reason === 'pain'
  const hasPain = Boolean(feedback[exerciseId] && Object.keys(feedback[exerciseId]!).length)
  const canConfirm = reason != null && (!needsPain || hasPain)

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <div>
        <div className="text-sm font-semibold">¿Por qué lo omites?</div>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          El día puede cerrarse igual. Queda registrado para no pedirlo como pendiente.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {SKIP_REASONS.map((r) => {
          const on = reason === r.id
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => setReason(r.id)}
              className={cn(
                'rounded-lg border px-3 py-2 text-left transition-colors',
                on ? 'border-primary bg-primary/10' : 'hover:bg-muted/50',
              )}
            >
              <span className="block text-sm font-medium">{r.label}</span>
              <span className="block text-[11px] text-muted-foreground">{r.hint}</span>
            </button>
          )
        })}
      </div>

      {needsPain && (
        <ExercisePainPicker
          exerciseId={exerciseId}
          exercise={exercise}
          feedback={feedback}
          onChange={onFeedbackChange}
        />
      )}

      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onCancel}>
          Volver
        </Button>
        <Button
          className="flex-1"
          disabled={!canConfirm}
          onClick={() => reason && onConfirm(reason)}
        >
          Omitir y seguir
        </Button>
      </div>
    </div>
  )
}
