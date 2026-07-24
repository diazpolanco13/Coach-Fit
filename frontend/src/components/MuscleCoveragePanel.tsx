import type { MuscleCoverageItem } from '@/lib/api'
import { Progress } from '@/components/ui/progress'
import { muscleES } from '@/lib/muscle'
import { cn } from '@/lib/utils'

export function MuscleCoveragePanel({
  groups,
  onSeeMore,
}: {
  groups: MuscleCoverageItem[]
  onSeeMore: () => void
}) {
  const sorted = [...groups].sort((a, b) => b.pct - a.pct)
  const stale = groups
    .filter((g) => g.sessions === 0)
    .sort((a, b) => (b.days_since_last ?? 0) - (a.days_since_last ?? 0))
  const hint = stale.length
    ? `${stale.slice(0, 2).map((g) => muscleES(g.muscle)).join(' y ')} se quedan atrás — inclúyelos en tu próxima sesión.`
    : 'Buena cobertura: todos los grupos han recibido trabajo en los últimos 14 días.'

  return (
    <div className="p-4">
      <div className="flex items-baseline justify-between gap-2">
        <div className="kicker">Cobertura muscular · 14 días</div>
        <button type="button" onClick={onSeeMore} className="shrink-0 text-xs text-primary hover:underline">
          Ver Dashboard →
        </button>
      </div>
      <div className="mt-3 space-y-2.5">
        {sorted.map((g) => {
          const warn = g.sessions === 0
          return (
            <div key={g.muscle} className="grid grid-cols-[104px_1fr_auto] items-center gap-2.5 text-sm">
              <span className={cn('truncate', warn && 'font-semibold text-primary')}>{muscleES(g.muscle)}</span>
              <Progress value={g.pct} className="h-3" indicatorClassName={warn ? 'bg-primary' : undefined} />
              <span className={cn('text-xs text-muted-foreground', warn && 'font-semibold text-primary')}>
                {warn ? `${g.days_since_last ?? '—'} días sin` : `${g.sessions} ses.`}
              </span>
            </div>
          )
        })}
      </div>
      <p className="mt-3 border-t border-border pt-2.5 text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}
