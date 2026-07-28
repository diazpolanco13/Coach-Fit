import type { Exercise } from '@/lib/api'
import { muscleES } from '@/lib/muscle'
import {
  JOINT_ZONES,
  PAIN_LEVELS,
  type ExerciseFeedbackMap,
  type PainLevel,
  setZonePain,
} from '@/lib/sessionCheckIn'
import { cn } from '@/lib/utils'

function zonesFor(exercise?: Exercise): { id: string; label: string }[] {
  const seen = new Set<string>()
  const out: { id: string; label: string }[] = []
  const push = (id: string, label: string) => {
    if (seen.has(id)) return
    seen.add(id)
    out.push({ id, label })
  }
  if (exercise?.target) push(exercise.target, muscleES(exercise.target))
  for (const m of exercise?.secondary_muscles ?? []) push(m, muscleES(m))
  for (const z of JOINT_ZONES) push(z.id, z.label)
  return out
}

/** Dolor/molestia al cerrar un ejercicio: músculos del catálogo + zonas fijas. */
export function ExercisePainPicker({
  exerciseId,
  exercise,
  feedback,
  onChange,
}: {
  exerciseId: string
  exercise?: Exercise
  feedback: ExerciseFeedbackMap
  onChange: (next: ExerciseFeedbackMap) => void
}) {
  const zones = zonesFor(exercise)
  const row = feedback[exerciseId] ?? {}

  return (
    <div className="mt-3 space-y-2 rounded-lg border bg-muted/30 p-3">
      <div className="text-sm font-medium">¿Dolor o molestia en este ejercicio?</div>
      <p className="text-[11px] text-muted-foreground">
        Por defecto todo está ok. Marca solo lo que notaste al cerrarlo.
      </p>
      <ul className="space-y-2">
        {zones.map((z) => {
          const current: PainLevel | 'ok' = row[z.id] ?? 'ok'
          return (
            <li
              key={z.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-sm"
            >
              <span className="truncate text-muted-foreground">{z.label}</span>
              <div className="flex gap-1">
                {PAIN_LEVELS.map((lvl) => {
                  const on = current === lvl.id
                  return (
                    <button
                      key={lvl.id}
                      type="button"
                      onClick={() =>
                        onChange(setZonePain(feedback, exerciseId, z.id, lvl.id))
                      }
                      className={cn(
                        'rounded-md border px-2 py-1 text-[11px] transition-colors',
                        on && lvl.id === 'ok' && 'border-emerald-500/40 bg-emerald-500/15 text-emerald-600',
                        on && lvl.id === 'sore' && 'border-amber-500/40 bg-amber-500/15 text-amber-600',
                        on && lvl.id === 'pain' && 'border-red-500/40 bg-red-500/15 text-red-600',
                        !on && 'hover:bg-muted',
                      )}
                    >
                      {lvl.label}
                    </button>
                  )
                })}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
