import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import type { PlanGoals } from '@/lib/api'
import { cn } from '@/lib/utils'
import { formatSets, goalFor, volumeStatus, type MuscleVolume } from '@/lib/volume'
import {
  GOAL_BAND,
  MIN_TICK,
  OVER_FILL,
  SHORTFALL,
  VOLUME_BAR,
  VOLUME_TEXT,
} from '@/lib/volumeStyle'
import { TwoTone } from '@/components/VolumeSwatch'

/**
 * Volumen semanal por músculo.
 *
 * La barra tiene dos ejes de lectura, y conviene no mezclarlos:
 *
 *  - la **forma** dice de dónde viene el trabajo: tramo sólido las series
 *    directas, tramo claro las indirectas, banda gris el rango objetivo y una
 *    muesca en el mínimo. Igual que las barras del día (`DayStimulusPanel`),
 *    para que semana y día se lean con el mismo vocabulario.
 *  - el **color** es el semáforo de siempre: verde en rango, ámbar por debajo
 *    del mínimo, rojo solo el tramo que pasa del tope.
 *
 * Pintar el volumen con el naranja de marca —como hizo una versión intermedia—
 * hacía leer cada fila como una alerta: sin un «esto está bien» en verde, el
 * naranja y el rojo del exceso caían en el mismo saco. Y el verde no es
 * `emerald-500` crudo, que sí parecía de otra app, sino un token de la paleta
 * (`--success`) con la croma baja para no competir con la marca.
 *
 * Los colores están en `lib/volumeStyle`, compartidos con la vista del día.
 */

/** Cuántos músculos se listan en modo compacto, ordenados por volumen. */
const COMPACT_ROWS = 6

