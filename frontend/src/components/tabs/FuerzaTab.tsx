import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  Award,
  BookOpen,
  CalendarDays,
  Dumbbell,
  RefreshCw,
  Search,
  Target,
  TrendingUp,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { StrengthDashboard, StrengthExerciseHistory } from '@/lib/api'
import type { StrengthWindow } from '@/hooks/useStrengthDashboard'
import { muscleES } from '@/lib/muscle'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { MuscleTrendTable } from '@/components/MuscleTrendTable'
import { FuerzaSkeleton } from '@/components/skeletons/FuerzaSkeleton'

const chartTooltipStyle = {
  backgroundColor: 'var(--popover)',
  color: 'var(--popover-foreground)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  fontSize: '12px',
}
const chartTick = { fontSize: 12, fill: 'var(--muted-foreground)' }
const EMPTY_EXERCISES: StrengthDashboard['exercises'] = []

function compactKg(value: number) {
  return new Intl.NumberFormat('es', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' }).format(
    new Date(`${value}T00:00:00`),
  )
}

function longDate(value: string) {
  return new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(`${value}T00:00:00`),
  )
}

function normalized(value: string) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('es')
}

export function FuerzaTab({
  days,
  onDaysChange,
  dashboard,
  loading,
  error,
  onRetry,
  selectedExerciseId,
  history,
  historyLoading,
  historyError,
  onSelectExercise,
  onOpenExercise,
}: {
  days: StrengthWindow
  onDaysChange: (days: StrengthWindow) => void
  dashboard: StrengthDashboard | null
  loading: boolean
  error: string
  onRetry: () => void | Promise<void>
  selectedExerciseId: string | null
  history: StrengthExerciseHistory | null
  historyLoading: boolean
  historyError: string
  onSelectExercise: (id: string) => void
  onOpenExercise: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const exercises = dashboard?.exercises ?? EMPTY_EXERCISES
  const selectedExercise = exercises.find((exercise) => exercise.exercise_id === selectedExerciseId) ?? null
  const visibleExercises = useMemo(() => {
    const term = normalized(query.trim())
    return exercises
      .filter((exercise) => !term || normalized(`${exercise.name} ${muscleES(exercise.muscle)}`).includes(term))
      .sort((a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name, 'es'))
      .slice(0, 24)
  }, [exercises, query])
  const historyDelta =
    history && history.history.length > 1
      ? history.history[history.history.length - 1].max_weight - history.history[0].max_weight
      : null

  if (!dashboard && loading) return <FuerzaSkeleton />

  if (!dashboard) {
    return (
      <Card className="border-destructive/30">
        <CardContent className="flex min-h-72 flex-col items-center justify-center text-center">
          <AlertTriangle className="mb-3 size-7 text-destructive" />
          <h2 className="font-heading text-lg font-bold">No pudimos cargar Fuerza</h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">{error || 'Inténtalo de nuevo en unos segundos.'}</p>
          <Button className="mt-5" onClick={() => onRetry()}>
            <RefreshCw />
            Reintentar
          </Button>
        </CardContent>
      </Card>
    )
  }

  const { summary } = dashboard
  const windowDays = dashboard.window_days
  const kpis = [
    {
      label: 'Volumen total',
      value: compactKg(summary.volume_kg),
      suffix: 'kg',
      detail:
        summary.volume_change_pct == null
          ? 'Sin período comparable'
          : `${summary.volume_change_pct > 0 ? '+' : ''}${summary.volume_change_pct}% vs. período anterior`,
      positive: (summary.volume_change_pct ?? 0) > 0,
      icon: Dumbbell,
    },
    {
      label: 'Sesiones de fuerza',
      value: String(summary.sessions),
      suffix: `en ${windowDays} días`,
      detail: `${summary.sessions_change > 0 ? '+' : ''}${summary.sessions_change} vs. período anterior`,
      positive: summary.sessions_change > 0,
      icon: CalendarDays,
    },
    {
      label: 'Récords personales',
      value: String(summary.pr_count),
      suffix: 'PRs',
      detail: summary.pr_count ? 'Nueva marca en esta ventana' : 'Tu próxima marca está cerca',
      positive: summary.pr_count > 0,
      icon: Award,
    },
    {
      label: 'Balance muscular',
      value: `${summary.active_groups}/${summary.total_groups}`,
      suffix: 'activos',
      detail: summary.stale_groups ? `${summary.stale_groups} grupos necesitan atención` : 'Todos los grupos activos',
      positive: summary.stale_groups === 0,
      icon: Target,
    },
  ]

  return (
    <div className="space-y-4">
      <section className="flex flex-col gap-4 rounded-xl border bg-gradient-to-br from-primary/[0.07] via-background to-background p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Badge variant="brand">Rendimiento</Badge>
            {loading && <RefreshCw className="size-3.5 animate-spin text-muted-foreground" />}
          </div>
          <h1 className="font-heading text-2xl font-extrabold tracking-tight">Tu fuerza, en perspectiva</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {longDate(dashboard.start)} — {longDate(dashboard.end)}
          </p>
        </div>
        <div className="flex rounded-lg border bg-background p-1 shadow-xs" aria-label="Período de análisis">
          {([14, 28, 56] as StrengthWindow[]).map((window) => (
            <Button
              key={window}
              size="sm"
              variant={days === window ? 'secondary' : 'ghost'}
              aria-pressed={days === window}
              onClick={() => onDaysChange(window)}
            >
              {window} días
            </Button>
          ))}
        </div>
      </section>

      {error && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <span>Los datos visibles podrían estar desactualizados.</span>
          <Button variant="ghost" size="sm" onClick={() => onRetry()}>
            Reintentar
          </Button>
        </div>
      )}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((item) => {
          const Icon = item.icon
          return (
            <Card key={item.label}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="kicker">{item.label}</span>
                  <span className="rounded-lg bg-primary/10 p-1.5 text-primary">
                    <Icon className="size-4" />
                  </span>
                </div>
                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className="font-heading text-2xl font-extrabold sm:text-3xl">{item.value}</span>
                  <span className="text-xs text-muted-foreground">{item.suffix}</span>
                </div>
                <p
                  className={cn(
                    'mt-1.5 text-xs',
                    item.positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground',
                  )}
                >
                  {item.detail}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </section>

      <Card>
        <CardContent className="p-0">
          <MuscleTrendTable groups={dashboard.muscle_groups} windowDays={windowDays} />
        </CardContent>
      </Card>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="size-5 text-primary" />
              Volumen semanal
            </CardTitle>
            <CardDescription>Tonelaje completado y tendencia dentro de la ventana</CardDescription>
          </CardHeader>
          <CardContent>
            {dashboard.weekly_volume.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={dashboard.weekly_volume} margin={{ left: 0, right: 12, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="week_start" tick={chartTick} tickFormatter={shortDate} />
                  <YAxis tick={chartTick} tickFormatter={compactKg} width={44} />
                  <Tooltip
                    contentStyle={chartTooltipStyle}
                    labelFormatter={(value) => `Semana del ${shortDate(String(value))}`}
                    formatter={(value, name) => [
                      name === 'Volumen' ? `${Number(value ?? 0).toLocaleString('es')} kg` : value,
                      name,
                    ]}
                  />
                  <Bar dataKey="volume_kg" name="Volumen" fill="var(--primary)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-64 flex-col items-center justify-center text-center">
                <Dumbbell className="mb-2 size-6 text-muted-foreground" />
                <p className="text-sm font-medium">Aún no hay volumen registrado</p>
                <p className="mt-1 text-xs text-muted-foreground">Completa series con peso para activar este gráfico.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="size-5 text-primary" />
              Récords recientes
            </CardTitle>
            <CardDescription>Mejores marcas alcanzadas en los últimos {windowDays} días</CardDescription>
          </CardHeader>
          <CardContent>
            {dashboard.prs.length ? (
              <div className="space-y-2">
                {dashboard.prs.map((pr) => (
                  <button
                    key={`${pr.exercise_id}-${pr.date}`}
                    type="button"
                    className="flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-muted/50"
                    onClick={() => onSelectExercise(pr.exercise_id)}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{pr.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {shortDate(pr.date)} · {pr.reps ? `${pr.reps} reps` : 'mejor serie'}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-heading text-lg font-bold">{pr.weight_kg} kg</p>
                      <Badge variant="brand">
                        {pr.improvement_kg == null ? 'Primer registro' : `+${pr.improvement_kg} kg`}
                      </Badge>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex h-64 flex-col items-center justify-center text-center">
                <Award className="mb-2 size-6 text-muted-foreground" />
                <p className="text-sm font-medium">Sin PRs en esta ventana</p>
                <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                  Mantén la constancia: una nueva mejor marca aparecerá aquí automáticamente.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="size-5 text-primary" />
                Progresión por ejercicio
              </CardTitle>
              <CardDescription>Explora solo ejercicios que ya registraste</CardDescription>
            </div>
            {selectedExercise && (
              <Button variant="outline" size="sm" onClick={() => onOpenExercise(selectedExercise.exercise_id)}>
                <BookOpen />
                Ver guía
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {exercises.length ? (
            <div className="grid lg:grid-cols-[290px_1fr]">
              <div className="border-b p-4 lg:border-r lg:border-b-0">
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Buscar ejercicio o músculo"
                    className="pl-8"
                  />
                </div>
                <div className="mt-3 max-h-72 space-y-1 overflow-y-auto pr-1 lg:max-h-[360px]">
                  {visibleExercises.map((exercise) => (
                    <Button
                      key={exercise.exercise_id}
                      variant={selectedExerciseId === exercise.exercise_id ? 'secondary' : 'ghost'}
                      className="h-auto w-full justify-between px-2.5 py-2 text-left"
                      onClick={() => onSelectExercise(exercise.exercise_id)}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{exercise.name}</span>
                        <span className="block truncate text-xs font-normal text-muted-foreground">
                          {muscleES(exercise.muscle)} · {exercise.sessions}× en la ventana
                        </span>
                      </span>
                      <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                        {exercise.all_time_max_weight != null ? `${exercise.all_time_max_weight} kg` : '—'}
                      </span>
                    </Button>
                  ))}
                  {!visibleExercises.length && (
                    <p className="py-8 text-center text-sm text-muted-foreground">No encontramos coincidencias.</p>
                  )}
                </div>
              </div>

              <div className="min-w-0 p-4 sm:p-5">
                {selectedExercise && (
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-heading text-lg font-bold">{selectedExercise.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {muscleES(selectedExercise.muscle)} · última sesión {shortDate(selectedExercise.last_date)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="outline">PR {selectedExercise.all_time_max_weight ?? '—'} kg</Badge>
                      {historyDelta != null && (
                        <Badge variant={historyDelta > 0 ? 'brand' : 'outline'}>
                          {historyDelta > 0 ? '+' : ''}
                          {historyDelta.toFixed(1)} kg
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                {historyLoading ? (
                  <div className="h-72 animate-pulse rounded-xl bg-muted" />
                ) : historyError ? (
                  <div className="flex h-72 flex-col items-center justify-center text-center">
                    <AlertTriangle className="mb-2 size-5 text-destructive" />
                    <p className="text-sm font-medium">No se pudo cargar el historial</p>
                    <p className="mt-1 text-xs text-muted-foreground">{historyError}</p>
                  </div>
                ) : history && history.history.length ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={history.history} margin={{ left: 0, right: 16, top: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="date" tick={chartTick} tickFormatter={shortDate} />
                      <YAxis tick={chartTick} unit=" kg" domain={['auto', 'auto']} width={48} />
                      <Tooltip
                        contentStyle={chartTooltipStyle}
                        labelFormatter={(value) => longDate(String(value))}
                        formatter={(value, _name, item) => {
                          const reps = (item as { payload?: { max_reps?: number | null } } | undefined)?.payload
                            ?.max_reps
                          return [`${value ?? 0} kg${reps ? ` × ${reps} reps` : ''}`, 'Mejor serie']
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="max_weight"
                        stroke="var(--primary)"
                        dot={{ fill: 'var(--primary)', r: 3 }}
                        activeDot={{ r: 6 }}
                        name="Peso máximo"
                        strokeWidth={2.5}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-72 flex-col items-center justify-center text-center">
                    <Dumbbell className="mb-2 size-6 text-muted-foreground" />
                    <p className="text-sm font-medium">Sin historial de carga</p>
                    <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                      Este ejercicio fue registrado sin peso. Añade una carga para ver su progresión.
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex min-h-72 flex-col items-center justify-center p-6 text-center">
              <Dumbbell className="mb-2 size-6 text-muted-foreground" />
              <p className="text-sm font-medium">Aún no hay ejercicios registrados</p>
              <p className="mt-1 text-xs text-muted-foreground">Completa tu primera sesión para empezar a medir progreso.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
