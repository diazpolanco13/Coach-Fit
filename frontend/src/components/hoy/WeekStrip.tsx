import type { PlanSummary, WeekDay } from '@/lib/api'
import { Check, Minus } from 'lucide-react'
import { planPosition } from '@/lib/hoy'
import { cn } from '@/lib/utils'

const INITIALS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

export function WeekStrip({
  days,
  todayDate,
  plans,
  activeId,
  objective,
  onSelectDay,
}: {
  days: WeekDay[]
  todayDate: string | undefined
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
          {days.filter((d) => d.completed).length}/{days.filter((d) => d.items.length).length} hechos
        </div>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1.5">
        {days.map((d) => {
          const isToday = d.date === todayDate
          const rest = !d.items.length
          return (
            <button
              key={d.date}
              type="button"
              onClick={() => onSelectDay(d)}
              title={`${d.label}${rest ? '' : ` · ${d.items.length} ej.`}`}
              className={cn(
                'rounded-lg border py-1.5 text-center transition-colors hover:border-primary/60',
                d.completed && 'border-primary/30 bg-primary/10',
                !d.completed && 'border-transparent bg-muted/60',
                isToday && 'border-primary ring-1 ring-primary',
              )}
            >
              <div
                className={cn(
                  'text-[11px] font-semibold',
                  d.completed ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                {INITIALS[d.weekday]}
              </div>
              <div className="flex h-4 items-center justify-center">
                {d.completed ? (
                  <Check className="size-3.5 text-primary" />
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
