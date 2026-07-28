import { useEffect, useMemo, useState } from 'react'
import {
  api,
  type Exercise,
  type MuscleCoverageItem,
  type PlanGoals,
  type PlanSummary,
  type SessionSet,
  type WeekDay,
  type WeekLoad,
} from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowRight, CheckCircle2, ChevronLeft, ChevronRight, Pencil, Play, Undo2 } from 'lucide-react'
import { ExerciseRow } from '@/components/ExerciseRow'
import { MuscleCoveragePanel } from '@/components/MuscleCoveragePanel'
import { StatRow, type StatItem } from '@/components/StatRow'
import { TodayTrainedPanel } from '@/components/hoy/TodayTrainedPanel'
import { WeekProgressPanel } from '@/components/hoy/WeekProgressPanel'
import { WeekStrip } from '@/components/hoy/WeekStrip'
import { estimateDayMinutes, formatDayMinutes } from '@/lib/dayTime'
import { longLabel, relativeLabel } from '@/lib/dates'
import {
  daySets,
  doneCountByExercise,
  doneSetsAsDays,
  formatDoneSummary,
  nextTrainingDay,
  summarizeDoneByExercise,
} from '@/lib/hoy'
import { formatSets, weeklyVolume } from '@/lib/volume'
import { todayISO } from '@/lib/utils'

