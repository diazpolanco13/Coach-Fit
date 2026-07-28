import { useMemo } from 'react'
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import type { Exercise, PlanGoals, WeekDay } from '@/lib/api'
import { Progress } from '@/components/ui/progress'
import { doneSetsAsDays } from '@/lib/hoy'
import { formatSets, goalFor, weeklyVolume } from '@/lib/volume'
import { cn } from '@/lib/utils'

/** Un radar con menos de 3 ejes es una línea, no una forma: planes así (p.ej.
 *  solo pierna) se quedan con la lista de barras. */
const MIN_RADAR_AXES = 3
/** Más ejes y las etiquetas se pisan entre sí: el radar no pretende cubrir el
 *  catálogo entero, solo lo que más volumen mueve este plan. */
const MAX_RADAR_AXES = 8

const chartTooltipStyle = {
  backgroundColor: 'var(--popover)',
  color: 'var(--popover-foreground)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  fontSize: '12px',
}

type RadarRow = {
  muscle: string
  /** Series equivalentes hechas esta semana (directo + secundario ponderado). */
  done: number
  /** Tope semanal del plan para este músculo (`goals.max`). */
  goal: number
  pct: number
}

type AngleTickProps = {
  x?: number | string
  y?: number | string
  textAnchor?: 'start' | 'middle' | 'end' | 'inherit'
  payload?: { value?: string }
  byMuscle: Map<string, RadarRow>
}

/** Etiqueta de eje en dos líneas: músculo y % del tope cumplido. El 100% se
 *  pinta en primary — al radar le cuesta decir «objetivo cubierto» solo con
 *  geometría, y es justo el dato que alegra la vista. */
function AngleTick({ x, y, textAnchor, payload, byMuscle }: AngleTickProps) {
  const muscle = payload?.value ?? ''
  const row = byMuscle.get(muscle)
  const px = Number(x ?? 0)
  const py = Number(y ?? 0)
  return (
    <text x={px} y={py} textAnchor={textAnchor} fontSize={11} fill="var(--foreground)">
      <tspan>{muscle}</tspan>
      {row && (
        <tspan
          x={px}
          dy="1.2em"
          fontSize={10}
          fontWeight={600}
          fill={row.pct >= 100 ? 'var(--primary)' : 'var(--muted-foreground)'}
        >
          {row.pct}%
        </tspan>
      )}
    </text>
  )
}

function RadarTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload: RadarRow }>
}) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload
  if (!row) return null
  return (
    <div style={chartTooltipStyle} className="px-3 py-2">
      <div className="font-semibold">{row.muscle}</div>
      <div className="tabular-nums">
        {formatSets(row.done)} de {formatSets(row.goal)} series · {row.pct}%
      </div>
    </div>
  )
}

