import { AlertTriangle, Check, Eye, EyeOff, Info, Plus, Star } from 'lucide-react'
import type { Exercise } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MediaImg } from '@/components/MediaImg'
import { DIFFICULTY_ES, exerciseDifficulty, muscleRegionLabel } from '@/lib/anatomy'
import { equipmentES } from '@/lib/equipment'
import { muscleES } from '@/lib/muscle'
import { cn } from '@/lib/utils'

export type CurationState = 'favorito' | 'disponible' | 'oculto'

export function ExerciseResultRow({
  ex,
  added = false,
  favorite = false,
  overloadedMax,
  disabled = false,
  curation,
  onAdd,
  onToggleFavorite,
  onOpenGuide,
}: {
  ex: Exercise
  added?: boolean
  favorite?: boolean
  /** Tope del músculo objetivo si ya está saturado; `null` si no lo está. Se
   *  avisa, no se bloquea: es una guía, no una cárcel. */
  overloadedMax: number | null
  disabled?: boolean
  /** Cuando está presente, la fila pasa a modo curación: el botón de añadir se
   *  sustituye por los toggles de favorito y oculto. Es una rama corta dentro de
   *  este componente a propósito — un cuarto componente de fila es como esta UI
   *  llegó a sentirse caótica. */
  curation?: { state: CurationState; onChange: (state: CurationState) => void }
  onAdd?: (ex: Exercise) => void
  /** Estrella tocable junto a Añadir (biblioteca del plan). No hace falta en
   *  modo curación: ahí ya va el toggle de favorito. */
  onToggleFavorite?: () => void
  onOpenGuide: (ex: Exercise) => void
}) {
  const hidden = curation?.state === 'oculto'
  const isFavorite = curation ? curation.state === 'favorito' : favorite
  const showFavoriteBtn = Boolean(curation || onToggleFavorite)

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-lg border border-transparent p-1.5 transition-colors hover:border-border hover:bg-muted/60',
        hidden && 'opacity-50',
      )}
    >
      <button
        type="button"
        onClick={() => onOpenGuide(ex)}
        aria-label={`Ver guía de ${ex.name_es}`}
        className="size-11 shrink-0 overflow-hidden rounded-md border bg-white"
      >
        <MediaImg image={ex.image} gif={ex.gif} alt={ex.name_es} className="h-full w-full object-contain" />
      </button>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{ex.name_es}</span>
        <span className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
          <span className="truncate">
            {muscleRegionLabel(muscleES(ex.target), ex.target_region)} · {equipmentES(ex.equipment)}
          </span>
          {ex.difficulty != null && (
            <Badge variant="outline" className="h-4 shrink-0 px-1 text-[10px] font-normal">
              {DIFFICULTY_ES[exerciseDifficulty(ex)]}
            </Badge>
          )}
        </span>
        {overloadedMax != null && !added && (
          <span className="mt-0.5 flex items-center gap-1 text-xs text-destructive">
            <AlertTriangle className="size-3 shrink-0" />
            {muscleES(ex.target)} ya llega a {overloadedMax} series esta semana
          </span>
        )}
      </span>

      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Ver guía de ${ex.name_es}`}
        className="shrink-0 text-muted-foreground"
        onClick={() => onOpenGuide(ex)}
      >
        <Info />
      </Button>

      {showFavoriteBtn && (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={
            isFavorite ? `Quitar de favoritos ${ex.name_es}` : `Marcar ${ex.name_es} como favorito`
          }
          aria-pressed={isFavorite}
          className={isFavorite ? 'shrink-0 text-amber-500' : 'shrink-0 text-muted-foreground'}
          onClick={() =>
            curation
              ? curation.onChange(isFavorite ? 'disponible' : 'favorito')
              : onToggleFavorite?.()
          }
        >
          <Star className={isFavorite ? 'fill-amber-500' : undefined} />
        </Button>
      )}

      {curation ? (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={hidden ? `Volver a mostrar ${ex.name_es}` : `Ocultar ${ex.name_es}`}
          aria-pressed={hidden}
          className="shrink-0 text-muted-foreground"
          onClick={() => curation.onChange(hidden ? 'disponible' : 'oculto')}
        >
          {hidden ? <Eye /> : <EyeOff />}
        </Button>
      ) : added ? (
        <Badge variant="brand" className="shrink-0">
          <Check className="size-3" /> Añadido
        </Badge>
      ) : (
        <Button
          size="icon-sm"
          aria-label={`Añadir ${ex.name_es}`}
          disabled={disabled}
          className="shrink-0"
          onClick={() => onAdd?.(ex)}
        >
          <Plus />
        </Button>
      )}
    </div>
  )
}
