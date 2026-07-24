import { cn } from '@/lib/utils'

export type StatItem = {
  label: string
  value: string
  suffix?: string
  accent?: boolean
}

export function StatRow({ items }: { items: StatItem[] }) {
  return (
    <div className="grid grid-cols-2 border-b-2 border-border sm:grid-cols-4">
      {items.map((it, i) => (
        <div
          key={it.label}
          className={cn(
            'border-border px-4 py-3 sm:border-r sm:last:border-r-0',
            i % 2 === 0 && 'border-r',
            i >= 2 && 'border-t sm:border-t-0',
          )}
        >
          <div className="kicker">{it.label}</div>
          <div className={cn('font-heading text-2xl font-extrabold sm:text-3xl', it.accent && 'text-primary')}>
            {it.value}
            {it.suffix && <span className="ml-1 text-sm font-normal text-muted-foreground">{it.suffix}</span>}
          </div>
        </div>
      ))}
    </div>
  )
}
