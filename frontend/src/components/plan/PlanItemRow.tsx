import type { DragEvent, ReactNode } from 'react'
import { ArrowDown, ArrowUp, GripVertical, X } from 'lucide-react'
import type { PlanItem } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MediaImg } from '@/components/MediaImg'
import {
  CARDIO_KINDS,
  CARDIO_SURFACES,
  defaultSessionType,
  formatCardioPrescription,
  isEnduranceCardioItem,
  sessionTypesFor,
  type CardioKind,
} from '@/lib/cardio'
import { equipmentES } from '@/lib/equipment'
import { muscleES } from '@/lib/muscle'
import { MAX_SETS, MIN_SETS } from '@/lib/plan'
import type { DayOrderConflict } from '@/lib/sessionSafety'
import { cn } from '@/lib/utils'

/** Un número editable de la prescripción. El valor se deja pasar tal cual al
 *  teclear —si se normalizara aquí no podrías borrarlo para reescribirlo— y se
 *  recorta al salir del campo. */
function NumField({
  value,
  label,
  min,
  max,
  step = 1,
  onChange,
  onCommit,
}: {
  value: number
  label: string
  min: number
  max: number
  step?: number
  onChange: (n: number) => void
  onCommit: () => void
}) {
  return (
    <Input
      type="number"
      inputMode="decimal"
      min={min}
      max={max}
      step={step}
      aria-label={label}
      value={Number.isFinite(value) ? value : ''}
      onChange={(e) => onChange(Number(e.target.value))}
      onBlur={onCommit}
      className="h-8 w-14 px-1 text-center tabular-nums"
    />
  )
}

