/** Catálogo y cuentas de las tendencias corporales.
 *
 *  La lógica vive aparte de la pantalla porque son dos cosas distintas: qué
 *  métricas existen y cómo se resumen (esto), y cómo se dibujan (`TendenciasTab`).
 *
 *  Los periodos están alineados al calendario, no a «los últimos N días»: es lo
 *  que hace Renpho y es lo que se puede navegar con flechas. Una ventana móvil
 *  no tiene «anterior» que signifique algo.
 */
import type { BodyMetricNumericKey, BodyMetricPoint } from '@/lib/api'
import type { Direction } from '@/lib/bodyMetricFields'
import { addDays, parseISO, startOfWeek, toISO } from '@/lib/dates'

export type TrendRange = 'S' | 'M' | '3M' | 'A' | 'TODO'

export const TREND_RANGES: Array<{ k: TrendRange; label: string }> = [
  { k: 'S', label: 'S' },
  { k: 'M', label: 'M' },
  { k: '3M', label: '3M' },
  { k: 'A', label: 'A' },
  { k: 'TODO', label: 'Todo' },
]

export type TrendPoint = { date: string; value: number }

export type Period = {
  /** ISO inclusivo. `null` en «Todo»: sin recorte. */
  start: string | null
  end: string | null
  label: string
}

const MONTH = new Intl.DateTimeFormat('es', { month: 'short', year: 'numeric' })
const MONTH_ONLY = new Intl.DateTimeFormat('es', { month: 'short' })
const DAY = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' })

function clean(text: string): string {
  return text.replace(/\./g, '')
}

/** Periodo de calendario que contiene a `anchor`, desplazado `offset` periodos
 *  (0 = el actual, -1 = el anterior). */
export function periodFor(range: TrendRange, anchor: string, offset: number): Period {
  if (range === 'TODO') return { start: null, end: null, label: 'Todo el historial' }

  const date = parseISO(anchor)
  const year = date.getFullYear()
  const month = date.getMonth()

  if (range === 'S') {
    const start = addDays(startOfWeek(anchor), offset * 7)
    const end = addDays(start, 6)
    return { start, end, label: `${clean(DAY.format(parseISO(start)))} – ${clean(DAY.format(parseISO(end)))}` }
  }

  if (range === 'M') {
    const start = new Date(year, month + offset, 1)
    const end = new Date(year, month + offset + 1, 0)
    return { start: toISO(start), end: toISO(end), label: clean(MONTH.format(start)) }
  }

  if (range === '3M') {
    const quarter = Math.floor(month / 3) + offset
    const start = new Date(year, quarter * 3, 1)
    const end = new Date(year, quarter * 3 + 3, 0)
    return {
      start: toISO(start),
      end: toISO(end),
      label: `${clean(MONTH_ONLY.format(start))} – ${clean(MONTH.format(end))}`,
    }
  }

  const start = new Date(year + offset, 0, 1)
  const end = new Date(year + offset, 11, 31)
  return { start: toISO(start), end: toISO(end), label: String(year + offset) }
}

/** Lecturas de una métrica dentro del periodo, descartando las que la balanza no
 *  midió. Un hueco no es un cero: interpolar inventaría progreso. */
export function pointsFor(
  history: BodyMetricPoint[],
  key: BodyMetricNumericKey,
  period: Period,
): TrendPoint[] {
  const out: TrendPoint[] = []
  for (const reading of history) {
    if (period.start && reading.date < period.start) continue
    if (period.end && reading.date > period.end) continue
    const value = reading[key]
    if (typeof value !== 'number' || !Number.isFinite(value)) continue
    out.push({ date: reading.date, value })
  }
  return out
}

export type TrendStats = {
  first: TrendPoint
  last: TrendPoint
  min: TrendPoint
  max: TrendPoint
  /** Cambio entre la primera y la última lectura del periodo. */
  change: number
  /** Cambio medio por día o por mes, según el rango. `null` si solo hay una lectura. */
  rate: number | null
  rateLabel: string
  /** Días cubiertos entre la primera y la última lectura. */
  spanDays: number
}

const DAYS_PER_MONTH = 30.44

export function statsFor(points: TrendPoint[], range: TrendRange): TrendStats | null {
  if (!points.length) return null

  const first = points[0]
  const last = points[points.length - 1]
  let min = first
  let max = first
  for (const point of points) {
    if (point.value < min.value) min = point
    if (point.value > max.value) max = point
  }

  const spanDays = Math.round(
    (parseISO(last.date).getTime() - parseISO(first.date).getTime()) / 86_400_000,
  )
  const change = last.value - first.value
  const monthly = range === '3M' || range === 'A' || range === 'TODO'
  const divisor = spanDays > 0 ? (monthly ? spanDays / DAYS_PER_MONTH : spanDays) : 0

  return {
    first,
    last,
    min,
    max,
    change,
    rate: divisor > 0 ? change / divisor : null,
    rateLabel: monthly ? 'Índice mensual' : 'Índice diario',
    spanDays,
  }
}

/** `'good' | 'bad' | 'flat'` según hacia dónde debería moverse la métrica. Un
 *  cambio por debajo del ruido de la balanza se trata como plano. */
export function toneFor(change: number, better: Direction, digits: number): 'good' | 'bad' | 'flat' {
  const noise = digits === 0 ? 0.5 : 10 ** -digits / 2
  if (!better || Math.abs(change) < noise) return 'flat'
  const improving = better === 'up' ? change > 0 : change < 0
  return improving ? 'good' : 'bad'
}

export function formatValue(value: number | null | undefined, digits: number): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return value.toFixed(digits)
}

/** Con signo explícito: en un delta, «0.3» y «+0.3» no se leen igual. */
export function formatChange(value: number | null | undefined, digits: number): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const rounded = value.toFixed(digits)
  return Number(rounded) > 0 ? `+${rounded}` : rounded
}

/** El periodo más reciente con lecturas, buscando hacia atrás desde el actual.
 *  Abrir «S» en una semana sin pesarse mostraría una tarjeta vacía y parecería
 *  que se perdieron los datos. */
export function latestPeriodOffset(
  history: BodyMetricPoint[],
  range: TrendRange,
  anchor: string,
  maxSteps = 36,
): number {
  if (range === 'TODO' || !history.length) return 0
  const oldest = history[0].date
  for (let offset = 0; offset >= -maxSteps; offset -= 1) {
    const period = periodFor(range, anchor, offset)
    if (period.end && period.end < oldest) break
    const hit = history.some(
      (reading) =>
        (!period.start || reading.date >= period.start) && (!period.end || reading.date <= period.end),
    )
    if (hit) return offset
  }
  return 0
}
