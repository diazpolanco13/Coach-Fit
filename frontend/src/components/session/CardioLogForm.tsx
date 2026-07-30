import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  CARDIO_KINDS,
  CARDIO_NOTES_MAX,
  CARDIO_SURFACES,
  defaultSessionType,
  sessionTypesFor,
  type CardioKind,
  type CardioSessionType,
  type CardioSurface,
} from '@/lib/cardio'

export type CardioLogValues = {
  kind: CardioKind
  surface: CardioSurface
  session_type: CardioSessionType
  distance_km: string
  duration_min: string
  rpe: number | null
  notes: string
}

export function emptyCardioLog(defaults?: Partial<CardioLogValues>): CardioLogValues {
  const kind = defaults?.kind ?? 'carrera_libre'
  return {
    kind,
    surface: defaults?.surface ?? 'aire_libre',
    session_type: defaults?.session_type ?? defaultSessionType(kind),
    distance_km: defaults?.distance_km ?? '',
    duration_min: defaults?.duration_min ?? '',
    rpe: defaults?.rpe ?? null,
    notes: defaults?.notes ?? '',
  }
}

/** Formulario reutilizable: plan/sesión/CardioTab. */
export function CardioLogForm({
  value,
  onChange,
  onSubmit,
  submitLabel = 'Guardar',
  disabled,
}: {
  value: CardioLogValues
  onChange: (next: CardioLogValues) => void
  onSubmit: () => void
  submitLabel?: string
  disabled?: boolean
}) {
  const sessionOptions = sessionTypesFor(value.kind)
  const showSessionChips = value.kind !== 'hiit'
  const canSave =
    Boolean(value.distance_km && value.duration_min) &&
    Number(value.distance_km) > 0 &&
    Number(value.duration_min) > 0

  const setKind = (kind: CardioKind) =>
    onChange({ ...value, kind, session_type: defaultSessionType(kind) })

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <div className="text-xs text-muted-foreground">Tipo</div>
        <div className="flex flex-wrap gap-2">
          {CARDIO_KINDS.map((k) => (
            <Button
              key={k.id}
              type="button"
              size="sm"
              variant={value.kind === k.id ? 'default' : 'outline'}
              onClick={() => setKind(k.id)}
            >
              {k.label}
            </Button>
          ))}
        </div>
      </div>

      {showSessionChips && (
        <div className="space-y-1.5">
          <div className="text-xs text-muted-foreground">Intención</div>
          <div className="flex flex-wrap gap-2">
            {sessionOptions.map((s) => (
              <Button
                key={s.id}
                type="button"
                size="sm"
                variant={value.session_type === s.id ? 'default' : 'outline'}
                onClick={() => onChange({ ...value, session_type: s.id })}
              >
                {s.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <div className="text-xs text-muted-foreground">Dónde</div>
        <div className="flex flex-wrap gap-2">
          {CARDIO_SURFACES.map((s) => (
            <Button
              key={s.id}
              type="button"
              size="sm"
              variant={value.surface === s.id ? 'default' : 'outline'}
              onClick={() => onChange({ ...value, surface: s.id })}
            >
              {s.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Input
          type="number"
          step="0.1"
          min="0"
          placeholder="km"
          value={value.distance_km}
          onChange={(e) => onChange({ ...value, distance_km: e.target.value })}
        />
        <Input
          type="number"
          step="1"
          min="0"
          placeholder="min"
          value={value.duration_min}
          onChange={(e) => onChange({ ...value, duration_min: e.target.value })}
        />
      </div>

      <div className="space-y-1.5">
        <div className="text-xs text-muted-foreground">RPE (opcional)</div>
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <Button
              key={n}
              type="button"
              size="sm"
              className="min-w-8 px-2"
              variant={value.rpe === n ? 'default' : 'outline'}
              onClick={() => onChange({ ...value, rpe: value.rpe === n ? null : n })}
            >
              {n}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Notas (opcional)</span>
          <span>
            {value.notes.length}/{CARDIO_NOTES_MAX}
          </span>
        </div>
        <Textarea
          value={value.notes}
          maxLength={CARDIO_NOTES_MAX}
          rows={2}
          placeholder="Cómo te sentiste, terreno, clima…"
          onChange={(e) => onChange({ ...value, notes: e.target.value.slice(0, CARDIO_NOTES_MAX) })}
        />
      </div>

      <Button disabled={disabled || !canSave} onClick={onSubmit}>
        {submitLabel}
      </Button>
    </div>
  )
}
