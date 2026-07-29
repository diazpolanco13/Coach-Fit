import type { PlanSummary, WeekDay } from '@/lib/api'
import { Check, Minus, CircleDot } from 'lucide-react'
import { dayOfMonth } from '@/lib/dates'
import { planPosition } from '@/lib/hoy'
import { cn } from '@/lib/utils'

const INITIALS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

export function WeekStrip({
  days,
  todayDate,
  selectedDate,
  plans,
  activeId,
  objective,
  onSelectDay,
}: {
  days: WeekDay[]
  todayDate: string | undefined
  /** Día que la tarjeta está mostrando; puede no ser hoy. */
  selectedDate?: string
  plans: PlanSummary[]
  activeId: number | null
  objective: string | null
  onSelectDay: (day: WeekDay) => void
}) {
  const position = planPosition(plans, activeId)
  const kicker = [position, objective].filter(Boolean).join(' · ')

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <div className="kicker truncate">{kicker || 'Esta semana'}</div>
        <div className="shrink-0 text-xs text-muted-foreground">
          {days.filter((d) => d.status === 'completed').length}/{days.filter((d) => d.items.length).length} hechos
        </div>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1.5">
        {days.map((d) => {
          const isToday = d.date === todayDate
          const isSelected = d.date === (selectedDate ?? todayDate)
          const rest = !d.items.length
          const complete = d.status === 'completed'
          const partial = d.status === 'partial'
          return (
            <button
              key={d.date}
              type="button"
              onClick={() => onSelectDay(d)}
              title={`${d.label}${rest ? '' : ` · ${d.items.length} ej.`}`}
              className={cn(
                'rounded-lg border py-1.5 text-center transition-colors hover:border-primary/60',
                complete && 'border-primary/30 bg-primary/10',
                partial && 'border-primary/25 bg-primary/5',
                !complete && !partial && 'border-transparent bg-muted/60',
                isToday && !isSelected && 'ring-1 ring-primary/50',
                isSelected && 'border-primary ring-1 ring-primary',
              )}
            >
              <div
                className={cn(
                  'text-[11px] font-semibold',
                  complete || partial ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                {INITIALS[d.weekday]}
              </div>
              <div
                className={cn(
                  'text-sm font-semibold tabular-nums leading-none',
                  isToday || isSelected ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {dayOfMonth(d.date)}
              </div>
              <div className="flex h-4 items-center justify-center">
                {complete ? (
                  <Check className="size-3.5 text-primary" />
                ) : partial ? (
                  <CircleDot className="size-3.5 text-primary" />
                ) : rest ? (
                  <span className="text-xs text-muted-foreground/60">·</span>
                ) : (
                  <Minus className="size-3.5 text-muted-foreground/60" />
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
