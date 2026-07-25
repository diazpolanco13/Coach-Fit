import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Activity, Scale, Upload, UserRound } from 'lucide-react'
import type { BodyMetric, ProfileSummary } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { StatRow } from '@/components/StatRow'

const chartTooltipStyle = {
  backgroundColor: 'var(--popover)',
  color: 'var(--popover-foreground)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  fontSize: '12px',
}
const chartTick = { fontSize: 12, fill: 'var(--muted-foreground)' }

export type ProfileBodyDraft = {
  date: string
  weight_kg: string
  body_fat_pct: string
  muscle_pct: string
  visceral_fat: string
  water_pct: string
  bmr_kcal: string
}

function fmt(value: number | null | undefined, digits = 1): string {
  return value == null ? '—' : value.toFixed(digits)
}

function delta(value: number | null | undefined, suffix = ''): string {
  if (value == null) return '—'
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}${suffix}`
}

export function PerfilTab({
  metricsBody,
  summary,
  draft,
  onDraftChange,
  onSaveBody,
  onImportCsv,
}: {
  metricsBody: BodyMetric[]
  summary: ProfileSummary | null
  draft: ProfileBodyDraft
  onDraftChange: (field: keyof ProfileBodyDraft, value: string) => void
  onSaveBody: () => void
  onImportCsv: (file: File) => void
}) {
  const latest = summary?.composition.latest ?? metricsBody[0] ?? null
  const adherence = summary?.consistency.adherence_pct ?? 0
  const volume28d = summary?.volume.total_volume_kg ?? 0
  const chartData = useMemo(() => metricsBody.slice(0, 60).slice().reverse(), [metricsBody])
  const weekData = summary?.volume.weeks ?? []

  const compositionItems = [
    { label: 'Peso', value: fmt(latest?.weight_kg), suffix: 'kg', change: delta(summary?.composition.delta.weight_kg, ' kg') },
    { label: 'IMC', value: fmt(latest?.bmi), suffix: undefined },
    { label: 'Grasa', value: fmt(latest?.body_fat_pct), suffix: '%', change: delta(summary?.composition.delta.body_fat_pct, '%') },
    { label: 'Músculo', value: fmt(latest?.muscle_pct), suffix: '%', change: delta(summary?.composition.delta.muscle_pct, '%') },
    { label: 'Agua', value: fmt(latest?.water_pct), suffix: '%' },
    { label: 'Visceral', value: fmt(latest?.visceral_fat, 0), suffix: undefined },
    { label: 'TMB', value: fmt(latest?.bmr_kcal, 0), suffix: 'kcal' },
    { label: 'Edad metabólica', value: fmt(latest?.metabolic_age, 0), suffix: undefined },
  ]

  return (
    <div className="space-y-4">
      <StatRow
        items={[
          { label: 'Adherencia 28d', value: String(adherence), suffix: '%' },
          { label: 'Racha actual', value: String(summary?.consistency.current_streak_days ?? 0), suffix: 'días' },
          { label: 'Volumen 28d', value: Math.round(volume28d).toLocaleString('es'), suffix: 'kg' },
          { label: 'Grasa actual', value: fmt(latest?.body_fat_pct), suffix: latest?.body_fat_pct != null ? '%' : undefined },
        ]}
      />

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
            <CardDescription>Reps × peso agrupado por semana</CardDescription>
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="size-5 text-primary" />
            Composición corporal
          </CardTitle>
          <CardDescription>
            {latest ? `Última lectura ${latest.date}${latest.measured_at ? ` · ${latest.measured_at}` : ''}` : 'Importa Renpho o registra una medición'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {compositionItems.map((item) => (
              <div key={item.label} className="border-b border-border pb-2">
                <div className="kicker">{item.label}</div>
                <div className="font-heading text-2xl font-extrabold">
                  {item.value}
                  {item.suffix && <span className="ml-1 text-xs font-normal text-muted-foreground">{item.suffix}</span>}
                </div>
                {item.change && <div className="text-xs text-muted-foreground">28d {item.change}</div>}
              </div>
            ))}
          </div>

          {chartData.length > 1 ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData} margin={{ left: 0, right: 16, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" tick={chartTick} />
                <YAxis tick={chartTick} domain={['auto', 'auto']} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Line type="monotone" dataKey="weight_kg" name="Peso kg" stroke="var(--primary)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="body_fat_pct" name="Grasa %" stroke="var(--muted-foreground)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="muscle_pct" name="Músculo %" stroke="var(--accent-foreground)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">Se necesitan al menos 2 mediciones para ver tendencia.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Registrar medición</CardTitle>
          <CardDescription>Guarda lo esencial a mano o importa el CSV exportado desde Renpho.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Input type="date" value={draft.date} onChange={(e) => onDraftChange('date', e.target.value)} />
            <Input type="number" step="0.1" placeholder="Peso kg" value={draft.weight_kg} onChange={(e) => onDraftChange('weight_kg', e.target.value)} />
            <Input type="number" step="0.1" placeholder="Grasa %" value={draft.body_fat_pct} onChange={(e) => onDraftChange('body_fat_pct', e.target.value)} />
            <Input type="number" step="0.1" placeholder="Músculo %" value={draft.muscle_pct} onChange={(e) => onDraftChange('muscle_pct', e.target.value)} />
            <Input type="number" step="0.1" placeholder="Visceral" value={draft.visceral_fat} onChange={(e) => onDraftChange('visceral_fat', e.target.value)} />
            <Input type="number" step="0.1" placeholder="Agua %" value={draft.water_pct} onChange={(e) => onDraftChange('water_pct', e.target.value)} />
            <Input type="number" step="1" placeholder="TMB kcal" value={draft.bmr_kcal} onChange={(e) => onDraftChange('bmr_kcal', e.target.value)} />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button onClick={onSaveBody} disabled={!draft.weight_kg}>
              Guardar medición
            </Button>
            <label className="inline-flex">
              <Input
                type="file"
                accept=".csv,text/csv"
                className="max-w-xs"
                onChange={(e) => {
                  const file = e.currentTarget.files?.[0]
                  if (file) onImportCsv(file)
                  e.currentTarget.value = ''
                }}
              />
            </label>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Upload className="size-4" />
              El import conserva una lectura por día.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