export function WeekProgressPanel({
  days,
  weeklySets,
  goals,
  indirectWeight,
  exMap,
}: {
  days: WeekDay[]
  /** Series hechas por ejercicio esta semana. */
  weeklySets: Record<string, number>
  goals: PlanGoals
  indirectWeight: number
  exMap: Map<string, Exercise>
}) {
  /** Todos los músculos programados con su avance, sin recortar: el % de
   *  semana cumplida se calcula sobre todos, aunque el radar dibuje 8. */
  const allRows = useMemo<RadarRow[]>(() => {
    const done = weeklyVolume(doneSetsAsDays(weeklySets, exMap), exMap, indirectWeight)
    const planned = weeklyVolume(days, exMap, indirectWeight)
    const doneBy = new Map(done.map((v) => [v.muscle, v.total]))

    // Se listan los músculos que el PLAN programa, no los que se entrenaron: un
    // músculo sin trabajo previsto no tiene objetivo contra el que fallar, y uno
    // programado con cero series hechas es justo lo que hay que ver.
    return planned
      .filter((v) => v.programmed)
      .sort((a, b) => b.total - a.total)
      .map((v) => {
        const goal = goalFor(goals, v.muscle).max
        const total = doneBy.get(v.muscle) ?? 0
        return {
          muscle: v.muscle,
          done: Math.round(total * 10) / 10,
          goal,
          pct: goal > 0 ? Math.round((total / goal) * 100) : 0,
        }
      })
  }, [days, weeklySets, goals, indirectWeight, exMap])

  const rows = useMemo(() => allRows.slice(0, MAX_RADAR_AXES), [allRows])
  const byMuscle = useMemo(() => new Map(rows.map((r) => [r.muscle, r])), [rows])
  const maxValue = useMemo(
    () => Math.max(1, ...rows.flatMap((r) => [Math.ceil(r.done), r.goal])),
    [rows],
  )

  /** Media de topes cubiertos (cap 100 por músculo): pasarse de pecho no
   *  debería maquillar unos isquios a cero. */
  const weekPct = useMemo(() => {
    if (!allRows.length) return 0
    return Math.round(allRows.reduce((n, r) => n + Math.min(r.pct, 100), 0) / allRows.length)
  }, [allRows])

  const useRadar = rows.length >= MIN_RADAR_AXES

  /** Lista de barras de respaldo, peores primero — el radar con 1-2 ejes no
   *  dice nada que esto no diga mejor. */
  const barRows = useMemo(() => [...rows].sort((a, b) => a.pct - b.pct).slice(0, 6), [rows])

  const remainingDays = days.filter((d) => d.items.length && !d.completed).length
  const remainingSets = days
    .filter((d) => !d.completed)
    .reduce((n, d) => n + d.items.reduce((m, i) => m + i.sets, 0), 0)

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <div className="kicker">Radar semanal</div>
        {allRows.length > 0 && (
          <div className="shrink-0 text-xs tabular-nums text-muted-foreground">
            Semana {weekPct}%
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Este plan no programa trabajo directo todavía.
        </p>
      ) : useRadar ? (
        <>
          <ResponsiveContainer width="100%" height={250}>
            <RadarChart data={rows} cx="50%" cy="52%" outerRadius="64%">
              <PolarGrid stroke="var(--border)" />
              <PolarAngleAxis
                dataKey="muscle"
                tick={(props) => <AngleTick {...props} byMuscle={byMuscle} />}
              />
              <PolarRadiusAxis domain={[0, maxValue]} tick={false} axisLine={false} />
              <Radar
                name="Hecho"
                dataKey="done"
                stroke="var(--primary)"
                strokeWidth={2}
                fill="var(--primary)"
                fillOpacity={0.25}
                dot={{ r: 2.5, fill: 'var(--primary)', strokeWidth: 0 }}
              />
              <Radar
                name="Objetivo"
                dataKey="goal"
                stroke="var(--muted-foreground)"
                strokeWidth={1.5}
                strokeDasharray="4 3"
                fill="transparent"
                dot={false}
              />
              <Tooltip content={<RadarTooltip />} />
            </RadarChart>
          </ResponsiveContainer>
          <div className="mt-1 flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-primary" />
              Hecho
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-0 w-4 border-t-2 border-dashed border-muted-foreground" />
              Tope semanal
            </span>
          </div>
        </>
      ) : (
        <div className="mt-3 space-y-2.5">
          {barRows.map((r) => (
            <div key={r.muscle} className="grid grid-cols-[92px_1fr_auto] items-center gap-2.5 text-sm">
              <span className="truncate text-muted-foreground">{r.muscle}</span>
              <Progress
                value={Math.min(r.pct, 100)}
                className="h-2.5"
                indicatorClassName={r.done === 0 ? 'bg-destructive' : r.pct >= 100 ? undefined : 'bg-primary/50'}
              />
              <span
                className={cn(
                  'text-xs tabular-nums text-muted-foreground',
                  r.done === 0 && 'font-semibold text-destructive',
                )}
              >
                {formatSets(r.done)}/{formatSets(r.goal)}
              </span>
            </div>
          ))}
        </div>
      )}

      {rows.length > 0 && (
        <p className="mt-3 border-t pt-2.5 text-xs text-muted-foreground">
          {remainingDays
            ? `Quedan ${remainingDays} ${remainingDays === 1 ? 'día' : 'días'} y ${remainingSets} series programadas.`
            : 'Semana cerrada: no quedan días pendientes.'}
        </p>
      )}
    </div>
  )
}
