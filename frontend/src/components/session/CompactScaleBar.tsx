import { cn } from '@/lib/utils'
import { effortTone, scaleTone } from '@/lib/sessionCheckIn'

/** Fila compacta: etiqueta | barra | valor. Una línea de alto. */
export function CompactScaleBar({
  id,
  label,
  value,
  max,
  valueLabel,
  onChange,
  /** `risk` = bien a la derecha (default); deslizar izq = empeora.
   *  `effort` = RPE, más a la derecha = más esfuerzo (positivo). */
  tone = 'risk',
}: {
  id: string
  label: string
  value: number
  max: number
  valueLabel: string
  onChange: (n: number) => void
  tone?: 'risk' | 'effort'
}) {
  // Riesgo: índice 0 (bien) se pinta a la derecha. Esfuerzo: crece a la derecha.
  const visual = tone === 'risk' ? max - value : value
  const colors = (tone === 'effort' ? effortTone : scaleTone)(value, max)
  const pct = max <= 0 ? 0 : (visual / max) * 100

  return (
    <div className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-2">
      <label htmlFor={id} className="truncate text-xs text-muted-foreground">
        {label}
      </label>
      <div className="relative h-2 rounded-full bg-muted">
        <div
          className={cn('absolute inset-y-0 left-0 rounded-full transition-[width]', colors.bar)}
          style={{ width: `${Math.max(pct, visual === 0 ? 8 : pct)}%` }}
        />
        <input
          id={id}
          type="range"
          min={0}
          max={max}
          step={1}
          value={visual}
          onChange={(e) => {
            const v = Number(e.target.value)
            onChange(tone === 'risk' ? max - v : v)
          }}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-valuemin={0}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-valuetext={valueLabel}
        />
        <span
          aria-hidden
          className={cn(
            'pointer-events-none absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background shadow',
            colors.bar,
          )}
          style={{ left: `${pct}%` }}
        />
      </div>
      <span className={cn('min-w-[4.5rem] text-right text-xs font-medium tabular-nums', colors.text)}>
        {valueLabel}
      </span>
    </div>
  )
}
