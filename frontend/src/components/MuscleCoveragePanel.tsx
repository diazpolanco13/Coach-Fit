import type { MuscleCoverageItem } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { laggingMuscles } from '@/lib/hoy'
import { muscleES } from '@/lib/muscle'

export function MuscleCoveragePanel({
  groups,
  onSeeMore,
}: {
  groups: MuscleCoverageItem[]
  onSeeMore: () => void
}) {
  const lagging = laggingMuscles(groups)
  const trained = groups.filter((g) => g.sessions > 0).length

  return (
    <div className="p-4">
      <div className="flex items-baseline justify-between gap-2">
        <div className="kicker">Más atrasados · 14 días</div>
        <Button variant="link" size="sm" onClick={onSeeMore} className="-mr-1 shrink-0 px-1">
          Ver Fuerza →
        </Button>
      </div>

      {lagging.length ? (
        <div className="mt-3 space-y-1.5 text-sm">
          {lagging.map((g) => (
            <div key={g.muscle} className="flex items-baseline justify-between gap-2">
              <span className="truncate">{muscleES(g.muscle)}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {g.days_since_last == null ? 'sin datos' : `${g.days_since_last} días`}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          Todos los grupos han recibido trabajo en los últimos 14 días.
        </p>
      )}

      <p className="mt-3 border-t border-border pt-2.5 text-xs text-muted-foreground">
        {trained} {trained === 1 ? 'grupo entrenado' : 'grupos entrenados'} en la ventana.
      </p>
    </div>
  )
}
