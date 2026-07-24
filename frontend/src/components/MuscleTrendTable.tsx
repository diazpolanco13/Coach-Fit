import { TrendingDown, TrendingUp } from 'lucide-react'
import type { MuscleTrendItem } from '@/lib/api'
import { muscleES } from '@/lib/muscle'
import { cn } from '@/lib/utils'

export function MuscleTrendTable({ groups }: { groups: MuscleTrendItem[] }) {
  const sorted = [...groups].sort((a, b) => b.volume_kg - a.volume_kg)

  return (
    <div className="p-4">
      <div className="kicker mb-3">Tendencia muscular · 28 días</div>
      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 gap-y-2.5 text-sm">
        <div className="kicker text-[10px]">Músculo</div>
        <div className="kicker text-right text-[10px]">Sesiones</div>
        <div className="kicker text-right text-[10px]">Volumen</div>
        <div className="kicker text-right text-[10px]">Tendencia</div>
        {sorted.map((g) => {
          const warn = g.sessions === 0
          const trend = g.trend_pct
          const up = trend != null && trend > 0
          const down = trend != null && trend < 0
          return (
            <div key={g.muscle} className="contents">
              <span className={cn('truncate', warn && 'font-semibold text-primary')}>{muscleES(g.muscle)}</span>
              <span className={cn('text-right text-muted-foreground', warn && 'font-semibold text-primary')}>
                {g.sessions}
              </span>
              <span className="text-right text-muted-foreground">{Math.round(g.volume_kg)} kg</span>
              <span
                className={cn(
                  'flex items-center justify-end gap-1 text-right',
                  up && 'text-emerald-600 dark:text-emerald-400',
                  down && 'text-rose-600 dark:text-rose-400',
                  trend == null && 'text-muted-foreground',
                )}
              >
                {up && <TrendingUp className="size-3.5" />}
                {down && <TrendingDown className="size-3.5" />}
                {trend != null ? `${trend > 0 ? '+' : ''}${Math.round(trend)}%` : '—'}
              </span>
            </div>
          )
        })}
        {!sorted.length && <p className="col-span-4 py-8 text-center text-sm text-muted-foreground">Sin datos aún.</p>}
      </div>
    </div>
  )
}
