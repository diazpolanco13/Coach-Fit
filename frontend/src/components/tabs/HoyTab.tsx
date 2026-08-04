import { useEffect, useMemo, useState } from 'react'
import {
  api,
  type Exercise,
  type ExerciseFeedbackMap,
  type ExerciseSkipsMap,
  type PlanGoals,
  type PlanSummary,
  type ProgressionSuggestion,
  type SessionSet,
  type WeekDay,
  type WeekLoad,
} from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  AlertTriangle,
  Ban,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  GripVertical,
  ListOrdered,
  Pause,
  Pencil,
  Play,
  Undo2,
} from 'lucide-react'
import { ExerciseRow } from '@/components/ExerciseRow'
import { MediaImg } from '@/components/MediaImg'
import { StatRow, type StatItem } from '@/components/StatRow'
import { ViewToggle } from '@/components/ViewToggle'
import {
  SessionScheduleChip,
  SessionScheduleEditor,
} from '@/components/hoy/SessionScheduleEditor'
import { TodayTrainedPanel } from '@/components/hoy/TodayTrainedPanel'
import { WeekProgressPanel } from '@/components/hoy/WeekProgressPanel'
import { WeekStrip } from '@/components/hoy/WeekStrip'
import { estimateDayMinutes, formatDayMinutes } from '@/lib/dayTime'
import { formatDuration } from '@/lib/sessionTime'
import {
  formatCardioDone,
  formatCardioPrescription,
  isEnduranceCardioItem,
  runForExercise,
  type CardioRun,
} from '@/lib/cardio'
import { dayHeading, relativeLabel, shortLabel } from '@/lib/dates'
import {
  daySets,
  doneCountByExercise,
  doneSetsAsDays,
  formatDoneSummary,
  nextTrainingDay,
  readyToProgress,
  summarizeDoneByExercise,
  weekDebt,
  weekSkipped,
} from '@/lib/hoy'
import {
  exerciseDayStatus,
  formatExercisePain,
  SKIP_REASON_LABEL,
  type SkipReason,
} from '@/lib/sessionCheckIn'
import {
  groupItemsBySection,
  PLAN_SECTION_BADGE,
  PLAN_SECTION_STYLE,
  resolveSection,
} from '@/lib/plan'
import { getHoyView, setHoyView, type HoyViewPref } from '@/lib/settings'
import { formatSets, weeklyVolume } from '@/lib/volume'
import { cn, todayISO } from '@/lib/utils'

const EMPTY_SETS: SessionSet[] = []
const EMPTY_FEEDBACK: ExerciseFeedbackMap = {}
const EMPTY_SKIPS: ExerciseSkipsMap = {}

