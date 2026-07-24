import { useMemo } from 'react'
import { Footprints, Scale } from 'lucide-react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { StatRow } from '@/components/StatRow'
import { todayISO } from '@/lib/utils'

const chartTooltipStyle = {
  backgroundColor: 'var(--popover)',
  color: 'var(--popover-foreground)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  fontSize: '12px',
}
const chartTick = { fontSize: 12, fill: 'var(--muted-foreground)' }

export function CardioTab({
  metricsBody,
  metricsRuns,
  weight,
  runKm,
  runMin,
  onWeightChange,
  onRunKmChange,
  onRunMinChange,
  onSaveWeight,
  onSaveRun,
}: {
  metricsBody: Array<{ id: number; date: string; weight_kg: number; body_fat_pct?: number; notes?: string }>
  metricsRuns: Array<{
    id: number
    date: string
    distance_km: number
    duration_min?: number
    pace_min_per_km?: number
    rpe?: number
    notes?: string
  }>
  weight: string
  runKm: string
  runMin: string
  onWeightChange: (v: string) => void
  onRunKmChange: (v: string) => void
  onRunMinChange: (v: string) => void
  onSaveWeight: () => void
  onSaveRun: () => void
}) {
  const stats = useMemo(() => {
    const recentBody = metricsBody.slice(0, 8)
    const current = recentBody[0]?.weight_kg
    const oldest = recentBody[recentBody.length - 1]?.weight_kg
    const change = current != null && oldest != null && recentBody.length > 1 ? current - oldest : null

    const monthPrefix = todayISO().slice(0, 7)
    const runsThisMonth = metricsRuns.filter((r) => r.date.startsWith(monthPrefix)).length

    const paces = metricsRuns.slice(0, 8).map((r) => r.pace_min_per_km).filter((p): p is number => p != null)
    const avgPace = paces.length ? paces.reduce((a, b) => a + b, 0) / paces.length : null

    return { current, change, runsThisMonth, avgPace }
  }, [metricsBody, metricsRuns])

  const weightChartData = useMemo(() => metricsBody.slice(0, 30).slice().reverse(), [metricsBody])

  return (
    <div className="space-y-4">
      <StatRow
        items={[
          { label: 'Peso actual', value: stats.current != null ? String(stats.current) : '—', suffix: stats.current != null ? 'kg' : undefined },
          {
            label: 'Cambio',
            value: stats.change != null ? `${stats.change > 0 ? '+' : ''}${stats.change.toFixed(1)}` : '—',
            suffix: stats.change != null ? 'kg' : undefined,
            accent: stats.change != null && stats.change < 0,
          },
          { label: 'Carreras este mes', value: String(stats.runsThisMonth) },
          { label: 'Ritmo medio', value: stats.avgPace != null ? stats.avgPace.toFixed(1) : '—', suffix: stats.avgPace != null ? 'min/km' : undefined },
        ]}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="size-5 text-primary" /> Peso corporal
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {weightChartData.length > 1 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={weightChartData} margin={{ left: 0, right: 16, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" tick={chartTick} />
                <YAxis tick={chartTick} unit=" kg" domain={['auto', 'auto']} />
                <Tooltip contentStyle={chartTooltipStyle} formatter={(value) => [`${value ?? 0} kg`, 'Peso']} />
                <Line
                  type="monotone"
                  dataKey="weight_kg"
                  stroke="var(--primary)"
                  dot={{ fill: 'var(--primary)', r: 4 }}
                  activeDot={{ r: 6 }}
                  strokeWidth={2}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground">Registra al menos 2 pesajes para ver el gráfico.</p>
          )}
          <div className="flex gap-2">
            <Input type="number" step="0.1" placeholder="kg" value={weight} onChange={(e) => onWeightChange(e.target.value)} />
            <Button onClick={onSaveWeight}>Guardar</Button>
          </div>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {metricsBody.slice(0, 8).map((m) => (
              <li key={m.id}>
                {m.date}: <span className="font-medium text-foreground">{m.weight_kg} kg</span>
              </li>
            ))}
            {!metricsBody.length && <li>Sin registros aún.</li>}
          </ul>
        </CardContent>
      </Card>

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
