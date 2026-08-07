import type { Exercise } from '@/lib/api'
import { MediaImg } from '@/components/MediaImg'
import { MuscleMetaLine } from '@/components/MuscleMetaLine'
import { equipmentES } from '@/lib/equipment'
import { involvedMuscles } from '@/lib/muscle'
import { Ban, CheckCircle2, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ExerciseRow({
  ex,
  onOpen,
  suffix,
  done,
  skipped,
  note,
  interactive = true,
}: {
  ex: Exercise
  onOpen: (ex: Exercise) => void
  /** Prescripción del plan o resultado hecho, p.ej. «3×8–12» / «4×12 @ 20 kg». */
  suffix?: string
  /** Serie(s) registradas: el círculo se rellena. Sin ellas queda vacío —
   *  mismo hueco, mismo componente, solo cambia el estado. */
  done?: boolean
  /** Omitido a propósito (dolor, fatiga…): no es pendiente. */
  skipped?: boolean
  /** Indicación del plan para ese ejercicio («deja 1–2 reps en reserva»). */
  note?: string | null
  /** Si false, es solo visual (p. ej. dentro del modo reordenar). */
  interactive?: boolean
}) {
  const muscles = involvedMuscles(ex)
  const body = (
    <>
      <MediaImg
        image={ex.image}
        gif={ex.gif}
        alt={ex.name_es}
        className="size-11 shrink-0 rounded border bg-white object-contain"
      />
      <div className="min-w-0 flex-1">
        <div className={cn('truncate text-sm font-medium', done && 'text-foreground')}>
          {ex.name_es}
        </div>
        <MuscleMetaLine
          muscles={muscles}
          trailing={[equipmentES(ex.equipment), suffix]}
          muted={skipped}
          className="block text-xs"
        />
        {note && <div className="truncate text-xs text-muted-foreground/80 italic">{note}</div>}
      </div>
      {done ? (
        <CheckCircle2 className="size-5 shrink-0 text-primary" aria-label="Hecho" />
      ) : skipped ? (
        <Ban className="size-5 shrink-0 text-amber-500" aria-label="Omitido" />
      ) : (
        <Circle className="size-5 shrink-0 text-muted-foreground/40" aria-label="Pendiente" />
      )}
    </>
  )

  if (!interactive) {
    return <div className="flex w-full items-center gap-3 py-2 text-left">{body}</div>
  }

  return (
    <button
      type="button"
      onClick={() => onOpen(ex)}
      className="flex w-full items-center gap-3 border-b border-border py-2 text-left last:border-b-0 hover:bg-muted/50"
    >
      {body}
    </button>
  )
}
