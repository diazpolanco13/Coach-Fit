import { useState } from 'react'
import { CheckCircle2, Circle, TrendingDown, TrendingUp } from 'lucide-react'
import type { MuscleTrendItem } from '@/lib/api'
import { muscleES } from '@/lib/muscle'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

function needsAttention(group: MuscleTrendItem, windowDays: number) {
  return group.sessions === 0 || (group.days_since_last ?? 0) >= Math.max(7, Math.round(windowDays / 2))
}

function lastTrained(group: MuscleTrendItem) {
  if (group.days_since_last == null) return 'Sin registrar'
  if (group.days_since_last === 0) return 'Hoy'
  if (group.days_since_last === 1) return 'Ayer'
  return `Hace ${group.days_since_last} días`
}

const REGIONS = [
  {
    label: 'Empuje',
    muscles: new Set(['pectorals', 'chest', 'delts', 'deltoids', 'shoulders', 'triceps', 'serratus anterior']),
  },
  {
    label: 'Tirón',
    muscles: new Set([
      'rhomboids',
      'back',
      'biceps',
      'forearms',
      'lats',
      'upper back',
      'traps',
      'trapezius',
      'levator scapulae',
    ]),
  },
  {
    label: 'Tren inferior',
    muscles: new Set(['glutes', 'quads', 'quadriceps', 'hamstrings', 'calves', 'adductors', 'abductors']),
  },
  {
    label: 'Core',
    muscles: new Set(['abs', 'abdominals', 'core', 'obliques', 'lower back', 'spine']),
  },
]

export function MuscleTrendTable({
  groups,
  windowDays,
}: {
  groups: MuscleTrendItem[]
  windowDays: number
}) {
  const [view, setView] = useState<'summary' | 'all'>('summary')
  const attentionCount = groups.filter((group) => needsAttention(group, windowDays)).length
  const active = [...groups].filter((group) => group.sessions > 0).sort((a, b) => b.volume_kg - a.volume_kg)
  const inactive = groups.filter((group) => group.sessions === 0)
  const maxVolume = Math.max(...groups.map((group) => group.volume_kg), 1)
  const coverage = groups.length ? Math.round((active.length / groups.length) * 100) : 0
  const uncategorized = inactive.filter(
    (group) => !REGIONS.some((region) => region.muscles.has(group.muscle)),
  )

  return (
    <div className="space-y-4 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-heading text-base font-bold">Balance muscular</h2>
            {attentionCount > 0 && (
              <Badge variant="outline">
                {inactive.length ? `${inactive.length} sin actividad` : `${attentionCount} por revisar`}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Prioriza los grupos sin estímulo reciente y vigila la tendencia de volumen.
          </p>
        </div>
        <Tabs
          value={view}
          onValueChange={(value) => setView(value as 'summary' | 'all')}
        >
          <TabsList>
            <TabsTrigger value="summary">Resumen</TabsTrigger>
            <TabsTrigger value="all">Matriz</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {view === 'summary' ? (
        <>
          <div className="grid gap-4 rounded-xl border bg-muted/20 p-4 sm:grid-cols-[180px_1fr] sm:items-center">
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-heading text-3xl font-extrabold">{active.length}</span>
                <span className="text-sm text-muted-foreground">de {groups.length} activos</span>
              </div>
              <Progress value={coverage} className="mt-2" indicatorClassName="bg-emerald-600/80" />
            </div>
            <div className="border-t pt-3 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-4">
              <p className="text-sm font-medium">
                {active.length
                  ? `${active.map((group) => muscleES(group.muscle)).slice(0, 3).join(', ')} concentran tu actividad reciente.`
                  : 'Todavía no hay actividad muscular en esta ventana.'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                La matriz agrupa lo pendiente para que puedas leer el balance sin recorrer una lista.
              </p>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="kicker">Con actividad</h3>
                <Badge variant="brand">{active.length}</Badge>
              </div>
              {active.length ? (
                <div className="space-y-2">
                  {active.slice(0, 5).map((group) => {
                    const trend = group.trend_pct
                    return (
                      <div key={group.muscle} className="rounded-lg border px-3 py-2.5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                              <span className="truncate text-sm font-medium">{muscleES(group.muscle)}</span>
                            </div>
                            <p className="mt-0.5 pl-5.5 text-xs text-muted-foreground">
                              {group.sessions} {group.sessions === 1 ? 'sesión' : 'sesiones'} · {lastTrained(group)}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-sm font-semibold">{Math.round(group.volume_kg).toLocaleString('es')} kg</p>
                            <p
                              className={cn(
                                'flex items-center justify-end gap-1 text-xs',
                                trend != null && trend > 0 && 'text-emerald-600 dark:text-emerald-400',
                                trend != null && trend < 0 && 'text-rose-600 dark:text-rose-400',
                                trend == null && 'text-muted-foreground',
                              )}
                            >
                              {trend != null && trend > 0 && <TrendingUp className="size-3" />}
                              {trend != null && trend < 0 && <TrendingDown className="size-3" />}
                              {trend == null ? 'Sin comparación' : `${trend > 0 ? '+' : ''}${Math.round(trend)}%`}
                            </p>
                          </div>
                        </div>
                        <Progress
                          value={Math.round((group.volume_kg / maxVolume) * 100)}
                          className="mt-2 h-1"
                          indicatorClassName="bg-emerald-600/70"
                        />
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
                  Completa una sesión para activar este resumen.
                </div>
              )}
            </section>

            <section>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="kicker">Sin actividad en {windowDays} días</h3>
                <span className="text-xs text-muted-foreground">{inactive.length} grupos</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {REGIONS.map((region) => {
                  const regionGroups = inactive.filter((group) => region.muscles.has(group.muscle))
                  if (!regionGroups.length) return null
                  return (
                    <div key={region.label} className="rounded-lg border border-dashed p-3">
                      <p className="kicker mb-2">{region.label}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {regionGroups.map((group) => (
                          <Badge key={group.muscle} variant="secondary" className="font-normal">
                            {muscleES(group.muscle)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )
                })}
                {uncategorized.length > 0 && (
                  <div className="rounded-lg border border-dashed p-3">
                    <p className="kicker mb-2">Otros</p>
                    <div className="flex flex-wrap gap-1.5">
                      {uncategorized.map((group) => (
                        <Badge key={group.muscle} variant="secondary" className="font-normal">
                          {muscleES(group.muscle)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>
        </>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {[...groups]
            .sort((a, b) => b.sessions - a.sessions || b.volume_kg - a.volume_kg)
            .map((group) => {
              const isActive = group.sessions > 0
              return (
                <div
                  key={group.muscle}
                  className={cn(
                    'rounded-lg border px-3 py-2.5',
                    isActive ? 'border-emerald-600/20 bg-emerald-600/[0.04]' : 'border-border/70 bg-muted/20',
                  )}
                >
                  <div className="flex items-center gap-2">
                    {isActive ? (
                      <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Circle className="size-3.5 shrink-0 text-muted-foreground/60" />
                    )}
                    <span className="truncate text-sm font-medium">{muscleES(group.muscle)}</span>
                  </div>
                  <p className="mt-1 pl-5.5 text-xs text-muted-foreground">
                    {isActive
                      ? `${group.sessions}× · ${Math.round(group.volume_kg).toLocaleString('es')} kg`
                      : 'Sin actividad'}
                  </p>
                </div>
              )
            })}
        </div>
      )}
    </div>
  )
}
