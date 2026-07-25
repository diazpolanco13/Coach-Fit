import { AlertTriangle, Check, Eye, EyeOff, Info, Plus, Star } from 'lucide-react'
import type { Exercise } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MediaImg } from '@/components/MediaImg'
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
  onOpenGuide: (ex: Exercise) => void
}) {
  const hidden = curation?.state === 'oculto'
  const isFavorite = curation ? curation.state === 'favorito' : favorite

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
        <span className="flex items-center gap-1 truncate text-sm font-medium">
          {isFavorite && (
            <Star className="size-3 shrink-0 fill-amber-500 text-amber-500" aria-label="Favorito" />
          )}
          <span className="truncate">{ex.name_es}</span>
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {muscleES(ex.target)} · {equipmentES(ex.equipment)}
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

      {curation ? (
        <div className="flex shrink-0 items-center">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={isFavorite ? `Quitar de favoritos ${ex.name_es}` : `Marcar ${ex.name_es} como favorito`}
            aria-pressed={isFavorite}
            className={isFavorite ? 'text-amber-500' : 'text-muted-foreground'}
            onClick={() => curation.onChange(isFavorite ? 'disponible' : 'favorito')}
          >
            <Star className={isFavorite ? 'fill-amber-500' : undefined} />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={hidden ? `Volver a mostrar ${ex.name_es}` : `Ocultar ${ex.name_es}`}
            aria-pressed={hidden}
            className="text-muted-foreground"
            onClick={() => curation.onChange(hidden ? 'disponible' : 'oculto')}
          >
            {hidden ? <Eye /> : <EyeOff />}
          </Button>
        </div>
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
