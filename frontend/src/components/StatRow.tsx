import { cn } from '@/lib/utils'

export type StatItem = {
  label: string
  value: string
  suffix?: string
  accent?: boolean
  /** Línea corta bajo la cifra. Es lo que separa «no hay dato» de «el dato es
   *  cero»: sin ella, un volumen sin pesos registrados se lee como no haber
   *  levantado nada. */
  hint?: string
  tone?: 'warning'
}

export function StatRow({ items }: { items: StatItem[] }) {
  const cols = items.length
  return (
    <div
      className={cn(
        'grid grid-cols-2 border-b-2 border-border',
        cols <= 4 ? 'sm:grid-cols-4' : 'sm:grid-cols-3 lg:grid-cols-5',
      )}
    >
      {items.map((it, i) => (
        <div
          key={it.label}
          className={cn(
            'border-border px-4 py-3 sm:border-r sm:last:border-r-0',
            i % 2 === 0 && 'border-r',
            i >= 2 && 'border-t sm:border-t-0',
            cols > 4 && i >= 3 && 'sm:border-t lg:border-t-0',
          )}
        >
          <div className="kicker">{it.label}</div>
          <div
            className={cn(
              'font-heading text-2xl font-extrabold sm:text-3xl',
              it.accent && 'text-primary',
              it.tone === 'warning' && 'text-muted-foreground',
            )}
          >
            {it.value}
            {it.suffix && <span className="ml-1 text-sm font-normal text-muted-foreground">{it.suffix}</span>}
          </div>
          {it.hint && (
            <div
              className={cn(
                'text-[11px] leading-tight text-muted-foreground',
                it.tone === 'warning' && 'text-primary',
              )}
            >
              {it.hint}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
