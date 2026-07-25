import { ArrowDown, ArrowUp, X } from 'lucide-react'
import type { PlanItem } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MediaImg } from '@/components/MediaImg'
import { equipmentES } from '@/lib/equipment'
import { muscleES } from '@/lib/muscle'
import { MAX_SETS, MIN_SETS } from '@/lib/plan'
import { cn } from '@/lib/utils'

/** Un número editable de la prescripción. El valor se deja pasar tal cual al
 *  teclear —si se normalizara aquí no podrías borrarlo para reescribirlo— y se
 *  recorta al salir del campo. */
function NumField({
  value,
  label,
  min,
  max,
  onChange,
  onCommit,
}: {
  value: number
  label: string
  min: number
  max: number
  onChange: (n: number) => void
  onCommit: () => void
}) {
  return (
    <Input
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      aria-label={label}
      value={Number.isFinite(value) ? value : ''}
      onChange={(e) => onChange(Number(e.target.value))}
      onBlur={onCommit}
      className="h-8 w-12 px-1 text-center tabular-nums"
    />
  )
}

function prescription(item: PlanItem): string {
  if (item.rep_min === item.rep_max) return `${item.sets} × ${item.rep_min}`
  return `${item.sets} × ${item.rep_min}–${item.rep_max}`
}

export function PlanItemRow({
  item,
  index,
  count,
  editing,
  onPatch,
  onCommit,
  onMove,
  onRemove,
  onOpenGuide,
}: {
  item: PlanItem
  index: number
  count: number
  editing: boolean
  onPatch: (patch: Partial<PlanItem>) => void
  onCommit: () => void
  onMove: (dir: -1 | 1) => void
  onRemove: () => void
  onOpenGuide: () => void
}) {
  const ex = item.exercise
  const name = ex?.name_es || item.exercise_id

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 rounded-lg p-1.5',
        editing ? 'border' : 'hover:bg-muted/40',
      )}
    >
      <button
        type="button"
        onClick={onOpenGuide}
        aria-label={`Ver guía de ${name}`}
        className="size-9 shrink-0 overflow-hidden rounded border bg-white"
      >
        {ex && (
          <MediaImg image={ex.image} gif={ex.gif} alt={name} className="h-full w-full object-contain" />
        )}
      </button>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{name}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {ex ? `${muscleES(ex.target)} · ${equipmentES(ex.equipment)}` : 'Ya no está en el catálogo'}
        </span>
      </span>

      {editing ? (
        <>
          {/* En móvil los números bajan a su propia línea; en pantalla ancha van
              pegados a los botones de orden. */}
          <div className="order-last flex w-full items-center gap-1.5 pl-11 text-xs text-muted-foreground sm:order-none sm:ml-auto sm:w-auto sm:pl-0">
            <NumField
              value={item.sets}
              label={`Series de ${name}`}
              min={MIN_SETS}
              max={MAX_SETS}
              onChange={(sets) => onPatch({ sets })}
              onCommit={onCommit}
            />
            <span>series</span>
            <NumField
              value={item.rep_min}
              label={`Repeticiones mínimas de ${name}`}
              min={1}
              max={100}
              onChange={(rep_min) => onPatch({ rep_min })}
              onCommit={onCommit}
            />
            <span aria-hidden>–</span>
            <NumField
              value={item.rep_max}
              label={`Repeticiones máximas de ${name}`}
              min={1}
              max={100}
              onChange={(rep_max) => onPatch({ rep_max })}
              onCommit={onCommit}
            />
            <span>reps</span>
          </div>

          <div className="flex shrink-0 items-center">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Subir ${name}`}
              disabled={index === 0}
              onClick={() => onMove(-1)}
            >
              <ArrowUp />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Bajar ${name}`}
              disabled={index === count - 1}
              onClick={() => onMove(1)}
            >
              <ArrowDown />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Quitar ${name}`}
              className="text-muted-foreground hover:text-destructive"
              onClick={onRemove}
            >
              <X />
            </Button>
          </div>
        </>
      ) : (
        <span className="shrink-0 text-sm font-medium tabular-nums text-foreground">
          {prescription(item)}
        </span>
      )}
    </div>
  )
}
