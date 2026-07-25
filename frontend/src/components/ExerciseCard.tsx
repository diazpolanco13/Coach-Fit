import type { Exercise } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { MediaImg } from '@/components/MediaImg'
import { equipmentES } from '@/lib/equipment'

export function ExerciseCard({
  ex,
  onOpen,
}: {
  ex: Exercise
  onOpen: (ex: Exercise) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(ex)}
      className="group overflow-hidden rounded-xl border bg-card text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="aspect-square bg-muted/40">
        <MediaImg
          image={ex.image}
          gif={ex.gif}
          alt={ex.name_es}
          className="h-full w-full object-contain p-2"
        />
      </div>
      <div className="space-y-2 p-3">
        <div className="line-clamp-2 text-sm font-medium text-foreground">{ex.name_es}</div>
        <div className="flex flex-wrap gap-1">
          <Badge variant="secondary">{ex.role}</Badge>
          <Badge variant="outline">{equipmentES(ex.equipment)}</Badge>
        </div>
      </div>
    </button>
  )
}