function ChipGroup({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <div className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}

function prescription(item: PlanItem): string {
  if (isEnduranceCardioItem(item)) return formatCardioPrescription(item)
  if (item.rep_min === item.rep_max) return `${item.sets} × ${item.rep_min}`
  return `${item.sets} × ${item.rep_min}–${item.rep_max}`
}

export function PlanItemRow({
  item,
  index,
  count,
  editing,
  compact = false,
  onPatch,
  onCommit,
  onMove,
  onRemove,
  onOpenGuide,
  onDragStart,
  onDragEnd,
  dragging = false,
  safetyConflict,
}: {
  item: PlanItem
  index: number
  count: number
  editing: boolean
  /** Vista densas del plan (sin inputs): menos padding y thumb más chico. */
  compact?: boolean
  onPatch: (patch: Partial<PlanItem>) => void
  onCommit: () => void
  onMove: (dir: -1 | 1) => void
  onRemove: () => void
  onOpenGuide: () => void
  onDragStart?: () => void
  onDragEnd?: () => void
  dragging?: boolean
  safetyConflict?: DayOrderConflict
}) {
  const ex = item.exercise
  const name = ex?.name_es || item.exercise_id
  const cardio = isEnduranceCardioItem(item)
  const kind = (item.cardio_kind ?? 'carrera_libre') as CardioKind
  const handleDragStart = (event: DragEvent<HTMLSpanElement>) => {
    if (!editing) return
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', item.exercise_id)
    onDragStart?.()
  }

  const moveRemove = editing ? (
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
  ) : null

  // Cardio en edición: tarjeta propia con bloques etiquetados, para no
  // confundirse con el panel de estímulo ni con los botones del día.
  if (editing && cardio) {
    return (
      <div
        className={cn(
          'rounded-xl border border-border bg-muted/20 p-3 transition-opacity',
          dragging && 'opacity-45',
        )}
      >
        <div className="flex items-start gap-2">
          <span
            draggable
            onDragStart={handleDragStart}
            onDragEnd={onDragEnd}
            className="mt-1 flex size-6 shrink-0 cursor-grab items-center justify-center text-muted-foreground active:cursor-grabbing"
            title="Arrastrar a otro día"
          >
            <GripVertical className="size-4" />
          </span>
          <button
            type="button"
            onClick={onOpenGuide}
            aria-label={`Ver guía de ${name}`}
            className="size-9 shrink-0 overflow-hidden rounded border bg-white"
          >
            {ex && (
              <MediaImg
                image={ex.image}
                gif={ex.gif}
                alt={name}
                className="h-full w-full object-contain"
              />
            )}
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{name}</div>
            <div className="truncate text-xs text-muted-foreground">
              {formatCardioPrescription(item)}
            </div>
          </div>
          {moveRemove}
        </div>

        <div className="mt-3 space-y-3 border-t border-border/80 pt-3">
          <ChipGroup label="Tipo">
            {CARDIO_KINDS.map((k) => (
              <Button
                key={k.id}
                type="button"
                size="sm"
                variant={kind === k.id ? 'default' : 'outline'}
                onClick={() =>
                  onPatch({
                    cardio_kind: k.id,
                    session_type: defaultSessionType(k.id),
                  })
                }
              >
                {k.label}
              </Button>
            ))}
          </ChipGroup>

          {kind !== 'hiit' && (
            <ChipGroup label="Intención">
              {sessionTypesFor(kind).map((s) => (
                <Button
                  key={s.id}
                  type="button"
                  size="sm"
                  variant={item.session_type === s.id ? 'default' : 'outline'}
                  onClick={() => onPatch({ session_type: s.id })}
                >
                  {s.label}
                </Button>
              ))}
            </ChipGroup>
          )}

          <ChipGroup label="Dónde">
            {CARDIO_SURFACES.map((s) => (
              <Button
                key={s.id}
                type="button"
                size="sm"
                variant={item.cardio_surface === s.id ? 'default' : 'outline'}
                onClick={() => onPatch({ cardio_surface: s.id })}
              >
                {s.label}
              </Button>
            ))}
          </ChipGroup>

          <div className="space-y-1.5">
            <div className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              Objetivo (opcional)
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <NumField
                value={item.target_km ?? 0}
                label={`Km objetivo de ${name}`}
                min={0}
                max={200}
                step={0.1}
                onChange={(target_km) => onPatch({ target_km: target_km || null })}
                onCommit={onCommit}
              />
              <span>km</span>
              <NumField
                value={item.target_min ?? 0}
                label={`Minutos objetivo de ${name}`}
                min={0}
                max={600}
                onChange={(target_min) => onPatch({ target_min: target_min || null })}
                onCommit={onCommit}
              />
              <span>min</span>
            </div>
          </div>
        </div>

        {safetyConflict && (
          <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
            {safetyConflict.message} {safetyConflict.suggestion}
          </p>
        )}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 rounded-lg transition-opacity',
        compact ? 'px-1 py-0.5' : 'p-1.5',
        editing ? 'border' : 'hover:bg-muted/40',
        dragging && 'opacity-45',
      )}
    >
      {editing && (
        <span
          draggable
          onDragStart={handleDragStart}
          onDragEnd={onDragEnd}
          className="flex size-6 shrink-0 cursor-grab items-center justify-center text-muted-foreground active:cursor-grabbing"
          title="Arrastrar a otro día"
        >
          <GripVertical className="size-4" />
        </span>
      )}
      <button
        type="button"
        onClick={onOpenGuide}
        aria-label={`Ver guía de ${name}`}
        className={cn(
          'shrink-0 overflow-hidden rounded border bg-white',
          compact ? 'size-8' : 'size-9',
        )}
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
          <div className="order-last flex w-full items-center gap-1.5 pl-[4.25rem] text-xs text-muted-foreground sm:order-none sm:ml-auto sm:w-auto sm:pl-0">
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
          {moveRemove}
        </>
      ) : (
        <span className="shrink-0 text-sm font-medium tabular-nums text-foreground">
          {prescription(item)}
        </span>
      )}

      {editing && safetyConflict && (
        <p className="order-last w-full pl-[4.25rem] text-xs text-amber-700 dark:text-amber-400">
          {safetyConflict.message} {safetyConflict.suggestion}
        </p>
      )}
    </div>
  )
}
