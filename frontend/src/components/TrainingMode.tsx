import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  Check,
  CheckCircle2,
  ChevronDown,
  LayoutGrid,
  List,
  Loader2,
  Minus,
  Plus,
  X,
} from 'lucide-react'
import {
  api,
  type Exercise,
  type ExerciseFeedbackMap,
  type SessionSet,
  type UserEquipment,
  type WeekDay,
} from '@/lib/api'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { MediaImg } from '@/components/MediaImg'
import { ExercisePainPicker } from '@/components/session/ExercisePainPicker'
import { RpeSessionBar } from '@/components/session/RpeSessionBar'
import { SessionCheckIn } from '@/components/session/SessionCheckIn'
import { SetListEditor, type DraftSet } from '@/components/session/SetListEditor'
import { TrainingSessionSkeleton } from '@/components/skeletons/TrainingSessionSkeleton'
import { equipmentES } from '@/lib/equipment'
import { muscleES } from '@/lib/muscle'
import {
  getAfterSet,
  getCheckInPref,
  getRestSeconds,
  getRestTimerEnabled,
  getSessionView,
  setSessionView as persistSessionView,
} from '@/lib/settings'
import {
  DEFAULT_ENERGY,
  DEFAULT_HEALTH,
  DEFAULT_MOOD,
  type EnergyId,
  type HealthId,
  type MoodId,
} from '@/lib/sessionCheckIn'
import { setKey } from '@/lib/sessionDraft'
import { sessionHandoffWarning } from '@/lib/sessionSafety'
import { cn } from '@/lib/utils'
import {
  avgRpe,
  type CompletedSet,
  dumbbellWeights,
  hydrateLog,
  initialTrainingState,
  seedExercise,
  sessionVolume,
  setsDoneFor,
  toSessionSets,
  totalSets,
  trainingReducer,
  type TrainingExercise,
} from '@/lib/training'

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

export type SessionFinishPayload = {
  sets: SessionSet[]
  sessionRpe: number
  notes: string
  mood: MoodId
  health: HealthId
  energy: EnergyId
  exerciseFeedback: ExerciseFeedbackMap
  /** Si false, no se mandan mood/health/energy para no pisar un check-in previo. */
  includeCheckIn: boolean
}

function Stepper({
  label,
  value,
  onDec,
  onInc,
}: {
  label: string
  value: string
  onDec: () => void
  onInc: () => void
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="icon" onClick={onDec} aria-label={`${label} menos`}>
          <Minus className="size-4" />
        </Button>
        <div className="flex-1 text-center font-heading text-2xl font-extrabold tabular-nums">{value}</div>
        <Button type="button" variant="outline" size="icon" onClick={onInc} aria-label={`${label} más`}>
          <Plus className="size-4" />
        </Button>
      </div>
    </div>
  )
}

