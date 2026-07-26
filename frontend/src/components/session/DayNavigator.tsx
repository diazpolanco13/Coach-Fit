import { useMemo } from 'react'
import { CalendarDays, Check, ChevronLeft, ChevronRight } from 'lucide-react'
import type { DaySummary, WeekDay } from '@/lib/api'
import { Button } from '@/components/ui/button'
import {
  addDays,
  dayOfMonth,
  daysFrom,
  longLabel,
  relativeLabel,
  shortLabel,
  startOfWeek,
  weekDates,
  weekdayOf,
} from '@/lib/dates'
import { cn } from '@/lib/utils'

const INITIALS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

/**
 * Paseo por fechas: flechas de día, tira de la semana, salto a hoy y calendario
 * nativo para ir lejos.
 *
 * La tira mezcla dos fuentes que no se pueden confundir:
 *  - `planDays` es la plantilla del plan **activo**, indexada por día de la
 *    semana. Dice qué toca, y vale igual para el lunes que viene que para el de
 *    hace un mes. Es una previsión, no un registro.
 *  - `sessions` son las sesiones guardadas de la semana en pantalla. Eso sí es
 *    lo que pasó de verdad.
 */
export function DayNavigator({
  date,
  today,
  planDays,
  sessions,
  onChange,
}: {
  date: string
  today: string
  planDays: WeekDay[]
  /** Sesiones de la semana visible, por fecha. */
  sessions: Record<string, DaySummary>
  onChange: (date: string) => void
}) {
  const week = useMemo(() => weekDates(date), [date])
  const relative = relativeLabel(date, today)
  const offset = daysFrom(date, today)

  /** El plan se indexa por día de la semana, nunca por fecha: así una fecha de
   *  otra semana —pasada o futura— sigue sabiendo qué le tocaba. */
  const planByWeekday = useMemo(() => {
    const map = new Map<number, WeekDay>()
    planDays.forEach((d) => map.set(d.weekday, d))
    return map
  }, [planDays])

  const weekIsCurrent = startOfWeek(date) === startOfWeek(today)

  return (
    <div className="rounded-xl border bg-card">
      {/* Fila principal: día anterior · fecha · día siguiente */}
      <div className="flex items-center gap-2 border-b px-2 py-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Día anterior"
          onClick={() => onChange(addDays(date, -1))}
        >
          <ChevronLeft className="size-4" />
        </Button>

        <div className="min-w-0 flex-1 text-center">
          <div className="truncate text-sm font-semibold text-foreground">{longLabel(date)}</div>
          <div className="text-xs text-muted-foreground">
            {relative ?? (offset < 0 ? `Hace ${-offset} días` : `En ${offset} días`)}
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          aria-label="Día siguiente"
          onClick={() => onChange(addDays(date, 1))}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      {/* Tira de la semana */}
      <div className="px-2 py-2.5">
        <div className="mb-2 flex items-center justify-between gap-2 px-1">
          <button
            type="button"
            onClick={() => onChange(addDays(date, -7))}
            className="rounded px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Semana
          </button>
          <span className="truncate text-xs text-muted-foreground">
            {weekIsCurrent
              ? 'Esta semana'
              : `${shortLabel(week[0])} – ${shortLabel(week[6])}`}
          </span>
          <button
            type="button"
            onClick={() => onChange(addDays(date, 7))}
            className="rounded px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Semana →
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {week.map((iso) => {
            const plan = planByWeekday.get(weekdayOf(iso))
            const session = sessions[iso]
            const done = !!session?.completed
            const planned = !!plan?.items.length
            const isSelected = iso === date
            const isToday = iso === today
            const future = daysFrom(iso, today) > 0

            return (
              <button
                key={iso}
                type="button"
                onClick={() => onChange(iso)}
                aria-current={isSelected ? 'date' : undefined}
                title={[
                  longLabel(iso),
                  plan?.focus,
                  done ? 'registrado' : planned ? `${plan.items.length} ej. previstos` : 'descanso',
                ]
                  .filter(Boolean)
                  .join(' · ')}
                className={cn(
                  'rounded-lg border py-1.5 text-center transition-colors',
                  'border-transparent bg-muted/50 hover:border-primary/50',
                  done && 'bg-primary/10',
                  isToday && !isSelected && 'border-primary/40',
                  isSelected && 'border-primary bg-primary/15 ring-1 ring-primary',
                  // Un día futuro sin registrar es una previsión: se atenúa para
                  // que no se lea como algo ya hecho.
                  future && !done && 'opacity-70',
                )}
              >
                <div className="text-[10px] font-medium text-muted-foreground">
                  {INITIALS[weekdayOf(iso)]}
                </div>
                <div
                  className={cn(
                    'text-sm font-semibold tabular-nums',
                    isSelected || done ? 'text-primary' : 'text-foreground',
                  )}
                >
                  {dayOfMonth(iso)}
                </div>
                <div className="flex h-3.5 items-center justify-center">
                  {done ? (
                    <Check className="size-3 text-primary" />
                  ) : planned ? (
                    <span className="size-1.5 rounded-full bg-muted-foreground/50" />
                  ) : (
                    <span className="text-[10px] leading-none text-muted-foreground/40">·</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Ir a una fecha concreta y volver a hoy */}
      <div className="flex items-center gap-2 border-t px-2 py-2">
        <label className="flex flex-1 items-center gap-2 text-xs text-muted-foreground">
          <CalendarDays className="size-3.5 shrink-0" />
          <input
            type="date"
            value={date}
            aria-label="Ir a una fecha"
            onChange={(e) => e.target.value && onChange(e.target.value)}
            className="min-w-0 flex-1 rounded-md border bg-transparent px-2 py-1 text-xs text-foreground"
          />
        </label>
        <Button
          variant={offset === 0 ? 'ghost' : 'outline'}
          size="sm"
          disabled={offset === 0}
          onClick={() => onChange(today)}
        >
          Hoy
        </Button>
      </div>
    </div>
  )
}
