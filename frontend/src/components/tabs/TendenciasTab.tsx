import { useMemo } from 'react'
import { ChartSpline, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { BodyMetricPoint } from '@/lib/api'
import { withEstimatedBmi } from '@/lib/bmi'
import { BODY_FIELD_GROUPS, type BodyField } from '@/lib/bodyMetricFields'
import {
  formatChange,
  formatValue,
  pointsFor,
  statsFor,
  toneFor,
  TREND_RANGES,
  type Period,
  type TrendRange,
} from '@/lib/bodyTrends'
import { longLabel, shortLabel } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { useBodyTrends } from '@/hooks/useBodyTrends'
import { TendenciasSkeleton } from '@/components/skeletons/TendenciasSkeleton'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const chartTooltipStyle = {
  backgroundColor: 'var(--popover)',
  color: 'var(--popover-foreground)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  fontSize: '12px',
}
const chartTick = { fontSize: 11, fill: 'var(--muted-foreground)' }

const TONE_CLASS = {
  good: 'text-emerald-600 dark:text-emerald-400',
  bad: 'text-rose-600 dark:text-rose-400',
  flat: 'text-muted-foreground',
} as const

/** Eje Y ajustado a los datos, no a cero. Un peso que va de 74 a 78 kg sobre un
 *  eje que arranca en cero es una raya plana: el margen del 12 % deja ver el
 *  movimiento sin exagerar el ruido de la balanza. */
function domainFor(values: number[]): [number, number] {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const spread = max - min
  const pad = spread > 0 ? spread * 0.12 : Math.max(Math.abs(max) * 0.02, 0.5)
  return [min - pad, max + pad]
}

function Tile({ label, value, tone = 'flat' }: { label: string; value: string; tone?: keyof typeof TONE_CLASS }) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 px-3 py-2">
      <div className="text-[11px] leading-tight font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </div>
      <div className={cn('font-heading text-lg font-extrabold', TONE_CLASS[tone])}>{value}</div>
    </div>
  )
}