function ExerciseStrip({
  exs,
  log,
  ti,
  stripHint,
  onSelect,
  onMove,
}: {
  exs: TrainingExercise[]
  log: CompletedSet[]
  ti: number
  stripHint: boolean
  onSelect: (ti: number) => void
  onMove: (from: number, to: number) => void
}) {
  const [open, setOpen] = useState(false)
  const current = exs[ti]
  const done = current ? setsDoneFor(current.exercise_id, log) : 0

  useEffect(() => {
    if (stripHint) setOpen(true)
  }, [stripHint])

  return (
    <div
      className={cn(
        'border-b bg-muted/30',
        stripHint && 'ring-2 ring-inset ring-primary/50',
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-muted/50"
      >
        {current && (
          <div className="size-8 shrink-0 overflow-hidden rounded-md border border-border bg-white">
            <MediaImg
              image={current.image}
              gif={current.gif}
              alt=""
              className="h-full w-full object-contain p-0.5"
            />
          </div>
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            {stripHint ? 'Elige el siguiente' : 'Orden de hoy'}
          </span>
          <span className="block truncate text-xs font-semibold">
            {current?.name_es ?? '—'}
            <span className="ml-1.5 font-normal text-muted-foreground tabular-nums">
              {done}/{current?.sets ?? 0} · {ti + 1}/{exs.length}
            </span>
          </span>
        </span>
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && (
        <div className="px-3 pb-2">
          <div className="mb-1.5 flex justify-end gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              disabled={ti <= 0}
              aria-label="Subir ejercicio"
              onClick={() => onMove(ti, ti - 1)}
            >
              <ArrowUp className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              disabled={ti >= exs.length - 1}
              aria-label="Bajar ejercicio"
              onClick={() => onMove(ti, ti + 1)}
            >
              <ArrowDown className="size-3.5" />
            </Button>
          </div>
          <div className="scrollbar-thin flex gap-2 overflow-x-auto pb-0.5">
            {exs.map((ex, i) => {
              const d = setsDoneFor(ex.exercise_id, log)
              const complete = d >= ex.sets
              const active = i === ti
              return (
                <button
                  key={ex.exercise_id}
                  type="button"
                  onClick={() => {
                    onSelect(i)
                    setOpen(false)
                  }}
                  className={cn(
                    'flex min-w-[8.5rem] max-w-[11rem] shrink-0 items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition-colors',
                    active && 'border-primary bg-primary text-primary-foreground',
                    !active && complete && 'border-primary/30 bg-primary/5',
                    !active && !complete && 'hover:bg-muted',
                  )}
                >
                  <div
                    className={cn(
                      'size-10 shrink-0 overflow-hidden rounded-md border bg-white',
                      active ? 'border-primary-foreground/30' : 'border-border',
                    )}
                  >
                    <MediaImg
                      image={ex.image}
                      gif={ex.gif}
                      alt=""
                      className="h-full w-full object-contain p-0.5"
                    />
                  </div>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold leading-tight">
                      {ex.name_es}
                    </span>
                    <span
                      className={cn(
                        'block text-[11px] tabular-nums',
                        active ? 'text-primary-foreground/80' : 'text-muted-foreground',
                      )}
                    >
                      {d}/{ex.sets}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function draftRowsForExercise(ex: TrainingExercise, log: CompletedSet[]): {
  sets: DraftSet[]
  logged: Set<string>
} {
  const done = log
    .filter((s) => s.exercise_id === ex.exercise_id)
    .sort((a, b) => a.set_index - b.set_index)
  const count = Math.max(ex.sets, done.length, 1)
  const sets: DraftSet[] = []
  const logged = new Set<string>()
  for (let i = 1; i <= count; i++) {
    const found = done.find((s) => s.set_index === i)
    const row: DraftSet = {
      idx: i - 1,
      exercise_id: ex.exercise_id,
      set_index: i,
      reps: found?.reps ?? ex.reps,
      weight_kg: found?.weight_kg ?? (ex.weight_kg || undefined),
      rpe: found?.rpe ?? 7,
      done: Boolean(found),
    }
    sets.push(row)
    if (found) logged.add(setKey(row))
  }
  return { sets, logged }
}

export function TrainingMode({
  day,
  gymId,
  onExit,
  onFinish,
}: {
  day: WeekDay
  /** Espacio del que sale el material. Es el del PLAN, no el del selector: si
   *  estás mirando otro espacio mientras entrenas, el stepper de mancuernas
   *  tiene que seguir ofreciendo las tuyas. */
  gymId: number | null
  onExit: () => void
  onFinish: (payload: SessionFinishPayload) => Promise<void>
}) {
  const [equipment, setEquipment] = useState<UserEquipment[]>([])
  const [state, dispatch] = useReducer(trainingReducer, initialTrainingState)
  const [rpe, setRpe] = useState(7)
  const [sessionRpe, setSessionRpe] = useState(7)
  const [sessionNotes, setSessionNotes] = useState('')
  const [mood, setMood] = useState<MoodId>(DEFAULT_MOOD)
  const [health, setHealth] = useState<HealthId>(DEFAULT_HEALTH)
  const [energy, setEnergy] = useState<EnergyId>(DEFAULT_ENERGY)
  const [feedback, setFeedback] = useState<ExerciseFeedbackMap>({})
  const [checkInTouched, setCheckInTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [listExerciseId, setListExerciseId] = useState<string | null>(null)
  const restSeconds = useMemo(() => (getRestTimerEnabled() ? getRestSeconds() : 0), [])
  const afterSet = useMemo(() => getAfterSet(), [])
  const checkInPref = useMemo(() => getCheckInPref(), [])

  useEffect(() => {
    if (gymId == null) return
    let cancelled = false
    api
      .gyms()
      .then((res) => {
        if (cancelled) return
        setEquipment(res.gyms.find((g) => g.id === gymId)?.equipment ?? [])
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [gymId])

  useEffect(() => {
    let cancelled = false
    const weights = dumbbellWeights(equipment)
    Promise.all([
      Promise.all(
        day.items.map((item) =>
          api
            .dashboardExerciseHistory(item.exercise_id)
            .then((h) => h.history[h.history.length - 1])
            .catch(() => undefined),
        ),
      ),
      api
        .session(day.date)
        .then((s) => s)
        .catch(() => null),
    ]).then(([lasts, saved]) => {
      if (cancelled) return
      const sets = saved?.sets ?? []
      const log = hydrateLog(sets, day.items)
      const byExercise = new Map<string, CompletedSet[]>()
      for (const s of log) {
        const cur = byExercise.get(s.exercise_id)
        if (cur) cur.push(s)
        else byExercise.set(s.exercise_id, [s])
      }
      if (saved) {
        setSessionRpe(saved.session_rpe || 7)
        setSessionNotes(saved.notes || '')
        if (saved.mood) setMood(saved.mood as MoodId)
        if (saved.health) setHealth(saved.health as HealthId)
        if (saved.energy) setEnergy(saved.energy as EnergyId)
        if (saved.exercise_feedback) setFeedback(saved.exercise_feedback)
      }
      dispatch({
        type: 'INIT',
        exs: day.items.map((item, i) =>
          seedExercise(item, lasts[i], weights, byExercise.get(item.exercise_id)),
        ),
        log,
        view: getSessionView(),
        now: Date.now(),
      })
    })
    return () => {
      cancelled = true
    }
  }, [day, equipment])

  useEffect(() => {
    if (state.phase !== 'rest') return
    const t = setTimeout(() => dispatch({ type: 'TICK' }), 1000)
    return () => clearTimeout(t)
  }, [state.phase, state.restLeft])

  useEffect(() => {
    if (state.phase === 'done') setSessionRpe(avgRpe(state.log) || sessionRpe)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al pasar a done
  }, [state.phase])

  const [exitOpen, setExitOpen] = useState(false)
  const unsaved = state.log.length - state.hydrated
  const handleExit = useCallback(() => {
    if (unsaved <= 0) onExit()
    else setExitOpen(true)
  }, [unsaved, onExit])

  const handleSave = async () => {
    setSaving(true)
    try {
      const pref = checkInPref
      const includeCheckIn =
        pref === 'always' || (pref === 'touched' && checkInTouched)
      await onFinish({
        sets: toSessionSets(state.log),
        sessionRpe,
        notes: sessionNotes,
        mood: includeCheckIn ? mood : DEFAULT_MOOD,
        health: includeCheckIn ? health : DEFAULT_HEALTH,
        energy: includeCheckIn ? energy : DEFAULT_ENERGY,
        exerciseFeedback: feedback,
        includeCheckIn,
      })
    } finally {
      setSaving(false)
    }
  }

  const ex = state.exs[state.ti]
  const previousEx =
    state.ti > 0 && state.si === 0 ? state.exs[state.ti - 1] : null
  const handoffWarning = useMemo(() => {
    if (!previousEx || !ex || state.si !== 0) return null
    const prevItem = day.items.find((it) => it.exercise_id === previousEx.exercise_id)
    const curItem = day.items.find((it) => it.exercise_id === ex.exercise_id)
    if (!prevItem || !curItem) return null
    const previousSets = state.log.filter((s) => s.exercise_id === previousEx.exercise_id)
    const maxRpe = Math.max(...previousSets.map((s) => s.rpe), 0)
    const hitRepCeiling = previousSets.some((s) => s.reps >= prevItem.rep_max)
    const effectiveRpe = hitRepCeiling ? Math.max(maxRpe, 8) : maxRpe
    return sessionHandoffWarning(prevItem.exercise, effectiveRpe, curItem.exercise)
  }, [day.items, ex, previousEx, state.log, state.si])

  const plannedSets = totalSets(state.exs)
  const doneSets = state.log.length
  const isBodyweight = ex?.equipment === 'body weight'
  const durationMin = Math.max(1, Math.round(((state.finishedAt ?? Date.now()) - state.startedAt) / 60000))
  const exerciseComplete = ex ? state.si >= ex.sets : false

  const exMap = useMemo(() => {
    const m: Record<string, Exercise> = {}
    for (const item of day.items) {
      if (item.exercise) m[item.exercise_id] = item.exercise
    }
    return m
  }, [day.items])

  const listEx = listExerciseId
    ? state.exs.find((e) => e.exercise_id === listExerciseId)
    : null
  const listDraft = listEx ? draftRowsForExercise(listEx, state.log) : null
  const listPlanItem = listExerciseId
    ? day.items.find((it) => it.exercise_id === listExerciseId)
    : undefined

  const syncListSets = (
    exerciseId: string,
    rows: SessionSet[],
    logged: Set<string>,
  ) => {
    const completed: CompletedSet[] = rows
      .filter((s) => logged.has(setKey(s)))
      .map((s) => ({
        exercise_id: s.exercise_id,
        set_index: s.set_index,
        reps: s.reps ?? 0,
        weight_kg: s.weight_kg ?? 0,
        rpe: s.rpe ?? 7,
      }))
    dispatch({ type: 'REPLACE_EXERCISE_SETS', exerciseId, sets: completed })
  }

  const showCheckIn = checkInPref !== 'skip'

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <ConfirmDialog
        open={exitOpen}
        onOpenChange={setExitOpen}
        title="¿Salir del entrenamiento?"
        description="Se perderán las series que aún no hayas guardado. Las que ya estaban registradas se conservan."
        confirmLabel="Salir"
        cancelLabel="Seguir entrenando"
        destructive
        onConfirm={onExit}
      />
      <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <div className="kicker truncate">{day.label}</div>
          <div className="text-sm text-muted-foreground">
            {state.phase === 'loading'
              ? 'Preparando…'
              : state.phase === 'done'
                ? 'Entrenamiento completado'
                : `Ejercicio ${state.ti + 1} de ${state.exs.length} · ${doneSets}/${plannedSets} series` +
                  (state.hydrated ? ` · ${state.hydrated} ya registradas` : '')}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {state.phase !== 'loading' && state.phase !== 'done' && (
            <>
              <Button
                type="button"
                variant={state.view === 'focus' ? 'secondary' : 'ghost'}
                size="icon"
                className="size-9"
                aria-label="Vista foco"
                onClick={() => {
                  dispatch({ type: 'SET_VIEW', view: 'focus' })
                  persistSessionView('focus')
                }}
              >
                <LayoutGrid className="size-4" />
              </Button>
              <Button
                type="button"
                variant={state.view === 'list' ? 'secondary' : 'ghost'}
                size="icon"
                className="size-9"
                aria-label="Vista lista"
                onClick={() => {
                  dispatch({ type: 'SET_VIEW', view: 'list' })
                  persistSessionView('list')
                  setListExerciseId(null)
                }}
              >
                <List className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="hidden text-xs sm:inline-flex"
                onClick={() => dispatch({ type: 'GO_DONE', now: Date.now() })}
              >
                Cerrar
              </Button>
            </>
          )}
          <button
            type="button"
            onClick={handleExit}
            aria-label="Salir del entrenamiento"
            className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>
      </header>

      <Progress
        value={
          state.phase === 'loading'
            ? 0
            : plannedSets
              ? Math.min(100, (doneSets / plannedSets) * 100)
              : 0
        }
        className="h-1 rounded-none"
        indicatorClassName="bg-primary"
      />

      {state.phase === 'loading' ? (
        <TrainingSessionSkeleton />
      ) : (
        <>
      {state.phase !== 'done' && state.exs.length > 0 && (
        <ExerciseStrip
          exs={state.exs}
          log={state.log}
          ti={state.ti}
          stripHint={state.stripHint}
          onSelect={(i) => {
            dispatch({ type: 'SELECT_EXERCISE', ti: i })
            if (state.view === 'list') setListExerciseId(state.exs[i]?.exercise_id ?? null)
          }}
          onMove={(from, to) => dispatch({ type: 'REORDER', from, to })}
        />
      )}

      <main className="scrollbar-thin flex-1 overflow-auto p-4">
        {state.view === 'list' && state.phase !== 'done' && (
          <div className="mx-auto flex max-w-lg flex-col gap-3">
            {!listEx && (
              <div className="grid grid-cols-2 gap-3">
                {state.exs.map((e, i) => {
                  const done = setsDoneFor(e.exercise_id, state.log)
                  return (
                    <button
                      key={e.exercise_id}
                      type="button"
                      onClick={() => {
                        dispatch({ type: 'SELECT_EXERCISE', ti: i })
                        setListExerciseId(e.exercise_id)
                      }}
                      className="rounded-lg border p-3 text-left transition-colors hover:border-primary/40 hover:bg-muted/40"
                    >
                      <div className="truncate text-sm font-medium">{e.name_es}</div>
                      <div className="text-xs text-muted-foreground tabular-nums">
                        {done}/{e.sets} series
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
            {listEx && listDraft && (
              <SetListEditor
                exerciseId={listEx.exercise_id}
                exercise={exMap[listEx.exercise_id]}
                planItem={listPlanItem}
                sets={listDraft.sets}
                logged={listDraft.logged}
                onUpdate={(idx, patch) => {
                  const rows = listDraft.sets.map((s) =>
                    s.idx === idx ? { ...s, ...patch } : s,
                  )
                  const logged = new Set(listDraft.logged)
                  const row = rows.find((s) => s.idx === idx)
                  if (row) logged.add(setKey(row))
                  syncListSets(listEx.exercise_id, rows, logged)
                }}
                onToggleLogged={(idx) => {
                  const row = listDraft.sets.find((s) => s.idx === idx)
                  if (!row) return
                  const logged = new Set(listDraft.logged)
                  const k = setKey(row)
                  if (logged.has(k)) logged.delete(k)
                  else logged.add(k)
                  syncListSets(listEx.exercise_id, listDraft.sets, logged)
                }}
                onToggleAll={() => {
                  const all = listDraft.sets.every((s) => listDraft.logged.has(setKey(s)))
                  const logged = new Set<string>()
                  if (!all) for (const s of listDraft.sets) logged.add(setKey(s))
                  syncListSets(listEx.exercise_id, listDraft.sets, logged)
                }}
                onAddSet={() => {
                  const last = listDraft.sets[listDraft.sets.length - 1]
                  const next: DraftSet = {
                    idx: listDraft.sets.length,
                    exercise_id: listEx.exercise_id,
                    set_index: listDraft.sets.length + 1,
                    reps: last?.reps ?? listEx.reps,
                    weight_kg: last?.weight_kg ?? listEx.weight_kg,
                    rpe: last?.rpe ?? 7,
                    done: true,
                  }
                  const rows = [...listDraft.sets, next]
                  const logged = new Set(listDraft.logged).add(setKey(next))
                  syncListSets(listEx.exercise_id, rows, logged)
                }}
                onRemoveSet={(setIndex) => {
                  const remapped: DraftSet[] = []
                  const newLogged = new Set<string>()
                  let n = 0
                  for (const s of listDraft.sets) {
                    if (s.set_index === setIndex) continue
                    const moved = { ...s, set_index: ++n, idx: n - 1 }
                    remapped.push(moved)
                    if (listDraft.logged.has(setKey(s))) newLogged.add(setKey(moved))
                  }
                  syncListSets(listEx.exercise_id, remapped, newLogged)
                }}
                onRemoveExercise={() => {
                  dispatch({ type: 'REMOVE_EXERCISE', exerciseId: listEx.exercise_id })
                  setListExerciseId(null)
                }}
                onBack={() => setListExerciseId(null)}
                onOpenGuide={() => undefined}
                onSuggestProgression={() => undefined}
                feedback={feedback}
                onFeedbackChange={(next) => {
                  setFeedback(next)
                  setCheckInTouched(true)
                }}
              />
            )}
          </div>
        )}

        {state.view === 'focus' && state.phase === 'work' && ex && (
          <div className="mx-auto flex max-w-md flex-col gap-4">
            <div className="overflow-hidden rounded-xl border bg-white">
              <MediaImg
                image={ex.image}
                gif={ex.gif}
                alt={ex.name_es}
                preferGif
                pendingClassName="mx-auto min-h-56 w-full"
                className="mx-auto max-h-56 min-h-56 w-full object-contain"
              />
            </div>

            <div>
              <h2 className="font-heading text-2xl leading-tight font-extrabold">{ex.name_es}</h2>
              <p className="text-sm text-muted-foreground">
                {muscleES(ex.target)} · {equipmentES(ex.equipment)}
              </p>
            </div>

            {handoffWarning && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
                <p className="font-medium">{handoffWarning.message}</p>
                <p className="mt-1 text-xs">{handoffWarning.suggestion}</p>
              </div>
            )}

            <div className="flex gap-2">
              {Array.from({ length: ex.sets }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex size-9 items-center justify-center rounded-lg border text-sm font-semibold',
                    i < state.si && 'border-primary/30 bg-primary/10 text-primary',
                    i === state.si && !exerciseComplete && 'border-primary bg-primary text-primary-foreground',
                    (i > state.si || exerciseComplete) && i >= state.si && 'text-muted-foreground',
                    exerciseComplete && i < ex.sets && 'border-primary/30 bg-primary/10 text-primary',
                  )}
                >
                  {i < state.si || exerciseComplete ? <Check className="size-4" /> : i + 1}
                </div>
              ))}
            </div>

            {exerciseComplete ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Series de este ejercicio completadas. Elige otro en la franja o cierra la sesión.
                </p>
                <ExercisePainPicker
                  exerciseId={ex.exercise_id}
                  exercise={exMap[ex.exercise_id]}
                  feedback={feedback}
                  onChange={(next) => {
                    setFeedback(next)
                    setCheckInTouched(true)
                  }}
                />
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => dispatch({ type: 'GO_DONE', now: Date.now() })}
                >
                  Ir al cierre
                </Button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Stepper
                    label="Reps"
                    value={String(ex.reps)}
                    onDec={() => dispatch({ type: 'ADJUST', field: 'reps', delta: -1 })}
                    onInc={() => dispatch({ type: 'ADJUST', field: 'reps', delta: 1 })}
                  />
                  <Stepper
                    label={isBodyweight ? 'Kg lastre' : 'Kg'}
                    value={ex.weight_kg ? String(ex.weight_kg) : '—'}
                    onDec={() => dispatch({ type: 'ADJUST', field: 'weight_kg', delta: -1 })}
                    onInc={() => dispatch({ type: 'ADJUST', field: 'weight_kg', delta: 1 })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>RPE de la serie</Label>
                  <div className="flex gap-1.5">
                    {[6, 7, 8, 9, 10].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setRpe(v)}
                        className={cn(
                          'h-10 flex-1 rounded-lg border text-sm font-semibold transition-colors',
                          rpe === v ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted',
                        )}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">1 muy fácil · 10 al fallo.</p>
                </div>

                <Button
                  size="lg"
                  className="w-full gap-2"
                  onClick={() =>
                    dispatch({
                      type: 'COMPLETE_SET',
                      rpe,
                      restSeconds,
                      advance: afterSet,
                      now: Date.now(),
                    })
                  }
                >
                  <Check className="size-5" />
                  Completar serie {state.si + 1} de {ex.sets}
                </Button>
              </>
            )}
          </div>
        )}

        {state.view === 'focus' && state.phase === 'rest' && ex && (
          <div className="mx-auto flex max-w-md flex-col items-center gap-5 pt-6 text-center">
            <div className="kicker">Descanso</div>
            <div className="font-heading text-7xl font-extrabold tabular-nums text-primary">
              {mmss(state.restLeft)}
            </div>
            <Progress
              value={state.restTotal ? (state.restLeft / state.restTotal) * 100 : 0}
              className="h-2 w-full"
              indicatorClassName="bg-primary"
            />
            <p className="text-sm text-muted-foreground">
              Siguiente:{' '}
              <strong className="text-foreground">{ex.name_es}</strong>
              {state.si < ex.sets ? ` · serie ${state.si + 1} de ${ex.sets}` : ' · elige otro ejercicio'}
            </p>
            {handoffWarning && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
                <p className="font-medium">{handoffWarning.message}</p>
                <p className="mt-1 text-xs">{handoffWarning.suggestion}</p>
              </div>
            )}
            <div className="flex w-full gap-2">
              <Button variant="outline" className="flex-1" onClick={() => dispatch({ type: 'ADD_REST', seconds: 30 })}>
                +30 s
              </Button>
              <Button className="flex-1" onClick={() => dispatch({ type: 'SKIP_REST' })}>
                Saltar descanso
              </Button>
            </div>
          </div>
        )}

        {state.phase === 'done' && (
          <div className="mx-auto flex max-w-md flex-col gap-4">
            <div className="space-y-1 pt-4 text-center">
              <CheckCircle2 className="mx-auto size-12 text-primary" />
              <h2 className="font-heading text-2xl font-extrabold">¡Entrenamiento completado!</h2>
              <p className="text-sm text-muted-foreground">
                Revisa y guarda para que cuente en tu carga semanal.
              </p>
            </div>

            <div className="grid grid-cols-3 border-y border-border">
              <div className="border-r border-border px-3 py-3">
                <div className="kicker">Series</div>
                <div className="font-heading text-2xl font-extrabold">{doneSets}</div>
              </div>
              <div className="border-r border-border px-3 py-3">
                <div className="kicker">Volumen</div>
                <div className="font-heading text-2xl font-extrabold">
                  {Math.round(sessionVolume(state.log)).toLocaleString('es')}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">kg</span>
                </div>
              </div>
              <div className="px-3 py-3">
                <div className="kicker">Duración</div>
                <div className="font-heading text-2xl font-extrabold">
                  {durationMin}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">min</span>
                </div>
              </div>
            </div>

            <RpeSessionBar
              value={sessionRpe}
              onChange={(n) => {
                setSessionRpe(n)
                setCheckInTouched(true)
              }}
            />

            {showCheckIn && (
              <SessionCheckIn
                mood={mood}
                health={health}
                energy={energy}
                onMood={(v) => {
                  setMood(v)
                  setCheckInTouched(true)
                }}
                onHealth={(v) => {
                  setHealth(v)
                  setCheckInTouched(true)
                }}
                onEnergy={(v) => {
                  setEnergy(v)
                  setCheckInTouched(true)
                }}
              />
            )}

            <div className="space-y-1.5">
              <Label>Notas</Label>
              <Input
                value={sessionNotes}
                onChange={(e) => setSessionNotes(e.target.value)}
                placeholder="Cómo te sentiste"
              />
            </div>

            {Object.keys(feedback).length > 0 && (
              <p className="text-xs text-muted-foreground">
                Hay notas de molestia en {Object.keys(feedback).length}{' '}
                {Object.keys(feedback).length === 1 ? 'ejercicio' : 'ejercicios'}.
              </p>
            )}

            <Button size="lg" className="w-full gap-2" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="size-5 animate-spin" /> : <Check className="size-5" />}
              Guardar sesión
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                dispatch({ type: 'RESUME_EDIT' })
                persistSessionView('list')
                setListExerciseId(null)
              }}
            >
              Seguir editando series
            </Button>
          </div>
        )}
      </main>
        </>
      )}
    </div>
  )
}
