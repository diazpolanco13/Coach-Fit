import { useMemo } from 'react'
import { Footprints } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { StatRow } from '@/components/StatRow'
import { todayISO } from '@/lib/utils'

export function CardioTab({
  metricsRuns,
  runKm,
  runMin,
  onRunKmChange,
  onRunMinChange,
  onSaveRun,
}: {
  metricsRuns: Array<{
    id: number
    date: string
    distance_km: number
    duration_min?: number
    pace_min_per_km?: number
    rpe?: number
    notes?: string
  }>
  runKm: string
  runMin: string
  onRunKmChange: (v: string) => void
  onRunMinChange: (v: string) => void
  onSaveRun: () => void
}) {
  const stats = useMemo(() => {
    const monthPrefix = todayISO().slice(0, 7)
    const monthRuns = metricsRuns.filter((r) => r.date.startsWith(monthPrefix))
    const runsThisMonth = monthRuns.length
    const kmThisMonth = monthRuns.reduce((sum, r) => sum + Number(r.distance_km || 0), 0)

    const paces = metricsRuns.slice(0, 8).map((r) => r.pace_min_per_km).filter((p): p is number => p != null)
    const avgPace = paces.length ? paces.reduce((a, b) => a + b, 0) / paces.length : null

    const longestRun = metricsRuns.reduce((max, r) => Math.max(max, Number(r.distance_km || 0)), 0)
    return { runsThisMonth, kmThisMonth, avgPace, longestRun }
  }, [metricsRuns])

  return (
    <div className="space-y-4">
      <StatRow
        items={[
          { label: 'Carreras este mes', value: String(stats.runsThisMonth) },
          { label: 'Km este mes', value: stats.kmThisMonth.toFixed(1), suffix: 'km' },
          { label: 'Ritmo medio', value: stats.avgPace != null ? stats.avgPace.toFixed(1) : '—', suffix: stats.avgPace != null ? 'min/km' : undefined },
          { label: 'Carrera más larga', value: stats.longestRun ? stats.longestRun.toFixed(1) : '—', suffix: stats.longestRun ? 'km' : undefined },
        ]}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Footprints className="size-5 text-primary" /> Carreras
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Input type="number" step="0.1" placeholder="km" value={runKm} onChange={(e) => onRunKmChange(e.target.value)} />
            <Input type="number" step="1" placeholder="min" value={runMin} onChange={(e) => onRunMinChange(e.target.value)} />
          </div>
          <Button onClick={onSaveRun}>Guardar carrera</Button>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {metricsRuns.slice(0, 8).map((r) => (
              <li key={r.id}>
                {r.date}: <span className="font-medium text-foreground">{r.distance_km} km</span>
                {r.duration_min ? ` · ${r.duration_min} min` : ''}
                {r.pace_min_per_km ? ` · ${r.pace_min_per_km} min/km` : ''}
              </li>
            ))}
            {!metricsRuns.length && <li>Sin carreras aún.</li>}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