function MetricTrendCard({
  metric,
  history,
  period,
  range,
  reference,
  note,
}: {
  metric: BodyField
  history: BodyMetricPoint[]
  period: Period
  range: TrendRange
  /** Línea punteada de referencia (peso óptimo en la tarjeta de peso). */
  reference?: { value: number; label: string }
  /** Advertencia sobre el origen del dato, cuando no todo viene de la balanza. */
  note?: string
}) {
  const points = useMemo(() => pointsFor(history, metric.key, period), [history, metric.key, period])
  const stats = useMemo(() => statsFor(points, range), [points, range])

  const values = points.map((point) => point.value)
  if (reference && values.length) values.push(reference.value)
  const domain = values.length ? domainFor(values) : undefined
  const tone = stats ? toneFor(stats.change, metric.better, metric.digits) : 'flat'
  const suffix = metric.unit ? ` ${metric.unit}` : ''
  const gradientId = `trend-${metric.key}`

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
          <div className="min-w-0">
            <CardTitle className="text-base">{metric.label}</CardTitle>
            <CardDescription>
              {metric.hint ??
                (points.length
                  ? `${points.length} ${points.length === 1 ? 'lectura' : 'lecturas'} en el periodo`
                  : 'Sin lecturas en el periodo')}
            </CardDescription>
            {note && <p className="mt-0.5 text-xs text-primary">{note}</p>}
          </div>
          {stats && (
            <div className="text-right">
              <div className="font-heading text-2xl font-extrabold sm:text-3xl">
                {formatValue(stats.last.value, metric.digits)}
                {metric.unit && (
                  <span className="ml-1 text-sm font-normal text-muted-foreground">{metric.unit}</span>
                )}
              </div>
              <div className={cn('text-xs font-medium', TONE_CLASS[tone])}>
                {formatChange(stats.change, metric.digits)}
                {suffix} en el periodo
              </div>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {points.length >= 2 ? (
          <ResponsiveContainer width="100%" height={190}>
            <AreaChart data={points} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="date" tick={chartTick} tickFormatter={shortLabel} minTickGap={24} />
              <YAxis
                tick={chartTick}
                domain={domain}
                width={48}
                tickFormatter={(value: number) => formatValue(value, metric.digits === 0 ? 0 : 1)}
              />
              <Tooltip
                contentStyle={chartTooltipStyle}
                labelFormatter={(value) => (typeof value === 'string' ? longLabel(value) : '')}
                formatter={(value) => [
                  `${formatValue(typeof value === 'number' ? value : null, metric.digits)}${suffix}`,
                  metric.label,
                ]}
              />
              {reference && (
                <ReferenceLine
                  y={reference.value}
                  stroke="var(--muted-foreground)"
                  strokeDasharray="5 4"
                  label={{ value: reference.label, position: 'insideTopRight', fill: 'var(--muted-foreground)', fontSize: 11 }}
                />
              )}
              <Area
                type="monotone"
                dataKey="value"
                name={metric.label}
                stroke="var(--primary)"
                strokeWidth={2}
                fill={`url(#${gradientId})`}
                dot={{ r: 2.5, fill: 'var(--background)', stroke: 'var(--primary)', strokeWidth: 2 }}
                activeDot={{ r: 4.5 }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {points.length === 1
              ? `Una sola lectura (${formatValue(points[0].value, metric.digits)}${suffix}). Hacen falta dos para trazar una línea.`
              : 'Sin lecturas de esta métrica en el periodo.'}
          </p>
        )}

        {stats && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Tile
              label={stats.rateLabel}
              value={stats.rate == null ? '—' : `${formatChange(stats.rate, metric.digits)}${suffix}`}
              tone={stats.rate == null ? 'flat' : tone}
            />
            <Tile label="Tendencia" value={`${formatChange(stats.change, metric.digits)}${suffix}`} tone={tone} />
            <Tile label="Registro más alto" value={`${formatValue(stats.max.value, metric.digits)}${suffix}`} />
            <Tile label="Registro más bajo" value={`${formatValue(stats.min.value, metric.digits)}${suffix}`} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function TendenciasTab({
  heightCm,
  onGoMediciones,
}: {
  /** Altura del perfil. Con ella se rellena el IMC que la balanza no trajo. */
  heightCm: number | null
  onGoMediciones: () => void
}) {
  const trends = useBodyTrends()
  const { loading, error, range, setRange, period } = trends

  const { history, estimated: estimatedBmi } = useMemo(
    () => withEstimatedBmi(trends.history, heightCm),
    [trends.history, heightCm],
  )

  /** Meta de la balanza: se dibuja como línea punteada en la tarjeta de peso,
   *  igual que en Renpho. Se toma de la última lectura que la traiga. */
  const optimalWeight = useMemo(() => {
    for (let i = history.length - 1; i >= 0; i -= 1) {
      const value = history[i].optimal_weight_kg
      if (typeof value === 'number' && Number.isFinite(value)) return value
    }
    return null
  }, [history])

  /** Una métrica que la balanza nunca midió no merece tarjeta: veintiún huecos
   *  vacíos esconden las que sí tienen datos. */
  const groups = useMemo(
    () =>
      BODY_FIELD_GROUPS.map((group) => ({
        ...group,
        fields: group.fields.filter((field) =>
          history.some((reading) => typeof reading[field.key] === 'number'),
        ),
      })).filter((group) => group.fields.length),
    [history],
  )

  if (loading) return <TendenciasSkeleton />


  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No se pudo cargar el historial</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" variant="outline" size="sm" onClick={() => void trends.reload()}>
            Reintentar
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!history.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ChartSpline className="size-5 text-primary" />
            Tendencias
          </CardTitle>
          <CardDescription>Todavía no hay lecturas corporales que graficar.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" onClick={onGoMediciones}>
            Ir a Mediciones
          </Button>
        </CardContent>
      </Card>
    )
  }

  const first = history[0].date
  const last = history[history.length - 1].date

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {history.length} lecturas de la balanza, de {shortLabel(first)} a {shortLabel(last)}.
      </p>

      <div className="sticky top-14 z-20 -mx-4 border-b border-border bg-background/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex rounded-lg border border-border bg-muted/50 p-0.5">
            {TREND_RANGES.map((item) => (
              <button
                key={item.k}
                type="button"
                onClick={() => setRange(item.k)}
                className={cn(
                  'min-w-11 rounded-md px-3 py-1 text-sm font-medium transition-colors',
                  range === item.k
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Periodo anterior"
              disabled={!trends.canGoPrev}
              onClick={trends.goPrev}
            >
              <ChevronLeft />
            </Button>
            <span className="min-w-32 text-center text-sm font-medium">{period.label}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Periodo siguiente"
              disabled={!trends.canGoNext}
              onClick={trends.goNext}
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
      </div>

      {groups.map((group) => (
        <section key={group.title} className="space-y-3">
          <div>
            <h2 className="font-heading text-lg font-extrabold tracking-tight">{group.title}</h2>
            <p className="text-sm text-muted-foreground">{group.description}</p>
          </div>
          {group.fields.map((metric) => (
            <MetricTrendCard
              key={metric.key}
              metric={metric}
              history={history}
              period={period}
              range={range}
              reference={
                metric.key === 'weight_kg' && optimalWeight != null
                  ? { value: optimalWeight, label: 'Peso óptimo' }
                  : undefined
              }
              note={
                metric.key === 'bmi' && estimatedBmi
                  ? `${estimatedBmi} ${estimatedBmi === 1 ? 'lectura estimada' : 'lecturas estimadas'} con tu altura (${heightCm} cm); el resto lo midió la balanza.`
                  : undefined
              }
            />
          ))}
        </section>
      ))}
    </div>
  )
}