type DaySnap = {
  sets: SessionSet[]
  feedback: ExerciseFeedbackMap
  skips: ExerciseSkipsMap
}

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
  todayFeedback = EMPTY_FEEDBACK,
  todaySkips = EMPTY_SKIPS,
  metricsRuns = [],
  gymId,
  exMap,
  onOpenExercise,
  onMarkDay,
  onGoRegister,
  onGoTrain,
  onReorderExercises,
  onWeekChanged,
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
  todayFeedback?: ExerciseFeedbackMap
  todaySkips?: ExerciseSkipsMap
  /** Carreras/cardio recientes; sirven para marcar hechos del día. */
  metricsRuns?: CardioRun[]
  gymId: number | null
  exMap: Map<string, Exercise>
  onOpenExercise: (ex: Exercise) => void
  onMarkDay: (day: WeekDay, completed: boolean) => void
  onGoRegister: (day: WeekDay) => void
  onGoTrain: (day: WeekDay) => void
  /** Persiste el orden en el plan activo. */
  onReorderExercises: (weekday: number, from: number, to: number) => void | Promise<void>
  /** Tras editar metadatos de sesión (horario). */
  onWeekChanged: () => void | Promise<void>
}) {
  const trainingDaysPlanned = days.filter((d) => d.items.length > 0).length

  /** Día que la tarjeta muestra. Por defecto hoy; la tira y las flechas lo
   *  mueven sin salir de la vista. */
  const [viewDate, setViewDate] = useState<string | null>(null)
  const [reordering, setReordering] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [busyReorder, setBusyReorder] = useState(false)
  const [viewMode, setViewMode] = useState<HoyViewPref>(() => getHoyView())
  const [previewGifId, setPreviewGifId] = useState<string | null>(null)
  const [progressionTips, setProgressionTips] = useState<Record<string, ProgressionSuggestion>>({})
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [scheduleBusy, setScheduleBusy] = useState(false)
  useEffect(() => {
    if (!viewDate && todayDay) setViewDate(todayDay.date)
  }, [viewDate, todayDay])
  useEffect(() => {
    setReordering(false)
    setDragIndex(null)
    setPreviewGifId(null)
  }, [viewDate])

  const chooseView = (next: HoyViewPref) => {
    setViewMode(next)
    setHoyView(next)
    setPreviewGifId(null)
    // Reordenar es de filas: al pasar a tarjetas se sale del modo.
    if (next === 'cards') {
      setReordering(false)
      setDragIndex(null)
    }
  }

  const viewDay = days.find((d) => d.date === viewDate) ?? todayDay
  const isViewingToday = viewDay?.date === todayDay?.date
  const today = todayISO()

  // El `?? []` sin memo crea un array nuevo por render y vuelve inútiles los
  // useMemo que dependen de él.
  const viewItems = useMemo(() => viewDay?.items ?? [], [viewDay])
  const viewSections = useMemo(() => groupItemsBySection(viewItems), [viewItems])
  const nextDay = useMemo(() => nextTrainingDay(days, viewDay?.date), [days, viewDay?.date])
  const plannedSets = useMemo(() => days.reduce((n, d) => n + daySets(d), 0), [days])

  /** Series del día en pantalla: las de hoy ya vienen por props; otro día se
   *  pide una vez y se cachea, así pasear por la semana no encadena requests. */
  const [daySnapCache, setDaySnapCache] = useState<Record<string, DaySnap>>({})
  useEffect(() => setDaySnapCache({}), [todaySets, todayFeedback, todaySkips])
  useEffect(() => {
    const date = viewDay?.date
    if (!date || isViewingToday || daySnapCache[date]) return
    let cancelled = false
    api
      .session(date)
      .then((res) => {
        if (cancelled) return
        setDaySnapCache((c) => ({
          ...c,
          [date]: {
            sets: res.sets ?? [],
            feedback: res.exercise_feedback ?? {},
            skips: res.exercise_skips ?? {},
          },
        }))
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [viewDay?.date, isViewingToday, daySnapCache])

  /** Días con series hechas (completos o a medias): el Avance semanal necesita
   *  sus sets al pasear con las flechas, no solo los de deuda. */
  const trainedDates = useMemo(
    () =>
      days
        .filter((d) => d.done_sets > 0 && d.date !== todayDay?.date)
        .map((d) => d.date),
    [days, todayDay?.date],
  )
  const debtDates = useMemo(
    () =>
      days
        .filter((d) => d.items.length && d.date <= today && d.done_sets < d.planned_sets)
        .map((d) => d.date),
    [days, today],
  )
  useEffect(() => {
    const missing = [...new Set([...trainedDates, ...debtDates])].filter(
      (date) => date !== todayDay?.date && !daySnapCache[date],
    )
    if (!missing.length) return
    let cancelled = false
    void Promise.all(
      missing.map((date) =>
        api
          .session(date)
          .then(
            (res) =>
              [
                date,
                {
                  sets: res.sets ?? [],
                  feedback: res.exercise_feedback ?? {},
                  skips: res.exercise_skips ?? {},
                } satisfies DaySnap,
              ] as const,
          )
          .catch(
            () =>
              [date, { sets: [], feedback: {}, skips: {} } satisfies DaySnap] as const,
          ),
      ),
    ).then((entries) => {
      if (cancelled) return
      setDaySnapCache((cache) => {
        const next = { ...cache }
        for (const [date, snap] of entries) {
          next[date] = snap
        }
        return next
      })
    })
    return () => {
      cancelled = true
    }
  }, [trainedDates, debtDates, daySnapCache, todayDay?.date])

  const cachedSnap = !isViewingToday && viewDay ? daySnapCache[viewDay.date] : undefined
  const activeSets = useMemo(
    () => (isViewingToday ? todaySets : (cachedSnap?.sets ?? EMPTY_SETS)),
    [isViewingToday, todaySets, cachedSnap],
  )
  const activeFeedback = useMemo(
    () => (isViewingToday ? todayFeedback : (cachedSnap?.feedback ?? EMPTY_FEEDBACK)),
    [isViewingToday, todayFeedback, cachedSnap],
  )
  const activeSkips = useMemo(
    () => (isViewingToday ? todaySkips : (cachedSnap?.skips ?? EMPTY_SKIPS)),
    [isViewingToday, todaySkips, cachedSnap],
  )
  const setsByDate = useMemo(() => {
    const out: Record<string, SessionSet[]> = {}
    for (const [date, snap] of Object.entries(daySnapCache)) out[date] = snap.sets
    if (todayDay) out[todayDay.date] = todaySets
    return out
  }, [daySnapCache, todayDay, todaySets])
  const feedbackByDate = useMemo(() => {
    const out: Record<string, ExerciseFeedbackMap> = {}
    for (const [date, snap] of Object.entries(daySnapCache)) out[date] = snap.feedback
    if (todayDay) out[todayDay.date] = todayFeedback
    return out
  }, [daySnapCache, todayDay, todayFeedback])
  const skipsByDate = useMemo(() => {
    const out: Record<string, ExerciseSkipsMap> = {}
    for (const [date, snap] of Object.entries(daySnapCache)) out[date] = snap.skips
    if (todayDay) out[todayDay.date] = todaySkips
    return out
  }, [daySnapCache, todayDay, todaySkips])
  const debtItems = useMemo(
    () => weekDebt(days, setsByDate, today, { feedbackByDate, skipsByDate }),
    [days, setsByDate, today, feedbackByDate, skipsByDate],
  )
  const skippedItems = useMemo(
    () => weekSkipped(days, setsByDate, feedbackByDate, skipsByDate, today),
    [days, setsByDate, feedbackByDate, skipsByDate, today],
  )
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

  const dayLabel = viewDay ? dayHeading(viewDay.date, today) : dayHeading(today, today)

  const weekTrainingMin = useMemo(
    () => days.reduce((sum, d) => sum + (d.duration_min ?? 0), 0),
    [days],
  )

  const stats: StatItem[] = useMemo(() => {
    if (!load) return []
    const setsDone = load.total_sets
    // Con series hechas pero sin un solo peso apuntado, el volumen no es cero:
    // es desconocido. Un cero aquí se lee como «no levantaste nada», que es una
    // afirmación distinta y falsa.
    const noWeights = setsDone > 0 && load.total_volume_kg === 0
    const hoursLabel = formatDuration(weekTrainingMin)
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
      hoursLabel
        ? { label: 'Horas', value: hoursLabel, accent: true }
        : { label: 'Horas', value: '—', hint: 'sin horario', tone: 'warning' as const },
      load.avg_session_rpe != null
        ? { label: 'RPE medio', value: String(load.avg_session_rpe) }
        : { label: 'RPE medio', value: '—', hint: 'sin registrar', tone: 'warning' as const },
    ]
  }, [load, trainingDaysPlanned, plannedSets, weekTrainingMin])

  return (
    <div className="space-y-4">
      {load && <StatRow items={stats} />}

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-4">
          <WeekStrip
            days={days}
            todayDate={todayDay?.date}
            selectedDate={viewDay?.date}
            plans={plans}
            activeId={activeId}
            objective={objective}
            onSelectDay={(d) => setViewDate(d.date)}
            setsByDate={setsByDate}
            feedbackByDate={feedbackByDate}
            skipsByDate={skipsByDate}
            metricsRuns={metricsRuns}
          />
          <Card>
            <CardContent className="space-y-4 pt-4 pb-4">
              <div className="flex items-start gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="mt-0.5 size-6 shrink-0"
                  onClick={() => shiftDay(-1)}
                  aria-label="Día anterior"
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
                      <h1 className="font-heading text-xl leading-tight font-extrabold sm:text-2xl">
                        {viewDay?.label || 'Hoy'}
                      </h1>
                      {!isViewingToday && todayDay && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1.5 px-2 text-xs"
                          onClick={() => setViewDate(todayDay.date)}
                        >
                          <Undo2 className="size-3.5" />
                          Hoy
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {[
                        dayLabel,
                        sessionDone ? 'completado' : 'pendiente',
                        viewDay?.session_rpe != null ? `RPE ${viewDay.session_rpe}` : null,
                        planName ? `Plan ${planName}` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>

                  {viewDay && (
                    <SessionScheduleChip
                      startedAt={viewDay.started_at}
                      durationMin={viewDay.duration_min}
                      onClick={() => setScheduleOpen(true)}
                    />
                  )}

                  {(doneCount > 0 || viewItems.length > 0) && (
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-border/60 pt-3">
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                        {doneCount > 0 && (
                          <>
                            {muscleChips.map((m) => (
                              <span
                                key={m.muscle}
                                className="rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-[11px] font-medium text-foreground"
                              >
                                {m.muscle} {formatSets(m.total)}
                              </span>
                            ))}
                            <span className="px-0.5 text-[11px] text-muted-foreground">
                              {doneCount}
                              {plannedCount ? `/${plannedCount}` : ''} series
                            </span>
                          </>
                        )}
                      </div>
                      {viewItems.length > 0 && (
                        <div className="flex shrink-0 items-center gap-1">
                          {reordering && (
                            <p className="mr-1 hidden text-[11px] text-muted-foreground sm:block">
                              Se guarda en el plan
                            </p>
                          )}
                          {viewItems.length > 1 && activeId != null && viewMode === 'list' && (
                            <Button
                              type="button"
                              variant={reordering ? 'secondary' : 'ghost'}
                              size="sm"
                              className="h-7 gap-1.5 px-2"
                              disabled={busyReorder}
                              onClick={() => setReordering((v) => !v)}
                            >
                              <ListOrdered className="size-3.5" />
                              {reordering ? 'Listo' : 'Reordenar'}
                            </Button>
                          )}
                          <ViewToggle view={viewMode} onChange={chooseView} size="sm" />
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="mt-0.5 size-6 shrink-0"
                  onClick={() => shiftDay(1)}
                  aria-label="Día siguiente"
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>

              {viewItems.length ? (
                <div>

                  {viewMode === 'cards' && !reordering ? (
                    <div className="space-y-3">
                      {viewSections.map(({ id, label, entries }) => (
                        <section
                          key={id}
                          className={cn('rounded-xl border p-2.5', PLAN_SECTION_STYLE[id])}
                        >
                          <Badge
                            variant="outline"
                            className={cn('mb-2 font-medium', PLAN_SECTION_BADGE[id])}
                          >
                            {label}
                            <span className="ml-1.5 font-normal opacity-70">{entries.length}</span>
                          </Badge>
                          <div className="grid grid-cols-3 gap-2">
                            {entries.map(({ item, index: i }) => {
                              if (!item.exercise) return null
                              const ex = item.exercise
                              const doneSummary = doneByExercise.get(item.exercise_id)
                              const run = runForExercise(
                                metricsRuns,
                                viewDay?.date ?? '',
                                item.exercise_id,
                              )
                              const cardio = isEnduranceCardioItem(item)
                              const doneCount = cardio
                                ? run
                                  ? item.sets
                                  : 0
                                : (doneSummary?.sets ?? 0)
                              const status = exerciseDayStatus(
                                doneCount,
                                activeFeedback[item.exercise_id],
                                activeSkips[item.exercise_id] as SkipReason | undefined,
                              )
                              const painLabel = formatExercisePain(activeFeedback[item.exercise_id])
                              const skipReason = activeSkips[item.exercise_id]
                              const previewing = previewGifId === item.exercise_id
                              const planSuffix = cardio
                                ? formatCardioPrescription(item)
                                : `${item.sets}×${item.rep_min}–${item.rep_max}`
                              const suffix =
                                status === 'done' && cardio && run
                                  ? formatCardioDone(run)
                                  : status === 'done' && doneSummary
                                    ? formatDoneSummary(doneSummary)
                                    : status === 'skipped'
                                      ? painLabel ||
                                        (skipReason
                                          ? SKIP_REASON_LABEL[skipReason as SkipReason]
                                          : 'Omitido')
                                      : planSuffix
                              const playBtn =
                                'flex size-7 items-center justify-center rounded-md border border-border/70 bg-background/90 text-muted-foreground shadow-sm backdrop-blur-sm transition-colors'
                              return (
                                <div
                                  key={`${item.exercise_id}-${i}`}
                                  className="overflow-hidden rounded-lg border bg-card shadow-sm"
                                >
                                  <div className="relative aspect-square bg-muted/40">
                                    <button
                                      type="button"
                                      onClick={() => onOpenExercise(ex)}
                                      className="absolute inset-0"
                                      aria-label={`Ver ${ex.name_es}`}
                                    >
                                      <MediaImg
                                        image={ex.image}
                                        gif={ex.gif}
                                        preferGif={previewing}
                                        alt={ex.name_es}
                                        className="h-full w-full object-contain p-1.5"
                                      />
                                    </button>
                                    {ex.gif && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setPreviewGifId(previewing ? null : item.exercise_id)
                                        }
                                        aria-label={
                                          previewing
                                            ? `Parar animación de ${ex.name_es}`
                                            : `Ver animación de ${ex.name_es}`
                                        }
                                        aria-pressed={previewing}
                                        className={
                                          previewing
                                            ? `absolute bottom-1.5 left-1.5 z-10 ${playBtn} border-primary bg-primary text-primary-foreground`
                                            : `absolute bottom-1.5 left-1.5 z-10 ${playBtn} hover:border-primary/50 hover:text-primary`
                                        }
                                      >
                                        {previewing ? (
                                          <Pause className="size-3 fill-current" />
                                        ) : (
                                          <Play className="size-3 fill-current" />
                                        )}
                                      </button>
                                    )}
                                    <span className="absolute top-1.5 right-1.5 z-10">
                                      {status === 'done' ? (
                                        <CheckCircle2
                                          className="size-4 text-primary drop-shadow"
                                          aria-label="Hecho"
                                        />
                                      ) : status === 'skipped' ? (
                                        <Ban
                                          className="size-4 text-amber-500 drop-shadow"
                                          aria-label="Omitido"
                                        />
                                      ) : (
                                        <Circle
                                          className="size-4 text-muted-foreground/50 drop-shadow"
                                          aria-label="Pendiente"
                                        />
                                      )}
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => onOpenExercise(ex)}
                                    className="w-full space-y-0.5 p-1.5 text-left transition hover:bg-muted/20"
                                  >
                                    <span className="line-clamp-2 block text-[11px] leading-snug font-medium text-foreground">
                                      {ex.name_es}
                                    </span>
                                    <span
                                      className={cn(
                                        'block truncate text-[10px] tabular-nums',
                                        status === 'skipped'
                                          ? 'text-amber-600 dark:text-amber-400'
                                          : 'text-muted-foreground',
                                      )}
                                    >
                                      {suffix}
                                    </span>
                                  </button>
                                </div>
                              )
                            })}
                          </div>
                        </section>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {viewSections.map(({ id, label, entries }) => (
                        <section
                          key={id}
                          className={cn('rounded-xl border p-2.5', PLAN_SECTION_STYLE[id])}
                        >
                          <Badge
                            variant="outline"
                            className={cn('mb-1.5 font-medium', PLAN_SECTION_BADGE[id])}
                          >
                            {label}
                            <span className="ml-1.5 font-normal opacity-70">{entries.length}</span>
                          </Badge>
                          <div>
                            {entries.map(({ item, index: i }, sectionPos) => {
                              if (!item.exercise) return null
                              const done = doneByExercise.get(item.exercise_id)
                              const run = runForExercise(
                                metricsRuns,
                                viewDay?.date ?? '',
                                item.exercise_id,
                              )
                              const cardio = isEnduranceCardioItem(item)
                              const doneCount = cardio
                                ? run
                                  ? item.sets
                                  : 0
                                : (done?.sets ?? 0)
                              const status = exerciseDayStatus(
                                doneCount,
                                activeFeedback[item.exercise_id],
                                activeSkips[item.exercise_id] as SkipReason | undefined,
                              )
                              const painLabel = formatExercisePain(activeFeedback[item.exercise_id])
                              const skipReason = activeSkips[item.exercise_id]
                              const progressionCue = progressionByExercise.get(item.exercise_id)
                              const progressionTip = progressionTips[item.exercise_id]
                              const progressionNote =
                                status === 'skipped'
                                  ? painLabel
                                    ? `Omitido · ${painLabel}`
                                    : skipReason
                                      ? `Omitido · ${SKIP_REASON_LABEL[skipReason as SkipReason]}`
                                      : 'Omitido'
                                  : progressionCue
                                    ? progressionTip
                                      ? `Listo para subir · próxima: ${progressionTip.next_reps} reps × ${formatWeight(progressionTip.next_weight_kg)} kg`
                                      : `Listo para subir · ${progressionCue.top_sets}/${progressionCue.done_sets} series al tope`
                                    : undefined
                              const planSuffix = cardio
                                ? formatCardioPrescription(item)
                                : `${item.sets}×${item.rep_min}–${item.rep_max}`
                              const suffix =
                                status === 'done' && cardio && run
                                  ? formatCardioDone(run)
                                  : status === 'done' && done
                                    ? `${formatDoneSummary(done)}${done.avgRpe != null ? ` · RPE ${done.avgRpe}` : ''}`
                                    : status === 'skipped'
                                      ? painLabel ||
                                        (skipReason
                                          ? SKIP_REASON_LABEL[skipReason as SkipReason]
                                          : 'Omitido')
                                      : planSuffix
                              const canMoveUp = sectionPos > 0
                              const canMoveDown = sectionPos < entries.length - 1
                              if (!reordering) {
                                return (
                                  <ExerciseRow
                                    key={`${item.exercise_id}-${i}`}
                                    ex={item.exercise}
                                    onOpen={onOpenExercise}
                                    suffix={suffix}
                                    note={progressionNote}
                                    done={status === 'done'}
                                    skipped={status === 'skipped'}
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
                                    if (
                                      resolveSection(viewItems[dragIndex]) !==
                                      resolveSection(item)
                                    ) {
                                      return
                                    }
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
                                    'flex items-center gap-1 border-b border-border/70 last:border-b-0',
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
                                      disabled={!canMoveUp || busyReorder}
                                      aria-label="Subir"
                                      onClick={() => {
                                        if (!viewDay || !canMoveUp) return
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
                                      disabled={!canMoveDown || busyReorder}
                                      aria-label="Bajar"
                                      onClick={() => {
                                        if (!viewDay || !canMoveDown) return
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
                        </section>
                      ))}
                    </div>
                  )}
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
                          {dayHeading(item.date, today)}
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
          {skippedItems.length > 0 && (
            <Card>
              <CardContent className="space-y-3 pt-4">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="kicker flex items-center gap-1.5">
                    <Ban className="size-3.5 text-amber-500" />
                    Omitidos esta semana
                  </div>
                  <div className="shrink-0 text-xs text-muted-foreground">
                    {skippedItems.length}{' '}
                    {skippedItems.length === 1 ? 'ejercicio' : 'ejercicios'}
                  </div>
                </div>
                <div className="divide-y">
                  {skippedItems.slice(0, 6).map((item) => (
                    <button
                      key={`skip-${item.date}-${item.exercise_id}`}
                      type="button"
                      onClick={() => onGoRegister(item.day)}
                      className="flex w-full items-center justify-between gap-3 py-2 text-left hover:bg-muted/40"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">
                          {item.exercise?.name_es || item.exercise_id}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {dayHeading(item.date, today)}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs text-amber-600 dark:text-amber-400">
                        {item.painLabel || SKIP_REASON_LABEL[item.reason]}
                      </span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <TodayTrainedPanel
            days={days}
            weeklySets={weeklySets}
            daySets={activeSets}
            focusLabel={
              isViewingToday
                ? 'hoy'
                : viewDay
                  ? (relativeLabel(viewDay.date, today)?.toLowerCase() ?? shortLabel(viewDay.date))
                  : 'día'
            }
            goals={goals}
            exMap={exMap}
            indirectWeight={indirectWeight}
            sessionRpe={viewDay?.session_rpe ?? null}
          />
          <WeekProgressPanel
            days={days}
            weeklySets={weeklySets}
            goals={goals}
            indirectWeight={indirectWeight}
            exMap={exMap}
          />
        </div>
      </div>

      {viewDay && (
        <SessionScheduleEditor
          open={scheduleOpen}
          onOpenChange={setScheduleOpen}
          startedAt={viewDay.started_at}
          durationMin={viewDay.duration_min}
          busy={scheduleBusy}
          onSave={async (startedAt, durationMin) => {
            setScheduleBusy(true)
            try {
              await api.saveSession({
                date: viewDay.date,
                focus: viewDay.focus,
                completed: viewDay.completed,
                started_at: startedAt,
                duration_min: durationMin,
                sets: [],
                mode: 'merge',
              })
              setScheduleOpen(false)
              await onWeekChanged()
            } finally {
              setScheduleBusy(false)
            }
          }}
        />
      )}
    </div>
  )
}
