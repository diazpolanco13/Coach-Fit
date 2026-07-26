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
  if (day.status === 'missed') return 'Faltó'
  if (day.status === 'future') return 'Pendiente'
  return 'Descanso'
}

function statusClass(day: ProfileCalendarDay) {
  if (day.status === 'completed') return 'bg-primary text-primary-foreground'
  if (day.status === 'bonus') return 'bg-primary/70 text-primary-foreground'
  if (day.status === 'missed') return 'bg-destructive/15 text-destructive ring-1 ring-destructive/25'
  if (day.status === 'future') return 'bg-muted/60 text-muted-foreground'
  return 'bg-muted text-muted-foreground'
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
          <div className="grid grid-rows-7 gap-1 pt-6 text-[10px] font-semibold text-muted-foreground">
            {WEEKDAYS.map((day) => (
              <span key={day} className="flex h-8 items-center justify-end">
                {day}
              </span>
            ))}
          </div>
          <div className="overflow-x-auto pb-1">
            <div className="flex min-w-max gap-1">
              {weeks.map((week) => (
                <div key={week.weekStart} className="space-y-1">
                  <div className="h-5 text-center text-[10px] text-muted-foreground">{shortDate(week.weekStart)}</div>
                  <div className="grid grid-rows-7 gap-1">
                    {week.days.map((day) => {
                      const disabled = day.status === 'future' || !onOpenDay
                      const Cell = disabled ? 'span' : 'button'
                      return (
                        <Cell
                          key={day.date}
                          type={disabled ? undefined : 'button'}
                          onClick={disabled ? undefined : () => onOpenDay(day.date)}
                          title={`${shortDate(day.date)} · ${statusLabel(day)}${
                            day.volume_kg ? ` · ${Math.round(day.volume_kg).toLocaleString('es')} kg` : ''
                          }`}
                          className={cn(
                            'flex size-8 items-center justify-center rounded-md text-[10px] font-semibold transition-colors',
                            !disabled && 'hover:ring-2 hover:ring-primary/35',
                            statusClass(day),
                          )}
                        >
                          {parseLocalDate(day.date).getDate()}
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
            ['Entrenado', 'bg-primary'],
            ['Extra', 'bg-primary/70'],
            ['Faltó', 'bg-destructive/20 ring-1 ring-destructive/25'],
            ['Descanso', 'bg-muted'],
            ['Pendiente', 'bg-muted/60'],
          ].map(([label, klass]) => (
            <span key={label} className="inline-flex items-center gap-1.5">
              <span className={cn('size-3 rounded-sm', klass)} />
              {label}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