export function VolumePanel({
  volumes,
  goals,
  compact = false,
}: {
  volumes: MuscleVolume[]
  goals: PlanGoals
  /** Versión reducida para la cabecera del editor: sin el desglose por región y
   *  con solo los músculos de más volumen (desplegable). */
  compact?: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const programmed = volumes.filter((v) => v.programmed)
  const incidental = volumes.filter((v) => !v.programmed)
  const over = programmed.filter((v) => volumeStatus(v, goals) === 'high')
  const under = programmed.filter((v) => volumeStatus(v, goals) === 'low')
  const rows = compact && !expanded ? programmed.slice(0, COMPACT_ROWS) : programmed
  const hidden = programmed.length - rows.length

  return (
    <div className={compact ? 'p-3' : 'p-4'}>
      <div className="flex items-baseline justify-between gap-2">
        <div className="kicker">Volumen semanal · series por músculo</div>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          base {goals.base.min}–{goals.base.max}
          {goals.overrides.length > 0 && ` · ${goals.overrides.length} prioritarios`}
        </span>
      </div>

      {!programmed.length ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Añade ejercicios al plan para ver cuánto trabajo recibe cada músculo.
        </p>
      ) : (
        <>
          {/* Una frase antes que doce barras: cuántos grupos están donde deben. */}
          <p className="mt-2 text-xs text-muted-foreground">
            <strong className="font-medium text-foreground">
              {programmed.length - under.length - over.length} de {programmed.length}
            </strong>{' '}
            músculos en rango
            {under.length > 0 && (
              <span className="text-warning-strong">
                {' '}
                · {under.length} corto{under.length > 1 ? 's' : ''}
              </span>
            )}
            {over.length > 0 && (
              <span className="text-destructive">
                {' '}
                · {over.length} pasado{over.length > 1 ? 's' : ''}
              </span>
            )}
            .
          </p>

          <ul className="mt-3 space-y-2.5">
            {rows.map((v) => (
              <VolumeRow key={v.muscle} v={v} goals={goals} compact={compact} />
            ))}
          </ul>

          {(hidden > 0 || (compact && expanded)) && (
            <button
              type="button"
              onClick={() => setExpanded((x) => !x)}
              className="mt-2 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              {hidden > 0 ? `Ver ${hidden} músculos más` : 'Ver menos'}
            </button>
          )}

          <Legend
            className="mt-3 border-t border-border/70 pt-2"
            showShortfall={under.length > 0}
            showOver={over.length > 0}
          />
        </>
      )}

      {!compact && !!incidental.length && (
        <p className="mt-3 text-xs text-muted-foreground">
          Solo trabajo indirecto:{' '}
          {incidental.map((v) => `${v.muscle} ${formatSets(v.total)}`).join(' · ')}
        </p>
      )}

      {(over.length > 0 || under.length > 0) && (
        <div className="mt-3 space-y-1.5 border-t border-border pt-2.5 text-xs">
          {over.length > 0 && (
            <p className="flex items-start gap-1.5 text-destructive">
              <AlertTriangle className="mt-px size-3.5 shrink-0" />
              <span>
                Pasas del tope en{' '}
                {over
                  .map((v) => `${v.muscle} (${formatSets(v.total)}/${goalFor(goals, v.muscle).max})`)
                  .join(', ')}
                . Reparte esos ejercicios en menos días, baja series o quita alguno.
              </span>
            </p>
          )}
          {under.length > 0 && (
            <p className="text-muted-foreground">
              Por debajo del mínimo:{' '}
              {under
                .map((v) => `${v.muscle} (${formatSets(v.total)}/${goalFor(goals, v.muscle).min})`)
                .join(', ')}
              .
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function VolumeRow({
  v,
  goals,
  compact,
}: {
  v: MuscleVolume
  goals: PlanGoals
  compact: boolean
}) {
  const status = volumeStatus(v, goals)
  const goal = goalFor(goals, v.muscle)
  const prioritized = goal !== goals.base
  // La barra llega hasta el tope del objetivo, o hasta el total si ya lo pasó:
  // pasarse tiene que verse, no salirse del gráfico en silencio.
  const scale = Math.max(goal.max, v.total, 1)
  const pct = (n: number) => `${Math.max(0, (n / scale) * 100)}%`
  // Lo que pasa del tope se pinta aparte, y en rojo. Se recorta primero de lo
  // indirecto: el exceso que sobra es el que menos aporta.
  const overflow = Math.max(0, v.total - goal.max)
  const indirect = Math.max(0, v.indirect - overflow)
  const direct = Math.min(v.direct, goal.max)

  return (
    <li className="space-y-1">
      <div className="grid grid-cols-[6.5rem_1fr_4.75rem] items-center gap-2.5 text-sm sm:grid-cols-[8rem_1fr_4.75rem]">
        <span className="flex items-center gap-1 truncate" title={v.muscle}>
          <span className="truncate">{v.muscle}</span>
          {prioritized && (
            <span
              aria-hidden
              title="Objetivo propio (prioritario)"
              className="size-1.5 shrink-0 rounded-full bg-primary"
            />
          )}
        </span>

        <div
          className="relative h-2.5 overflow-hidden rounded-full bg-muted"
          title={`${v.muscle}: ${formatSets(v.total)} series (${formatSets(v.direct)} directas + ${formatSets(v.indirect)} indirectas). Objetivo ${goal.min}–${goal.max}.`}
        >
          {/* Banda del rango objetivo: donde la barra debería terminar. */}
          <span
            aria-hidden
            className={cn('absolute inset-y-0', GOAL_BAND)}
            style={{ left: pct(goal.min), width: pct(goal.max - goal.min) }}
          />
          {/* Lo que falta para el mínimo, cuando va corto. */}
          {status === 'low' && (
            <span
              aria-hidden
              className={cn('absolute inset-y-0', SHORTFALL)}
              style={{ left: pct(v.total), width: pct(goal.min - v.total) }}
            />
          )}
          {/* `inset-0`, no `left-0`: sin ancho propio el contenedor se encoge al
              contenido y los `width` en % de los tramos resuelven contra cero. */}
          <div className="absolute inset-0 flex">
            <span className={cn('h-full', VOLUME_BAR[status].fill)} style={{ width: pct(direct) }} />
            <span className={cn('h-full', VOLUME_BAR[status].soft)} style={{ width: pct(indirect) }} />
            {overflow > 0 && (
              <span className={cn('h-full', OVER_FILL)} style={{ width: pct(overflow) }} />
            )}
          </div>
          {/* Muesca del mínimo: el listón que separa «va corto» de «va bien». */}
          {goal.min < scale && (
            <span
              aria-hidden
              className={cn('absolute inset-y-0 w-px', MIN_TICK)}
              style={{ left: pct(goal.min) }}
            />
          )}
          {/* El tope no lleva muesca: cuando se pasa, el corte de color entre
              el verde y el rojo cae justo ahí y ya lo marca. */}
        </div>

        <span className="flex items-baseline justify-end gap-1 tabular-nums">
          <strong className={cn('text-sm font-semibold', VOLUME_TEXT[status])}>
            {formatSets(v.total)}
          </strong>
          <span className="text-[11px] text-muted-foreground">
            /{goal.min}–{goal.max}
          </span>
        </span>
      </div>

      {!compact && (v.regions.length > 1 || v.indirect > 0) && (
        <p className="pl-[6.5rem] text-[11px] text-muted-foreground sm:pl-[8rem]">
          {v.indirect > 0 && `${formatSets(v.direct)} directas · ${formatSets(v.indirect)} indirectas`}
          {v.indirect > 0 && v.regions.length > 1 && ' — '}
          {v.regions.length > 1 &&
            v.regions.map((r) => `${r.region} ${formatSets(r.total)}`).join(' · ')}
        </p>
      )}
    </li>
  )
}

function Legend({
  className,
  showShortfall,
  showOver,
}: {
  className?: string
  showShortfall: boolean
  showOver: boolean
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground',
        className,
      )}
    >
      {/* El swatch de dos tonos enseña de una vez el color (el estado) y el
          corte sólido/claro (directo frente a indirecto). */}
      <span className="inline-flex items-center gap-1">
        <TwoTone {...VOLUME_BAR.ok} />
        En rango
      </span>
      {showShortfall && (
        <span className="inline-flex items-center gap-1">
          <TwoTone {...VOLUME_BAR.low} />
          Por debajo del mínimo
        </span>
      )}
      {showOver && (
        <span className="inline-flex items-center gap-1">
          <span className={cn('h-1.5 w-3 rounded-full', OVER_FILL)} />
          Pasado del tope
        </span>
      )}
      <span className="inline-flex items-center gap-1">
        <span className="h-1.5 w-3 rounded-full bg-foreground/[0.14]" />
        Rango objetivo
      </span>
      <span className="inline-flex items-center gap-1">
        <span className={cn('h-2.5 w-px', MIN_TICK)} />
        Mínimo
      </span>
      <span className="text-muted-foreground/80">Tono sólido directo, claro indirecto.</span>
    </div>
  )
}