const EMPTY_SETS: SessionSet[] = []

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
}) {
  const trainingDaysPlanned = days.filter((d) => d.items.length > 0).length

  /** Día que la tarjeta muestra. Por defecto hoy; la tira y las flechas lo
   *  mueven sin salir de la vista. */
  const [viewDate, setViewDate] = useState<string | null>(null)
  useEffect(() => {
    if (!viewDate && todayDay) setViewDate(todayDay.date)
  }, [viewDate, todayDay])

  const viewDay = days.find((d) => d.date === viewDate) ?? todayDay
  const isViewingToday = viewDay?.date === todayDay?.date

  // El `?? []` sin memo crea un array nuevo por render y vuelve inútiles los
  // useMemo que dependen de él.
  const viewItems = useMemo(() => viewDay?.items ?? [], [viewDay])
  const nextDay = useMemo(() => nextTrainingDay(days, viewDay?.date), [days, viewDay?.date])
  const plannedSets = useMemo(() => days.reduce((n, d) => n + daySets(d), 0), [days])

  /** Series del día en pantalla: las de hoy ya vienen por props; otro día se
   *  pide una vez y se cachea, así pasear por la semana no encadena requests. */
  const [daySetsCache, setDaySetsCache] = useState<Record<string, SessionSet[]>>({})
  useEffect(() => setDaySetsCache({}), [todaySets])
  useEffect(() => {
    const date = viewDay?.date
    if (!date || isViewingToday || daySetsCache[date]) return
    let cancelled = false
    api
      .session(date)
      .then((res) => {
        if (cancelled) return
        setDaySetsCache((c) => ({ ...c, [date]: res.sets ?? [] }))
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [viewDay?.date, isViewingToday, daySetsCache])

  const cachedSets = !isViewingToday && viewDay ? daySetsCache[viewDay.date] : undefined
  const activeSets = useMemo(
    () => (isViewingToday ? todaySets : (cachedSets ?? EMPTY_SETS)),
    [isViewingToday, todaySets, cachedSets],
  )
  const doneByExercise = useMemo(() => summarizeDoneByExercise(activeSets), [activeSets])
  const doneCount = useMemo(() => activeSets.filter((s) => s.done).length, [activeSets])
  const plannedCount = useMemo(() => viewItems.reduce((n, i) => n + i.sets, 0), [viewItems])

  const muscleChips = useMemo(() => {
    if (!doneCount) return []
    const counts = doneCountByExercise(activeSets)
    return weeklyVolume(doneSetsAsDays(counts, exMap), exMap, indirectWeight)
      .filter((v) => v.programmed && v.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 4)
  }, [activeSets, doneCount, exMap, indirectWeight])

  const sessionDone = Boolean(viewDay?.completed || doneCount > 0)

  const dates = useMemo(() => days.map((d) => d.date), [days])
  const shiftDay = (delta: number) => {
    if (!viewDay || !dates.length) return
    const idx = dates.indexOf(viewDay.date)
    setViewDate(dates[(idx + delta + dates.length) % dates.length])
  }

  const dayLabel = viewDay
    ? (relativeLabel(viewDay.date, todayISO()) ?? longLabel(viewDay.date))
    : 'Hoy'

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
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 shrink-0"
                  onClick={() => shiftDay(-1)}
                  aria-label="Día anterior"
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <div className="kicker min-w-0 flex-1 text-center">
                  {dayLabel} · {sessionDone ? 'completado' : 'pendiente'}
                  {viewDay?.session_rpe != null ? ` · RPE ${viewDay.session_rpe}` : ''}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 shrink-0"
                  onClick={() => shiftDay(1)}
                  aria-label="Día siguiente"
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>

              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h1 className="text-3xl leading-tight font-heading font-extrabold">
                  {viewDay?.label || 'Hoy'}
                </h1>
                {!isViewingToday && todayDay && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setViewDate(todayDay.date)}
                  >
                    <Undo2 className="size-3.5" />
                    Volver a hoy
                  </Button>
                )}
              </div>
              {planName && <p className="text-sm text-muted-foreground">Plan activo: {planName}</p>}

              {doneCount > 0 && (
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
                    {doneCount}
                    {plannedCount ? `/${plannedCount}` : ''} series
                  </span>
                </div>
              )}

              {viewItems.length ? (
                <div>
                  {viewItems.map((item, i) => {
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
                  <p className="text-sm text-muted-foreground">
                    {isViewingToday ? 'Hoy descansas.' : 'Día de descanso.'}
                  </p>
                  {nextDay ? (
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{nextDay.label}</div>
                        <div className="text-xs text-muted-foreground">
                          {nextDay.items.length} ej. · {daySets(nextDay)} series ·{' '}
                          {formatDayMinutes(estimateDayMinutes(nextDay, 90))}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => setViewDate(nextDay.date)}
                      >
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

              {viewDay && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {sessionDone ? (
                    <>
                      <Button className="gap-2" onClick={() => onGoRegister(viewDay)}>
                        <Pencil className="size-4" />
                        Editar series
                      </Button>
                      <Button
                        variant="outline"
                        className="gap-2"
                        onClick={() => onMarkDay(viewDay, !viewDay.completed)}
                      >
                        <CheckCircle2 className="size-4" />
                        {viewDay.completed ? 'Desmarcar día' : 'Marcar entrenado'}
                      </Button>
                    </>
                  ) : (
                    <>
                      {!!viewItems.length && (
                        <Button className="gap-2" onClick={() => onGoTrain(viewDay)}>
                          <Play className="size-4" />
                          Empezar entrenamiento
                        </Button>
                      )}
                      <Button
                        variant={viewItems.length ? 'outline' : 'default'}
                        className="gap-2"
                        onClick={() => onMarkDay(viewDay, !viewDay.completed)}
                      >
                        <CheckCircle2 className="size-4" />
                        {viewDay.completed ? 'Desmarcar día' : 'Marcar entrenado'}
                      </Button>
                      {isViewingToday && (
                        <Button variant="outline" onClick={() => onGoRegister(viewDay)}>
                          Registrar series
                        </Button>
                      )}
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <WeekStrip
            days={days}
            todayDate={todayDay?.date}
            selectedDate={viewDay?.date}
            plans={plans}
            activeId={activeId}
            objective={objective}
            onSelectDay={(d) => setViewDate(d.date)}
          />
        </div>

        <div className="flex flex-col gap-4">
          <TodayTrainedPanel
            days={days}
            weeklySets={weeklySets}
            todaySets={todaySets}
            goals={goals}
            exMap={exMap}
            indirectWeight={indirectWeight}
            sessionRpe={todayDay?.session_rpe ?? null}
          />
          <WeekProgressPanel
            days={days}
            weeklySets={weeklySets}
            goals={goals}
            indirectWeight={indirectWeight}
            exMap={exMap}
          />
          <Card>
            <CardContent className="p-0">
              <MuscleCoveragePanel groups={coverage} onSeeMore={onGoFuerza} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
