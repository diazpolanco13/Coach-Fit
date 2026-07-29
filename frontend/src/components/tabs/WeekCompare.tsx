import { CalendarDays } from 'lucide-react'
import type { ProfileCalendarDay, ProfileWeekDetail } from '@/lib/api'
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

function addDays(value: string, days: number) {
  const date = parseLocalDate(value)
  date.setDate(date.getDate() + days)
  return dateKey(date)
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' }).format(parseLocalDate(value))
}

function statusLabel(day?: ProfileCalendarDay) {
  if (!day) return 'Sin datos'
  if (day.status === 'completed') return 'Entrenado'
  if (day.status === 'bonus') return 'Extra'
  if (day.status === 'partial') return 'Parcial'
  if (day.status === 'missed') return 'Sin entrenar'
  if (day.status === 'future') return 'Pendiente'
  return 'Descanso'
}

function statusClass(day?: ProfileCalendarDay) {
  if (!day) return 'bg-muted text-muted-foreground'
  if (day.status === 'completed') return 'bg-primary text-primary-foreground'
  if (day.status === 'bonus') return 'bg-primary/70 text-primary-foreground'
  if (day.status === 'partial') return 'bg-primary/15 text-primary ring-1 ring-primary/25'
  if (day.status === 'missed') return 'bg-muted text-muted-foreground'
  if (day.status === 'future') return 'bg-muted/60 text-muted-foreground'
  return 'bg-rest/25 text-rest'
}

function WeekColumn({
  title,
  week,
  daysByDate,
  onOpenDay,
}: {
  title: string
  week: ProfileWeekDetail
  daysByDate: Map<string, ProfileCalendarDay>
  onOpenDay?: (date: string) => void
}) {
  const days = WEEKDAYS.map((_, index) => {
    const date = addDays(week.week_start, index)
    return daysByDate.get(date)
  })

  return (
    <div className="rounded-xl border border-border p-3">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{shortDate(week.week_start)}</p>
        </div>
        <div className="text-right">
          <p className="font-heading text-xl font-extrabold">
            {week.completed_days}/{week.planned_days}
          </p>
          <p className="text-xs text-muted-foreground">{Math.round(week.volume_kg).toLocaleString('es')} kg</p>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day, index) => {
          const date = addDays(week.week_start, index)
          const disabled = !day || day.status === 'future' || !onOpenDay
          const Cell = disabled ? 'span' : 'button'
          return (
            <Cell
              key={date}
              type={disabled ? undefined : 'button'}
              onClick={disabled ? undefined : () => onOpenDay(date)}
              title={`${WEEKDAYS[index]} ${shortDate(date)} · ${statusLabel(day)}${
                day?.planned_sets ? ` · ${day.done_sets}/${day.planned_sets} series` : ''
              }`}
              className={cn(
                'flex aspect-square min-w-0 items-center justify-center rounded-lg text-xs font-semibold',
                'transition-colors',
                !disabled && 'hover:ring-2 hover:ring-primary/35',
                statusClass(day),
              )}
            >
              {WEEKDAYS[index]}
            </Cell>
          )
        })}
      </div>

      <div className="mt-3 min-h-5 text-xs text-muted-foreground">
        {week.debt_sets ? (
          <span>
            Deuda: {week.debt_sets} series
            {week.partial_dates.length ? ` · Parcial: ${week.partial_dates.map(shortDate).join(', ')}` : ''}
          </span>
        ) : (
          <span>Sin faltas registradas.</span>
        )}
      </div>
    </div>
  )
}

export function WeekCompare({
  current,
  previous,
  calendar,
  onOpenDay,
}: {
  current: ProfileWeekDetail
  previous: ProfileWeekDetail
  calendar: ProfileCalendarDay[]
  onOpenDay?: (date: string) => void
}) {
  const daysByDate = new Map(calendar.map((day) => [day.date, day]))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="size-5 text-primary" />
          Semana contra semana
        </CardTitle>
        <CardDescription>Comparación rápida de adherencia, faltas y volumen.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 xl:grid-cols-2">
        <WeekColumn title="Esta semana" week={current} daysByDate={daysByDate} onOpenDay={onOpenDay} />
        <WeekColumn title="Semana anterior" week={previous} daysByDate={daysByDate} onOpenDay={onOpenDay} />
      </CardContent>
    </Card>
  )
}
