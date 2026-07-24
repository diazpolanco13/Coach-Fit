import type { Exercise } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { MediaImg } from '@/components/MediaImg'
import { muscleES } from '@/lib/muscle'

export function ExerciseRow({ ex, onOpen }: { ex: Exercise; onOpen: (ex: Exercise) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(ex)}
      className="flex w-full items-center gap-3 border-b border-border py-2 text-left last:border-b-0 hover:bg-muted/50"
    >
      <MediaImg
        image={ex.image}
        gif={ex.gif}
        alt={ex.name_es}
        className="size-11 shrink-0 rounded border bg-white object-contain"
      />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{ex.name_es}</div>
        <div className="truncate text-xs text-muted-foreground">
          {muscleES(ex.target)} · {ex.equipment}
        </div>
      </div>
      <Badge variant={ex.role === 'push' ? 'brand' : 'outline'}>{ex.role}</Badge>
    </button>
  )
}
