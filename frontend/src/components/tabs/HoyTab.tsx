import { useMemo } from 'react'
import type {
  Exercise,
  MuscleCoverageItem,
  PlanGoals,
  PlanSummary,
  SessionSet,
  WeekDay,
  WeekLoad,
} from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowRight, CheckCircle2, Pencil, Play } from 'lucide-react'
import { ExerciseRow } from '@/components/ExerciseRow'
import { MuscleCoveragePanel } from '@/components/MuscleCoveragePanel'
import { StatRow, type StatItem } from '@/components/StatRow'
import { TodayTrainedPanel } from '@/components/hoy/TodayTrainedPanel'
import { WeekProgressPanel } from '@/components/hoy/WeekProgressPanel'
import { WeekStrip } from '@/components/hoy/WeekStrip'
import { estimateDayMinutes, formatDayMinutes } from '@/lib/dayTime'
import {
  daySets,
  doneCountByExercise,
  doneSetsAsDays,
  formatDoneSummary,
  nextTrainingDay,
  summarizeDoneByExercise,
} from '@/lib/hoy'
import { formatSets, weeklyVolume } from '@/lib/volume'

export function HoyTab({
  load,
  days,
  todayDay,
  planName,
  plans,
  activeId,
  objective,
  goals,
  indirectWeight,
  weeklySets,
  todaySets,
  exMap,
  coverage,
  onOpenExercise,
  onMarkDay,
  onGoRegister,
  onGoTrain,
  onGoFuerza,
  onGoDay,
}: {
  load: WeekLoad | null
  days: WeekDay[]
  todayDay: WeekDay | undefined
  /** Con varios planes guardados, saber cuál está corriendo importa. */
  planName: string
  plans: PlanSummary[]
  activeId: number | null
  objective: string | null
  goals: PlanGoals
  indirectWeight: number
  /** Series hechas por ejercicio esta semana, de `GET /api/dashboard/weekly-sets`. */
  weeklySets: Record<string, number>
  /** Series registradas del día de hoy (`GET /api/sessions/{day}`). */
  todaySets: SessionSet[]
  exMap: Map<string, Exercise>
  coverage: MuscleCoverageItem[]
  onOpenExercise: (ex: Exercise) => void
  onMarkDay: (day: WeekDay, completed: boolean) => void
  onGoRegister: (day: WeekDay) => void
  onGoTrain: (day: WeekDay) => void
  onGoFuerza: () => void
  onGoDay: (day: WeekDay) => void
}) {
  const trainingDaysPlanned = days.filter((d) => d.items.length > 0).length
  // El `?? []` sin memo crea un array nuevo por render y vuelve inútiles los
  // useMemo que dependen de él.
  const todayItems = useMemo(() => todayDay?.items ?? [], [todayDay])
  const nextDay = useMemo(() => nextTrainingDay(days, todayDay?.date), [days, todayDay?.date])
  const plannedSets = useMemo(() => days.reduce((n, d) => n + daySets(d), 0), [days])

  const doneByExercise = useMemo(() => summarizeDoneByExercise(todaySets), [todaySets])
  const todayDoneCount = useMemo(
    () => todaySets.filter((s) => s.done).length,
    [todaySets],
  )
  const todayPlannedCount = useMemo(
    () => todayItems.reduce((n, i) => n + i.sets, 0),
    [todayItems],
  )

  const muscleChips = useMemo(() => {
    if (!todayDoneCount) return []
    const counts = doneCountByExercise(todaySets)
    return weeklyVolume(doneSetsAsDays(counts, exMap), exMap, indirectWeight)
      .filter((v) => v.programmed && v.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 4)
  }, [todaySets, todayDoneCount, exMap, indirectWeight])

  // Con series de hoy, «más atrasados» compite con el feedback útil y además
  // el endpoint solo marca «sin datos» para grupos a cero en la ventana.
  const showLagging = todayDoneCount === 0
  const sessionDone = Boolean(todayDay?.completed || todayDoneCount > 0)

  const stats: StatItem[] = useMemo(() => {
    if (!load) return []
    const setsDone = load.total_sets
    // Con series hechas pero sin un solo peso apuntado, el volumen no es cero:
    // es desconocido. Un cero aquí se lee como «no levantaste nada», que es una
    // afirmación distinta y falsa.
    const noWeights = setsDone > 0 && load.total_volume_kg === 0
    return [
      {
        label: 'Días esta semana',
        value: String(load.training_days),
        suffix: `/ ${trainingDaysPlanned || 0}`,
      },
      {
        label: 'Series',
        value: String(setsDone),
        suffix: plannedSets ? `/ ${plannedSets}` : undefined,
      },
      noWeights
        ? { label: 'Volumen', value: '—', hint: 'sin pesos registrados', tone: 'warning' as const }
        : {
            label: 'Volumen',
            value: Math.round(load.total_volume_kg).toLocaleString('es'),
            suffix: 'kg',
          },
      load.avg_session_rpe != null
        ? { label: 'RPE medio', value: String(load.avg_session_rpe) }
        : { label: 'RPE medio', value: '—', hint: 'sin registrar', tone: 'warning' as const },
    ]
  }, [load, trainingDaysPlanned, plannedSets])

  return (
    <div className="space-y-4">
      {load && <StatRow items={stats} />}

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardContent className="space-y-3 pt-6">
              <div className="kicker">
                {todayDay?.date} · {sessionDone ? 'completado' : 'pendiente'}
                {todayDay?.session_rpe != null ? ` · RPE ${todayDay.session_rpe}` : ''}
              </div>
              <h1 className="text-3xl leading-tight font-heading font-extrabold">
                {todayDay?.label || 'Hoy'}
              </h1>
              {planName && <p className="text-sm text-muted-foreground">Plan activo: {planName}</p>}

              {todayDoneCount > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  {muscleChips.map((m) => (
                    <span
                      key={m.muscle}
                      className="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-foreground"
                    >
                      {m.muscle} {formatSets(m.total)}
                    </span>
                  ))}
                  <span className="text-xs text-muted-foreground">
                    {todayDoneCount}
                    {todayPlannedCount ? `/${todayPlannedCount}` : ''} series
                  </span>
                </div>
              )}

              {todayItems.length ? (
                <div>
                  {todayItems.map((item, i) => {
                    if (!item.exercise) return null
                    const done = doneByExercise.get(item.exercise_id)
                    const planSuffix = `${item.sets}×${item.rep_min}–${item.rep_max}`
                    const suffix = done
                      ? `${formatDoneSummary(done)}${done.avgRpe != null ? ` · RPE ${done.avgRpe}` : ''}`
                      : planSuffix
                    return (
                      <ExerciseRow
                        key={`${item.exercise_id}-${i}`}
                        ex={item.exercise}
                        onOpen={onOpenExercise}
                        suffix={suffix}
                        done={Boolean(done)}
                      />
                    )
                  })}
                </div>
              ) : (
                // Un día de descanso no es una pantalla vacía: lo accionable es
                // qué toca después, no el hueco de hoy.
                <div className="rounded-lg border bg-muted/40 p-3">
                  <p className="text-sm text-muted-foreground">Hoy descansas.</p>
                  {nextDay ? (
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{nextDay.label}</div>
                        <div className="text-xs text-muted-foreground">
                          {nextDay.items.length} ej. · {daySets(nextDay)} series ·{' '}
                          {formatDayMinutes(estimateDayMinutes(nextDay, 90))}
                        </div>
                      </div>
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => onGoDay(nextDay)}>
                        Ver
                        <ArrowRight className="size-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">
                      No quedan días con entrenamiento esta semana.
                    </p>
                  )}
                </div>
              )}

              {todayDay && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {sessionDone ? (
                    <>
                      <Button className="gap-2" onClick={() => onGoRegister(todayDay)}>
                        <Pencil className="size-4" />
                        Editar series
                      </Button>
                      <Button
                        variant="outline"
                        className="gap-2"
                        onClick={() => onMarkDay(todayDay, !todayDay.completed)}
                      >
                        <CheckCircle2 className="size-4" />
                        {todayDay.completed ? 'Desmarcar día' : 'Marcar entrenado'}
                      </Button>
                    </>
                  ) : (
                    <>
                      {!!todayItems.length && (
                        <Button className="gap-2" onClick={() => onGoTrain(todayDay)}>
                          <Play className="size-4" />
                          Empezar entrenamiento
                        </Button>
                      )}
                      <Button
                        variant={todayItems.length ? 'outline' : 'default'}
                        className="gap-2"
                        onClick={() => onMarkDay(todayDay, !todayDay.completed)}
                      >
                        <CheckCircle2 className="size-4" />
                        {todayDay.completed ? 'Desmarcar día' : 'Marcar entrenado'}
                      </Button>
                      <Button variant="outline" onClick={() => onGoRegister(todayDay)}>
                        Registrar series
                      </Button>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <WeekStrip
            days={days}
            todayDate={todayDay?.date}
            plans={plans}
            activeId={activeId}
            objective={objective}
            onSelectDay={onGoDay}
          />
        </div>

        <div className="flex flex-col gap-4">
          {todayDoneCount > 0 && (
            <TodayTrainedPanel
              sets={todaySets}
              exMap={exMap}
              indirectWeight={indirectWeight}
              sessionRpe={todayDay?.session_rpe ?? null}
            />
          )}
          <WeekProgressPanel
            days={days}
            weeklySets={weeklySets}
            goals={goals}
            indirectWeight={indirectWeight}
            exMap={exMap}
          />
          {showLagging && (
            <Card>
              <CardContent className="p-0">
                <MuscleCoveragePanel groups={coverage} onSeeMore={onGoFuerza} />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
