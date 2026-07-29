import { useEffect, useMemo, useState } from 'react'
import {
  api,
  type Exercise,
  type MuscleCoverageItem,
  type PlanGoals,
  type PlanSummary,
  type ProgressionSuggestion,
  type SessionSet,
  type WeekDay,
  type WeekLoad,
} from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  ListOrdered,
  Pencil,
  Play,
  Undo2,
} from 'lucide-react'
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
  readyToProgress,
  summarizeDoneByExercise,
  weekDebt,
} from '@/lib/hoy'
import { formatSets, weeklyVolume } from '@/lib/volume'
import { cn, todayISO } from '@/lib/utils'

const EMPTY_SETS: SessionSet[] = []

const formatWeight = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))

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
  gymId,
  exMap,
  coverage,
  onOpenExercise,
  onMarkDay,
  onGoRegister,
  onGoTrain,
  onReorderExercises,
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
  gymId: number | null
  exMap: Map<string, Exercise>
  coverage: MuscleCoverageItem[]
  onOpenExercise: (ex: Exercise) => void
  onMarkDay: (day: WeekDay, completed: boolean) => void
  onGoRegister: (day: WeekDay) => void
  onGoTrain: (day: WeekDay) => void
  /** Persiste el orden en el plan activo. */
  onReorderExercises: (weekday: number, from: number, to: number) => void | Promise<void>
  onGoFuerza: () => void
}) {
  const trainingDaysPlanned = days.filter((d) => d.items.length > 0).length

  /** Día que la tarjeta muestra. Por defecto hoy; la tira y las flechas lo
   *  mueven sin salir de la vista. */
  const [viewDate, setViewDate] = useState<string | null>(null)
  const [reordering, setReordering] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [busyReorder, setBusyReorder] = useState(false)
  const [progressionTips, setProgressionTips] = useState<Record<string, ProgressionSuggestion>>({})
  useEffect(() => {
    if (!viewDate && todayDay) setViewDate(todayDay.date)
  }, [viewDate, todayDay])
  useEffect(() => {
    setReordering(false)
    setDragIndex(null)
  }, [viewDate])

  const viewDay = days.find((d) => d.date === viewDate) ?? todayDay
  const isViewingToday = viewDay?.date === todayDay?.date
  const today = todayISO()

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

  const debtDates = useMemo(
    () =>
      days
        .filter((d) => d.items.length && d.date <= today && d.done_sets < d.planned_sets)
        .map((d) => d.date),
    [days, today],
  )
  useEffect(() => {
    const missing = debtDates.filter((date) => date !== todayDay?.date && !daySetsCache[date])
    if (!missing.length) return
    let cancelled = false
    void Promise.all(
      missing.map((date) =>
        api
          .session(date)
          .then((res) => [date, res.sets ?? []] as const)
          .catch(() => [date, [] as SessionSet[]] as const),
      ),
    ).then((entries) => {
      if (cancelled) return
      setDaySetsCache((cache) => {
        const next = { ...cache }
        for (const [date, sets] of entries) {
          next[date] = sets
        }
        return next
      })
    })
    return () => {
      cancelled = true
    }
  }, [debtDates, daySetsCache, todayDay?.date])

  const cachedSets = !isViewingToday && viewDay ? daySetsCache[viewDay.date] : undefined
  const activeSets = useMemo(
    () => (isViewingToday ? todaySets : (cachedSets ?? EMPTY_SETS)),
    [isViewingToday, todaySets, cachedSets],
  )
  const setsByDate = useMemo(() => {
    const out = { ...daySetsCache }
    if (todayDay) out[todayDay.date] = todaySets
    return out
  }, [daySetsCache, todayDay, todaySets])
  const debtItems = useMemo(() => weekDebt(days, setsByDate, today), [days, setsByDate, today])
  const debtSeries = useMemo(
    () => debtItems.reduce((sum, item) => sum + item.missing_sets, 0),
    [debtItems],
  )
  const doneByExercise = useMemo(() => summarizeDoneByExercise(activeSets), [activeSets])
  const progressionCues = useMemo(() => {
    const setsByExercise = new Map<string, SessionSet[]>()
    for (const set of activeSets) {
      const list = setsByExercise.get(set.exercise_id) ?? []
      list.push(set)
      setsByExercise.set(set.exercise_id, list)
    }
    return viewItems
      .map((item) => readyToProgress(item, setsByExercise.get(item.exercise_id) ?? []))
      .filter((cue): cue is NonNullable<typeof cue> => cue != null)
  }, [activeSets, viewItems])
  const progressionByExercise = useMemo(
    () => new Map(progressionCues.map((cue) => [cue.exercise_id, cue])),
    [progressionCues],
  )
  const progressionKey = useMemo(
    () =>
      progressionCues
        .map((cue) => `${cue.exercise_id}:${cue.reps}:${cue.weight_kg}:${cue.rpe}`)
        .join('|'),
    [progressionCues],
  )
  useEffect(() => {
    if (!progressionCues.length) return
    let cancelled = false
    void Promise.all(
      progressionCues.map((cue) =>
        api
          .suggestProgression({
            exercise_id: cue.exercise_id,
            reps: cue.reps,
            weight_kg: cue.weight_kg,
            session_rpe: cue.rpe,
            gym_id: gymId ?? undefined,
          })
          .then((tip) => [cue.exercise_id, tip] as const)
          .catch(() => null),
      ),
    ).then((entries) => {
      if (cancelled) return
      setProgressionTips((cur) => {
        const next = { ...cur }
        for (const entry of entries) {
          if (entry) next[entry[0]] = entry[1]
        }
        return next
      })
    })
    return () => {
      cancelled = true
    }
  }, [progressionKey, progressionCues, gymId])
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
    ? (relativeLabel(viewDay.date, today) ?? longLabel(viewDay.date))
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
                  {viewItems.length > 1 && activeId != null && (
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="text-[11px] text-muted-foreground">
                        {reordering
                          ? 'Arrastra o usa las flechas. Se guarda en el plan.'
                          : null}
                      </p>
                      <Button
                        type="button"
                        variant={reordering ? 'secondary' : 'ghost'}
                        size="sm"
                        className="gap-1.5"
                        disabled={busyReorder}
                        onClick={() => setReordering((v) => !v)}
                      >
                        <ListOrdered className="size-3.5" />
                        {reordering ? 'Listo' : 'Reordenar'}
                      </Button>
                    </div>
                  )}
                  {viewItems.map((item, i) => {
                    if (!item.exercise) return null
                    const done = doneByExercise.get(item.exercise_id)
                    const progressionCue = progressionByExercise.get(item.exercise_id)
                    const progressionTip = progressionTips[item.exercise_id]
                    const progressionNote = progressionCue
                      ? progressionTip
                        ? `Listo para subir · próxima: ${progressionTip.next_reps} reps × ${formatWeight(progressionTip.next_weight_kg)} kg`
                        : `Listo para subir · ${progressionCue.top_sets}/${progressionCue.done_sets} series al tope`
                      : undefined
                    const planSuffix = `${item.sets}×${item.rep_min}–${item.rep_max}`
                    const suffix = done
                      ? `${formatDoneSummary(done)}${done.avgRpe != null ? ` · RPE ${done.avgRpe}` : ''}`
                      : planSuffix
                    if (!reordering) {
                      return (
                        <ExerciseRow
                          key={`${item.exercise_id}-${i}`}
                          ex={item.exercise}
                          onOpen={onOpenExercise}
                          suffix={suffix}
                          note={progressionNote}
                          done={Boolean(done)}
                        />
                      )
                    }
                    return (
                      <div
                        key={`${item.exercise_id}-${i}`}
                        draggable={!busyReorder}
                        onDragStart={() => setDragIndex(i)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => {
                          if (dragIndex == null || !viewDay || dragIndex === i) return
                          setBusyReorder(true)
                          void Promise.resolve(
                            onReorderExercises(viewDay.weekday, dragIndex, i),
                          ).finally(() => {
                            setBusyReorder(false)
                            setDragIndex(null)
                          })
                        }}
                        onDragEnd={() => setDragIndex(null)}
                        className={cn(
                          'flex items-center gap-1 border-b border-border last:border-b-0',
                          dragIndex === i && 'opacity-45',
                          busyReorder && 'pointer-events-none opacity-70',
                        )}
                      >
                        <span
                          className="flex size-8 shrink-0 cursor-grab items-center justify-center text-muted-foreground active:cursor-grabbing"
                          aria-hidden
                        >
                          <GripVertical className="size-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <ExerciseRow
                            ex={item.exercise}
                            onOpen={onOpenExercise}
                            suffix={suffix}
                            note={progressionNote}
                            done={Boolean(done)}
                            interactive={false}
                          />
                        </div>
                        <div className="flex shrink-0 flex-col gap-0.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            disabled={i === 0 || busyReorder}
                            aria-label="Subir"
                            onClick={() => {
                              if (!viewDay) return
                              setBusyReorder(true)
                              void Promise.resolve(
                                onReorderExercises(viewDay.weekday, i, i - 1),
                              ).finally(() => setBusyReorder(false))
                            }}
                          >
                            <ArrowUp className="size-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            disabled={i >= viewItems.length - 1 || busyReorder}
                            aria-label="Bajar"
                            onClick={() => {
                              if (!viewDay) return
                              setBusyReorder(true)
                              void Promise.resolve(
                                onReorderExercises(viewDay.weekday, i, i + 1),
                              ).finally(() => setBusyReorder(false))
                            }}
                          >
                            <ArrowDown className="size-3.5" />
                          </Button>
                        </div>
                      </div>
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
                      <Button className="gap-2" onClick={() => onGoTrain(viewDay)}>
                        <Pencil className="size-4" />
                        Seguir / editar sesión
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
                          Entrar a la sesión
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
                      {!isViewingToday && !!viewItems.length && (
                        <Button variant="outline" onClick={() => onGoRegister(viewDay)}>
                          Editar en historial
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
          {debtItems.length > 0 && (
            <Card>
              <CardContent className="space-y-3 pt-4">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="kicker flex items-center gap-1.5">
                    <AlertTriangle className="size-3.5 text-primary" />
                    Pendiente esta semana
                  </div>
                  <div className="shrink-0 text-xs text-muted-foreground">
                    {debtSeries} {debtSeries === 1 ? 'serie' : 'series'}
                  </div>
                </div>
                <div className="divide-y">
                  {debtItems.slice(0, 6).map((item) => (
                    <button
                      key={`${item.date}-${item.exercise_id}`}
                      type="button"
                      onClick={() => onGoRegister(item.day)}
                      className="flex w-full items-center justify-between gap-3 py-2 text-left hover:bg-muted/40"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">
                          {item.exercise?.name_es || item.exercise_id}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {relativeLabel(item.date, today) ?? longLabel(item.date)}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {item.done_sets}/{item.planned_sets} series
                      </span>
                    </button>
                  ))}
                </div>
                {debtItems.length > 6 && (
                  <p className="text-xs text-muted-foreground">
                    Y {debtItems.length - 6} pendiente{debtItems.length - 6 === 1 ? '' : 's'} más.
                  </p>
                )}
              </CardContent>
            </Card>
          )}
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
