import { Star } from 'lucide-react'
import type { Exercise } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MediaImg } from '@/components/MediaImg'
import { equipmentES } from '@/lib/equipment'
import { cn } from '@/lib/utils'

export function ExerciseCard({
  ex,
  favorite = false,
  onOpen,
  onToggleFavorite,
}: {
  ex: Exercise
  favorite?: boolean
  onOpen: (ex: Exercise) => void
  onToggleFavorite?: () => void
}) {
  return (
    <div className="group overflow-hidden rounded-xl border bg-card text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative">
        <button
          type="button"
          onClick={() => onOpen(ex)}
          className="w-full text-left"
        >
          <div className="aspect-square bg-muted/40">
            <MediaImg
              image={ex.image}
              gif={ex.gif}
              alt={ex.name_es}
              className="h-full w-full object-contain p-2"
            />
          </div>
        </button>
        {onToggleFavorite && (
          <Button
            type="button"
            variant="secondary"
            size="icon-sm"
            className={cn(
              'absolute top-2 right-2 z-10 size-8 border border-border/80 shadow-sm',
              favorite ? 'text-amber-500' : 'text-muted-foreground',
            )}
            aria-label={
              favorite ? `Quitar de favoritos ${ex.name_es}` : `Marcar ${ex.name_es} como favorito`
            }
            aria-pressed={favorite}
            onClick={onToggleFavorite}
          >
            <Star className={favorite ? 'fill-amber-500' : undefined} />
          </Button>
        )}
      </div>
      <button type="button" onClick={() => onOpen(ex)} className="w-full space-y-2 p-3 text-left">
        <div className="line-clamp-2 text-sm font-medium text-foreground">{ex.name_es}</div>
        <div className="flex flex-wrap gap-1">
          <Badge variant="secondary">{ex.role}</Badge>
          <Badge variant="outline">{equipmentES(ex.equipment)}</Badge>
        </div>
      </button>
    </div>
  )
}
