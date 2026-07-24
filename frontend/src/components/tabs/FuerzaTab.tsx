import { TrendingUp } from 'lucide-react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Exercise, MuscleTrendItem } from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MuscleTrendTable } from '@/components/MuscleTrendTable'
import { StatRow } from '@/components/StatRow'

const chartTooltipStyle = {
  backgroundColor: 'var(--popover)',
  color: 'var(--popover-foreground)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  fontSize: '12px',
}
const chartTick = { fontSize: 12, fill: 'var(--muted-foreground)' }

export function FuerzaTab({
  trends,
  staleCount,
  prCount,
  exercises,
  exerciseFrequency,
  selectedExerciseId,
  exerciseHistory,
  exerciseHistoryName,
  exerciseHistoryMax,
  onSelectExercise,
}: {
  trends: MuscleTrendItem[]
  staleCount: number
  prCount: number
  exercises: Exercise[]
  exerciseFrequency: Record<string, number>
  selectedExerciseId: string | null
  exerciseHistory: Array<{ date: string; max_weight: number; max_reps: number }>
  exerciseHistoryName: string
  exerciseHistoryMax: number | null
  onSelectExercise: (id: string) => void
}) {
  const volume28d = trends.reduce((sum, g) => sum + g.volume_kg, 0)
  const activeGroups = trends.length - staleCount
  const sortedExercises = [...exercises].sort((a, b) => a.name_es.localeCompare(b.name_es, 'es'))

  return (
    <div className="space-y-4">
      <StatRow
        items={[
          { label: 'PRs este mes', value: String(prCount) },
          { label: 'Grupos atrasados', value: String(staleCount), accent: staleCount > 0 },
          { label: 'Volumen 28d', value: Math.round(volume28d).toLocaleString('es'), suffix: 'kg' },
          { label: 'Grupos activos', value: `${activeGroups}`, suffix: `/ ${trends.length}` },
        ]}
      />

      <Card>
        <CardContent className="p-0">
          <MuscleTrendTable groups={trends} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="size-5 text-primary" />
            Progresión de carga
          </CardTitle>
          <CardDescription>Elige un ejercicio para ver su historial de peso máximo</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={selectedExerciseId ?? undefined} onValueChange={onSelectExercise}>
            <SelectTrigger>
              <SelectValue placeholder="Elige un ejercicio" />
            </SelectTrigger>
            <SelectContent>
              {sortedExercises.map((ex) => (
                <SelectItem key={ex.id} value={ex.id}>
                  {ex.name_es}
                  {exerciseFrequency[ex.id] ? ` (${exerciseFrequency[ex.id]}×)` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedExerciseId && exerciseHistory.length > 0 ? (
            <div>
              <div className="mb-2 text-sm text-muted-foreground">
                {exerciseHistoryName} · PR: {exerciseHistoryMax} kg
                {exerciseHistory.length > 1 && (
                  <span className="ml-2 text-primary">
                    (+{(exerciseHistory[exerciseHistory.length - 1].max_weight - exerciseHistory[0].max_weight).toFixed(1)} kg)
                  </span>
                )}
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={exerciseHistory} margin={{ left: 0, right: 16, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="date" tick={chartTick} />
                  <YAxis tick={chartTick} unit=" kg" domain={['auto', 'auto']} />
                  <Tooltip
                    contentStyle={chartTooltipStyle}
                    formatter={(value, _name, item) => {
                      const reps = (item as { payload?: { max_reps?: number } } | undefined)?.payload?.max_reps
                      return [`${value ?? 0} kg × ${reps ?? '?'} reps`, 'Mejor serie']
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="max_weight"
                    stroke="var(--primary)"
                    dot={{ fill: 'var(--primary)', r: 4 }}
                    activeDot={{ r: 6 }}
                    name="Peso máximo"
                    strokeWidth={2}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {selectedExerciseId ? 'Sin historial para este ejercicio aún.' : 'Elige un ejercicio arriba para ver su progresión.'}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
