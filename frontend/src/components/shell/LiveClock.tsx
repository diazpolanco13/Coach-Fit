import { useEffect, useState } from 'react'
import { formatClockDate, formatClockTime } from '@/lib/dates'
import { cn } from '@/lib/utils'

/** Fecha del mes + hora local, actualizada cada segundo. */
export function LiveClock({ className }: { className?: string }) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const dateLabel = formatClockDate(now)
  const timeLabel = formatClockTime(now)

  return (
    <time
      dateTime={now.toISOString()}
      title={`${dateLabel} · ${timeLabel}`}
      className={cn(
        'shrink-0 tabular-nums text-right text-xs leading-tight',
        className,
      )}
    >
      <span className="block font-medium text-foreground sm:inline">{dateLabel}</span>
      <span className="hidden text-muted-foreground sm:inline"> · </span>
      <span className="block text-[11px] text-muted-foreground sm:inline sm:text-xs">
        {timeLabel}
      </span>
    </time>
  )
}
