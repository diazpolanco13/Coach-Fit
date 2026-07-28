import { CompactScaleBar } from '@/components/session/CompactScaleBar'

function rpeLabel(value: number): string {
  if (value <= 3) return `${value} fácil`
  if (value <= 6) return `${value} mod.`
  if (value <= 8) return `${value} duro`
  return `${value} límite`
}

/** RPE 1–10 en una sola fila compacta. */
export function RpeSessionBar({
  value,
  onChange,
}: {
  value: number
  onChange: (n: number) => void
}) {
  return (
    <CompactScaleBar
      id="session-rpe"
      label="RPE"
      value={value - 1}
      max={9}
      valueLabel={rpeLabel(value)}
      onChange={(i) => onChange(i + 1)}
      tone="effort"
    />
  )
}
