import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { PlanGoals } from '@/lib/api'
import { Button } from '@/components/ui/button'
import type { DayMusclePoint } from '@/lib/dayStimulus'
import { getDayStimulusCollapsed, setDayStimulusCollapsed } from '@/lib/settings'
import { formatSets, goalFor, volumeStatus, type MuscleVolume } from '@/lib/volume'
import {
  MIN_TICK,
  OVER_FILL,
  OVER_SOFT,
  SHORTFALL,
  VOLUME_BAR,
  VOLUME_TEXT,
} from '@/lib/volumeStyle'
import { TwoTone } from '@/components/VolumeSwatch'
import { cn } from '@/lib/utils'

/**
 * Qué entrena este día, situado dentro de la semana.
 *
 * La versión anterior normalizaba las barras contra el músculo más trabajado
 * del propio día: el primero siempre llegaba al final y no se sabía si 12.5
 * series era mucho o poco. Aquí la barra es el **objetivo semanal**, el mismo
 * que juzga la vista de la semana, así que cada día se lee en la escala en la
 * que de verdad se decide si un músculo va corto o pasado.
 *
 * Cada barra lleva tres tramos y una marca:
 *  - sólido: lo que este día aporta como trabajo directo
 *  - tono claro: lo que aporta de forma indirecta (secundario)
 *  - gris: lo que ponen los otros días de la semana
 *  - la muesca: el mínimo semanal del músculo
 *
 * El color de esos dos primeros tramos es el semáforo de la semana —verde en
 * rango, ámbar por debajo del mínimo, rojo lo que pasa del tope—, el mismo que
 * usa `VolumePanel` y desde el mismo sitio (`lib/volumeStyle`). Antes iban en
 * el naranja de marca, que se leía como aviso incluso cuando el músculo estaba
 * perfecto; aquí el juicio lo da el color y el aporte del día, el tono.
 */
