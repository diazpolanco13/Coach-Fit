import { Activity, UserRound } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { ProfileSummary } from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { StatRow } from '@/components/StatRow'
import { ConsistencyCalendar } from '@/components/tabs/ConsistencyCalendar'
import { WeekCompare } from '@/components/tabs/WeekCompare'

const chartTooltipStyle = {
  backgroundColor: 'var(--popover)',
  color: 'var(--popover-foreground)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  fontSize: '12px',
}
const chartTick = { fontSize: 12, fill: 'var(--muted-foreground)' }

export function ConsistenciaTab({
  summary,
  onOpenDay,
}: {
  summary: ProfileSummary | null
  onOpenDay: (date: string) => void
}) {
  const adherence = summary?.consistency.adherence_pct ?? 0
  const volume28d = summary?.volume.total_volume_kg ?? 0
  const weekData = summary?.volume.weeks ?? []

  return (
    <div className="space-y-4">
      <StatRow
        items={[
          { label: 'Adherencia 28d', value: String(adherence), suffix: '%' },
          { label: 'Racha actual', value: String(summary?.consistency.current_streak_days ?? 0), suffix: 'días' },
          { label: 'Volumen 28d', value: Math.round(volume28d).toLocaleString('es'), suffix: 'kg' },
        ]}
      />

      {summary ? (
        <div className="grid items-stretch gap-4 md:grid-cols-2">
          <WeekCompare
            current={summary.week_compare.current}
            previous={summary.week_compare.previous}
            calendar={summary.calendar}
            onOpenDay={onOpenDay}
          />
          <ConsistencyCalendar calendar={summary.calendar} onOpenDay={onOpenDay} />
        </div>
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Completa entrenamientos para ver tu consistencia.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserRound className="size-5 text-primary" />
              Consistencia
            </CardTitle>
            <CardDescription>
              {summary
                ? `${summary.consistency.completed_planned_days}/${summary.consistency.planned_days} días del plan completados`
                : 'Sin datos de la ventana aún'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Progress value={adherence} />
            {weekData.length ? (
              <ResponsiveContainer width="100%" height={210}>
                <BarChart data={weekData} margin={{ left: 0, right: 16, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="week_start" tick={chartTick} />
                  <YAxis tick={chartTick} allowDecimals={false} />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Bar dataKey="completed_days" name="Completados" fill="var(--primary)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">Completa entrenamientos para ver consistencia semanal.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="size-5 text-primary" />
              Volumen levantado
            </CardTitle>
            <CardDescription>Reps x peso agrupado por semana</CardDescription>
          </CardHeader>
          <CardContent>
            {weekData.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={weekData} margin={{ left: 0, right: 16, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="week_start" tick={chartTick} />
                  <YAxis tick={chartTick} unit=" kg" />
                  <Tooltip contentStyle={chartTooltipStyle} formatter={(value) => [`${value ?? 0} kg`, 'Volumen']} />
                  <Bar dataKey="volume_kg" name="Volumen" fill="var(--primary)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">Registra series con peso para ver volumen.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
