import { useMemo } from 'react'
import type { Exercise, SessionSet } from '@/lib/api'
import { Progress } from '@/components/ui/progress'
import { doneCountByExercise, doneSetsAsDays } from '@/lib/hoy'
import { formatSets, weeklyVolume } from '@/lib/volume'

const MAX_ROWS = 6

/** Músculos estimulados por las series hechas hoy — el espejo de
 *  WeekProgressPanel, pero ordenado por trabajo hecho, no por déficit. */
export function TodayTrainedPanel({
  sets,
  exMap,
  indirectWeight,
  sessionRpe,
}: {
  sets: SessionSet[]
  exMap: Map<string, Exercise>
  indirectWeight: number
  sessionRpe: number | null
}) {
  const rows = useMemo(() => {
    const counts = doneCountByExercise(sets)
    const volumes = weeklyVolume(doneSetsAsDays(counts, exMap), exMap, indirectWeight)
    const max = Math.max(...volumes.map((v) => v.total), 1)
    return volumes
      .filter((v) => v.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, MAX_ROWS)
      .map((v) => ({
        muscle: v.muscle,
        total: v.total,
        pct: Math.min(100, (v.total / max) * 100),
      }))
  }, [sets, exMap, indirectWeight])

  const doneSets = sets.filter((s) => s.done).length

  if (!rows.length) return null

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <div className="kicker">Hoy entrenaste</div>
        <div className="shrink-0 text-xs text-muted-foreground">
          {doneSets} {doneSets === 1 ? 'serie' : 'series'}
          {sessionRpe != null ? ` · RPE ${sessionRpe}` : ''}
        </div>
      </div>
      <div className="mt-3 space-y-2.5">
        {rows.map((r) => (
          <div key={r.muscle} className="grid grid-cols-[92px_1fr_auto] items-center gap-2.5 text-sm">
            <span className="truncate text-muted-foreground">{r.muscle}</span>
            <Progress value={r.pct} className="h-2.5" indicatorClassName="bg-primary" />
            <span className="text-xs tabular-nums text-muted-foreground">{formatSets(r.total)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