export function DayStimulusPanel({
  weekday,
  points,
  volumes,
  goals,
  className,
}: {
  /** Día del plan (0–6): el pliegue se guarda por día, no para toda la semana. */
  weekday: number
  points: DayMusclePoint[]
  /** Volumen semanal completo del plan, para saber cuánto pone el resto. */
  volumes: MuscleVolume[]
  goals: PlanGoals
  className?: string
}) {
  const [collapsed, setCollapsed] = useState(() => getDayStimulusCollapsed(weekday))
  const toggle = () => {
    const next = !collapsed
    setCollapsed(next)
    setDayStimulusCollapsed(weekday, next)
  }

  const weekByMuscle = useMemo(() => new Map(volumes.map((v) => [v.muscle, v])), [volumes])

  const rows = useMemo(
    () =>
      points.map((point) => {
        const weekly = weekByMuscle.get(point.muscle)
        // El resto de la semana nunca es negativo: si el volumen semanal no
        // trae el músculo (catálogo desincronizado), el día es todo lo que hay.
        const week = Math.max(weekly?.total ?? point.total, point.total)
        // Fuera del radar semanal (arrastre ínfimo): sin objetivo. Si ya suma
        // series efectivas de verdad —aunque vengan de secundario ponderado—
        // se juzga igual que un músculo programado.
        const programmed = weekly?.programmed ?? false
        const goal = goalFor(goals, point.muscle)
        // La barra llega hasta el tope del objetivo, o hasta la semana si ya lo
        // pasó: pasarse tiene que verse, no salirse del gráfico en silencio.
        const scale = programmed ? Math.max(goal.max, week, 1) : Math.max(week, 1)
        // El mismo veredicto que da la vista de la semana: el estado es del
        // músculo en la semana, no del día. Un día corto de pecho no es un
        // problema si los otros tres días lo dejan en rango.
        const status = weekly ? volumeStatus(weekly, goals) : 'incidental'
        // El exceso se pinta en dos tonos según quién lo pone: lo que este día
        // mete por encima del tope, y lo que ya venía de los otros días.
        const dayOver = programmed ? Math.max(0, Math.min(point.total, week) - goal.max) : 0
        const restOver = programmed ? Math.max(0, week - Math.max(goal.max, point.total)) : 0
        return {
          ...point,
          week,
          goal,
          programmed,
          scale,
          status,
          dayOver,
          restOver,
          share: point.total / week,
          overMax: programmed && week > goal.max,
        }
      }),
    [points, goals, weekByMuscle],
  )

  const dayTotal = points.reduce((n, p) => n + p.total, 0)
  const lead = rows[0]

  if (!rows.length) {
    return (
      <div className={cn('rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground', className)}>
        Sin estímulo muscular
      </div>
    )
  }

  return (
    <div className={cn('rounded-lg border border-border/80 bg-muted/30 px-3 py-2.5', className)}>
      <div className={cn('flex items-center justify-between gap-2', !collapsed && 'mb-2')}>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expandir métricas del día' : 'Plegar métricas del día'}
          className="min-w-0 flex-1 text-left"
        >
          <span className="block text-[11px] font-medium text-foreground">Qué entrena este día</span>
          <span className="block text-[10px] tabular-nums text-muted-foreground">
            {formatSets(dayTotal)} series efectivas
            {collapsed && lead ? ` · ${lead.muscle}` : ''}
          </span>
        </button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-7 shrink-0"
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expandir métricas del día' : 'Plegar métricas del día'}
          onClick={toggle}
        >
          <ChevronDown
            className={cn(
              'size-4 text-muted-foreground transition-transform',
              collapsed && '-rotate-90',
            )}
          />
        </Button>
      </div>

      {!collapsed && (
        <>
          {/* Una frase antes que cuatro barras: de un vistazo, de qué día es. */}
          {lead && (
            <p className="mb-2.5 text-[11px] text-muted-foreground">
              Sobre todo <strong className="font-medium text-foreground">{lead.muscle}</strong> (
              {Math.round((lead.total / dayTotal) * 100)}% del estímulo
              {rows.length > 1
                ? `, con ${rows.length - 1} grupo${rows.length > 2 ? 's' : ''} más`
                : ''}
              ).
            </p>
          )}

          <ul className="space-y-2">
            {rows.map((row) => {
              const pct = (n: number) => `${(n / row.scale) * 100}%`
              return (
                <li key={row.muscle} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-2 text-[11px]">
                    <span className="truncate font-medium">{row.muscle}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      <strong className="font-medium text-foreground">{formatSets(row.total)}</strong>
                      {' de '}
                      {formatSets(row.week)} sem.
                    </span>
                  </div>
                  <div
                    className="relative h-2 overflow-hidden rounded-full bg-background"
                    title={`${row.muscle}: ${formatSets(row.total)} series efectivas este día. En la semana ${formatSets(row.week)}${
                      row.programmed
                        ? `, objetivo ${row.goal.min}–${row.goal.max}.`
                        : ' (arrastre menor, sin objetivo).'
                    }`}
                  >
                    {/* Lo que le falta a la semana para el mínimo. */}
                    {row.status === 'low' && (
                      <span
                        aria-hidden
                        className={cn('absolute inset-y-0', SHORTFALL)}
                        style={{ left: pct(row.week), width: pct(row.goal.min - row.week) }}
                      />
                    )}
                    <div className="flex h-full">
                      <div
                        className={cn('h-full', VOLUME_BAR[row.status].fill)}
                        style={{ width: pct(row.primary) }}
                      />
                      <div
                        className={cn('h-full', VOLUME_BAR[row.status].soft)}
                        style={{ width: pct(row.secondary) }}
                      />
                      <div
                        className="h-full bg-muted-foreground/25"
                        style={{ width: pct(row.week - row.total) }}
                      />
                    </div>
                    {/* El exceso va encima de los tramos, desde el tope: así el día
                        sigue viéndose entero y el rojo marca solo lo que sobra. */}
                    {row.dayOver > 0 && (
                      <span
                        aria-hidden
                        className={cn('absolute inset-y-0', OVER_FILL)}
                        style={{ left: pct(row.goal.max), width: pct(row.dayOver) }}
                      />
                    )}
                    {row.restOver > 0 && (
                      <span
                        aria-hidden
                        className={cn('absolute inset-y-0', OVER_SOFT)}
                        style={{
                          left: pct(Math.max(row.goal.max, row.total)),
                          width: pct(row.restOver),
                        }}
                      />
                    )}
                    {/* Muesca del mínimo semanal: lo que separa «va corto» de «va
                        bien» en la vista de la semana, traído aquí para que el día
                        se lea contra el mismo listón. */}
                    {row.programmed && row.goal.min < row.scale && (
                      <span
                        aria-hidden
                        className={cn('absolute inset-y-0 w-px', MIN_TICK)}
                        style={{ left: pct(row.goal.min) }}
                      />
                    )}
                  </div>
                  <div className="flex items-baseline justify-between gap-2 text-[10px] text-muted-foreground">
                    <span>
                      {Math.round(row.share * 100)}% de la semana lo pone este día
                    </span>
                    <span
                      className={cn(
                        'shrink-0 tabular-nums',
                        row.status !== 'ok' && VOLUME_TEXT[row.status],
                      )}
                    >
                      {row.programmed ? (
                        <>
                          objetivo {row.goal.min}–{row.goal.max}
                          {row.overMax ? ' · pasado' : ''}
                        </>
                      ) : (
                        'solo indirecto'
                      )}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>

          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/70 pt-2 text-[10px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <TwoTone {...VOLUME_BAR.ok} />
              Este día, en rango
            </span>
            {rows.some((r) => r.status === 'low') && (
              <span className="inline-flex items-center gap-1">
                <TwoTone {...VOLUME_BAR.low} />
                Corto en la semana
              </span>
            )}
            {rows.some((r) => r.overMax) && (
              <span className="inline-flex items-center gap-1">
                <span className={cn('h-1.5 w-3 rounded-full', OVER_FILL)} />
                Pasado del tope
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <span className="h-1.5 w-3 rounded-full bg-muted-foreground/25" />
              Otros días
            </span>
            <span className="inline-flex items-center gap-1">
              <span className={cn('h-2.5 w-px', MIN_TICK)} />
              Mínimo semanal
            </span>
            <span className="text-muted-foreground/80">Tono sólido directo, claro indirecto.</span>
          </div>
        </>
      )}
    </div>
  )
}
