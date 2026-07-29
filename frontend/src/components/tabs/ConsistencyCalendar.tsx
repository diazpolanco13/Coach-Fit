import { CalendarCheck2 } from 'lucide-react'
import type { ProfileCalendarDay } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

function parseLocalDate(value: string) {
  return new Date(`${value}T00:00:00`)
}

function dateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function mondayKey(value: string) {
  const date = parseLocalDate(value)
  date.setDate(date.getDate() - date.getDay() + 1)
  return dateKey(date)
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' }).format(parseLocalDate(value))
}

function statusLabel(day: ProfileCalendarDay) {
  if (day.status === 'completed') return 'Entrenado'
  if (day.status === 'bonus') return 'Extra'
  if (day.status === 'partial') return 'Parcial'
  if (day.status === 'missed') return 'Sin entrenar'
  if (day.status === 'future') return 'Pendiente'
  return 'Descanso'
}

function statusClass(day: ProfileCalendarDay) {
  if (day.status === 'completed') return 'bg-primary/10 text-foreground'
  if (day.status === 'bonus') return 'bg-primary/70 text-primary-foreground'
  if (day.status === 'partial') return 'bg-primary/5 text-foreground'
  if (day.status === 'missed') return 'bg-muted text-muted-foreground'
  if (day.status === 'future') return 'bg-muted/60 text-muted-foreground'
  return 'bg-rest/20 text-rest'
}

function ringColor(day: ProfileCalendarDay) {
  if (day.status === 'partial') return 'var(--primary)'
  if (day.status === 'completed' || day.status === 'bonus') return 'var(--primary)'
  return 'var(--muted-foreground)'
}

function dayTitle(day: ProfileCalendarDay) {
  const parts = [`${shortDate(day.date)} · ${statusLabel(day)}`]
  if (day.planned_sets) {
    parts.push(`${day.done_sets}/${day.planned_sets} series · ${day.completion_pct}%`)
  }
  if (day.volume_kg) {
    parts.push(`${Math.round(day.volume_kg).toLocaleString('es')} kg`)
  }
  return parts.join(' · ')
}

function buildWeeks(calendar: ProfileCalendarDay[]) {
  const weeks = new Map<string, ProfileCalendarDay[]>()
  for (const day of calendar) {
    const key = mondayKey(day.date)
    if (!weeks.has(key)) weeks.set(key, [])
    weeks.get(key)!.push(day)
  }
  return [...weeks.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekStart, days]) => ({
      weekStart,
      days: [...days].sort((a, b) => a.weekday - b.weekday),
    }))
}

export function ConsistencyCalendar({
  calendar,
  onOpenDay,
}: {
  calendar: ProfileCalendarDay[]
  onOpenDay?: (date: string) => void
}) {
  const weeks = buildWeeks(calendar)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarCheck2 className="size-5 text-primary" />
          Calendario 28d
        </CardTitle>
        <CardDescription>Días entrenados, faltas, descansos y extras del plan activo.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
          <div className="grid grid-rows-7 gap-1 pt-6 text-[10px] font-semibold text-muted-foreground md:gap-1.5">
            {WEEKDAYS.map((day) => (
              <span key={day} className="flex h-8 items-center justify-end md:h-10">
                {day}
              </span>
            ))}
          </div>
          <div className="overflow-x-auto pb-1">
            <div className="flex min-w-max gap-1 md:gap-1.5">
              {weeks.map((week) => (
                <div key={week.weekStart} className="space-y-1">
                  <div className="h-5 text-center text-[10px] text-muted-foreground">{shortDate(week.weekStart)}</div>
                  <div className="grid grid-rows-7 gap-1 md:gap-1.5">
                    {week.days.map((day) => {
                      const disabled = day.status === 'future' || !onOpenDay
                      const Cell = disabled ? 'span' : 'button'
                      const showRing = day.status === 'completed' || day.status === 'partial'
                      const pct = Math.max(0, Math.min(100, day.completion_pct))
                      const circumference = 75.4
                      return (
                        <Cell
                          key={day.date}
                          type={disabled ? undefined : 'button'}
                          onClick={disabled ? undefined : () => onOpenDay(day.date)}
                          title={dayTitle(day)}
                          style={{ gridRowStart: day.weekday + 1 }}
                          className={cn(
                            'relative flex size-8 items-center justify-center rounded-full text-[10px] font-semibold transition-colors md:size-10 md:text-xs',
                            !disabled && 'hover:ring-2 hover:ring-primary/35',
                            statusClass(day),
                          )}
                        >
                          {showRing && (
                            <svg className="absolute inset-0 size-8 -rotate-90 md:size-10" viewBox="0 0 32 32" aria-hidden>
                              <circle
                                cx="16"
                                cy="16"
                                r="12"
                                fill="none"
                                stroke="var(--muted)"
                                strokeOpacity={0.7}
                                strokeWidth="3"
                              />
                              {pct > 0 && (
                                <circle
                                  cx="16"
                                  cy="16"
                                  r="12"
                                  fill="none"
                                  stroke={ringColor(day)}
                                  strokeLinecap="round"
                                  strokeWidth="3"
                                  strokeDasharray={`${(pct / 100) * circumference} ${circumference}`}
                                />
                              )}
                            </svg>
                          )}
                          <span className="relative z-10">{parseLocalDate(day.date).getDate()}</span>
                        </Cell>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {[
            ['Entrenado', 'border-primary bg-primary/10'],
            ['Parcial', 'border-primary bg-primary/5'],
            ['Extra', 'bg-primary/70'],
            ['Sin entrenar', 'bg-muted'],
            ['Descanso', 'border-rest/40 bg-rest/20'],
            ['Pendiente', 'bg-muted/60'],
          ].map(([label, klass]) => (
            <span key={label} className="inline-flex items-center gap-1.5">
              <span className={cn('size-3 rounded-full border', klass)} />
              {label}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
