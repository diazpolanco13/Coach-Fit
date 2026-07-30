import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from 'recharts'
import { GitCompareArrows } from 'lucide-react'
import { api, type Plan, type PlanSummary } from '@/lib/api'
import { useData } from '@/components/shell/DataContext'
import { PlanCompareSkeleton } from '@/components/skeletons/PlanCompareSkeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { objectiveByLabel } from '@/lib/objectives'
import { planRoute, type Route } from '@/lib/nav'
import {
  buildCompareRadarRows,
  buildPlanProfile,
  buildSoloRadarRows,
  formatTopMuscles,
  MIN_COMPARE_AXES,
  pickCompareAxes,
  type PlanVolumeProfile,
} from '@/lib/planCompare'
import { formatSets } from '@/lib/volume'
import { cn } from '@/lib/utils'

/** Colores distinguibles en claro/oscuro; el 1º es la marca. */
const PLAN_COLORS = [
  'var(--primary)',
  'oklch(0.55 0.12 230)',
  'oklch(0.58 0.11 152)',
  'oklch(0.62 0.14 25)',
  'oklch(0.58 0.1 300)',
  'oklch(0.6 0.12 90)',
  'oklch(0.52 0.1 200)',
  'oklch(0.64 0.13 50)',
]

export function PlanCompareScreen({
  summaries,
  activePlanId,
  onNavigate,
  onActivate,
}: {
  summaries: PlanSummary[]
  activePlanId: number | null
  onNavigate: (r: Route) => void
  onActivate: (id: number) => Promise<void>
}) {
  const { exercises, gyms } = useData()
  const exMap = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises])

  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [gymFilter, setGymFilter] = useState<number | 'all'>('all')
  const [activating, setActivating] = useState<number | null>(null)

  const summaryIds = summaries.map((s) => `${s.id}:${s.updated_at}`).join('|')

  useEffect(() => {
    let cancelled = false
    const ids = summaryIds
      .split('|')
      .filter(Boolean)
      .map((part) => Number(part.split(':')[0]))
      .filter((id) => Number.isInteger(id) && id > 0)
    if (!ids.length) {
      setPlans([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    Promise.all(ids.map((id) => api.plan(id)))
      .then((loaded) => {
        if (!cancelled) setPlans(loaded)
      })
      .catch(() => {
        if (!cancelled) setError('No se pudieron cargar los planes.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [summaryIds])

  const gymOptions = useMemo(() => {
    const ids = new Set(summaries.map((s) => s.gym_id).filter((id): id is number => id != null))
    return gyms.filter((g) => ids.has(g.id))
  }, [summaries, gyms])

  const filteredPlans = useMemo(() => {
    if (gymFilter === 'all') return plans
    return plans.filter((p) => p.gym?.id === gymFilter || p.effective_gym_id === gymFilter)
  }, [plans, gymFilter])

  const profiles = useMemo(
    () => filteredPlans.map((p) => buildPlanProfile(p, exMap)),
    [filteredPlans, exMap],
  )

  const colorById = useMemo(() => {
    const map = new Map<number, string>()
    profiles.forEach((p, i) => map.set(p.plan.id, PLAN_COLORS[i % PLAN_COLORS.length]!))
    return map
  }, [profiles])

  const axes = useMemo(() => pickCompareAxes(profiles), [profiles])
  const { maxValue: sharedMax } = useMemo(
    () => buildCompareRadarRows(profiles, axes),
    [profiles, axes],
  )

  const handleActivate = async (id: number) => {
    setActivating(id)
    try {
      await onActivate(id)
    } finally {
      setActivating(null)
    }
  }

  if (loading) {
    return <PlanCompareSkeleton cards={summaries.length || 4} />
  }

  if (error) {
    return <p className="py-8 text-sm text-destructive">{error}</p>
  }

  if (!summaries.length) {
    return (
      <div className="py-10 text-center">
        <GitCompareArrows className="mx-auto size-8 text-muted-foreground" />
        <p className="mt-3 text-sm text-muted-foreground">Aún no tienes planes para comparar.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <header>
        <div className="kicker">Planes</div>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">Comparar enfoque</h1>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">
          Perfil de volumen semanal (series directas + indirectas). Úsalo para elegir el plan según
          fortalezas: torso, piernas, gym o carrera.
        </p>
      </header>

      {gymOptions.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <FilterChip active={gymFilter === 'all'} onClick={() => setGymFilter('all')}>
            Todos
          </FilterChip>
          {gymOptions.map((g) => (
            <FilterChip
              key={g.id}
              active={gymFilter === g.id}
              onClick={() => setGymFilter(g.id)}
            >
              {g.name}
            </FilterChip>
          ))}
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-2">
        {profiles.map((p) => {
          const obj = objectiveByLabel(p.plan.objective)
          const isActive = p.plan.id === activePlanId || p.plan.is_active
          const gymName = p.plan.gym?.name
          const color = colorById.get(p.plan.id)!
          return (
            <article
              key={p.plan.id}
              className="flex flex-col rounded-xl border bg-card p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ background: color }}
                    />
                    <h2 className="truncate font-semibold">{p.plan.name}</h2>
                    {isActive && <Badge variant="brand">Activo</Badge>}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {[p.plan.objective, gymName].filter(Boolean).join(' · ') || 'Sin objetivo'}
                    {obj?.hint ? ` — ${obj.hint}` : ''}
                  </p>
                </div>
              </div>

              {axes.length >= MIN_COMPARE_AXES && (
                <PlanSoloRadar profile={p} axes={axes} maxValue={sharedMax} color={color} />
              )}

              <dl className="mt-1 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <dt className="text-muted-foreground">Días</dt>
                  <dd className="tabular-nums font-medium">{p.trainingDays}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Series / sem</dt>
                  <dd className="tabular-nums font-medium">{formatSets(p.totalSets)}</dd>
                </div>
              </dl>

              <p className="mt-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Fortalezas: </span>
                {formatTopMuscles(p.topMuscles)}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onNavigate(planRoute(p.plan.id))}
                >
                  Abrir
                </Button>
                {!isActive && (
                  <Button
                    size="sm"
                    variant="default"
                    disabled={activating === p.plan.id}
                    onClick={() => handleActivate(p.plan.id)}
                  >
                    {activating === p.plan.id ? 'Activando…' : 'Activar'}
                  </Button>
                )}
              </div>
            </article>
          )
        })}
      </section>
    </div>
  )
}

function PlanSoloRadar({
  profile,
  axes,
  maxValue,
  color,
}: {
  profile: PlanVolumeProfile
  axes: string[]
  maxValue: number
  color: string
}) {
  const data = useMemo(() => buildSoloRadarRows(profile, axes), [profile, axes])
  return (
    <div className="my-2 h-[180px] w-full" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} cx="50%" cy="52%" outerRadius="62%">
          <PolarGrid stroke="var(--border)" />
          <PolarAngleAxis
            dataKey="muscle"
            tick={{ fill: 'var(--muted-foreground)', fontSize: 9 }}
          />
          <PolarRadiusAxis domain={[0, maxValue]} tick={false} axisLine={false} />
          <Radar
            name={profile.plan.name}
            dataKey="sets"
            stroke={color}
            strokeWidth={2}
            fill={color}
            fillOpacity={0.22}
            dot={{ r: 2, fill: color, strokeWidth: 0 }}
            isAnimationActive={false}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full px-3 py-1 text-xs font-medium transition-colors',
        active
          ? 'bg-primary/15 text-primary ring-1 ring-primary/30'
          : 'bg-muted text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}
