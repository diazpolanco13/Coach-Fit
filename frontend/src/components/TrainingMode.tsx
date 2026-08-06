import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
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
import { SkipExercisePanel } from '@/components/session/SkipExercisePanel'
import { RpeSessionBar } from '@/components/session/RpeSessionBar'
import { SessionCheckIn } from '@/components/session/SessionCheckIn'
import { SessionExercisePlaylist } from '@/components/session/SessionExercisePlaylist'
import { SetListEditor, type DraftSet } from '@/components/session/SetListEditor'
import {
  CardioLogForm,
  emptyCardioLog,
  type CardioLogValues,
} from '@/components/session/CardioLogForm'
import { TrainingSessionSkeleton } from '@/components/skeletons/TrainingSessionSkeleton'
import {
  defaultSessionType,
  formatCardioPrescription,
  isEnduranceCardioItem,
  runForExercise,
  type CardioKind,
  type CardioRun,
  type CardioSessionType,
  type CardioSurface,
} from '@/lib/cardio'
import { equipmentES } from '@/lib/equipment'
import { muscleES } from '@/lib/muscle'
import { formatClock } from '@/lib/sessionTime'
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
  type ExerciseSkipsMap,
  type HealthId,
  type MoodId,
  type SkipReason,
} from '@/lib/sessionCheckIn'
import {
  REST_END_LEAD_SECONDS,
  cancelRestEndWarning,
  cueRestEndTick,
  cueRestEndWarning,
  cueRestFinished,
  cueRestStart,
  prepareRestCues,
  stopRestCues,
} from '@/lib/restCues'
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
  stepWeight,
  toSessionSets,
  totalSets,
  trainingReducer,
  type TrainingExercise,
} from '@/lib/training'

type EditDraft = {
  setIndex: number
  reps: number
  weight_kg: number
  rpe: number
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

/** Autosave parcial: series al servidor sin cerrar la sesión ni el check-in. */
export type SessionPersistPayload = {
  sets: SessionSet[]
  completed: boolean
  clearExerciseIds?: string[]
}

export type SessionFinishPayload = {
  sets: SessionSet[]
  sessionRpe: number
  notes: string
  mood: MoodId
  health: HealthId
  energy: EnergyId
  exerciseFeedback: ExerciseFeedbackMap
  exerciseSkips: ExerciseSkipsMap
  /** Si false, no se mandan mood/health/energy para no pisar un check-in previo. */
  includeCheckIn: boolean
  clearExerciseIds?: string[]
  /** Solo si la sesión aún no tenía horario; el backend hace COALESCE. */
  startedAt?: string
  durationMin?: number
}

type PersistStatus = 'idle' | 'saving' | 'saved' | 'error'

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
              const partial = !complete && d > 0
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
                    !active && complete && 'border-primary/40 bg-primary/10',
                    !active && partial && 'border-amber-500/40 bg-amber-500/10',
                    !active && !complete && !partial && 'opacity-70 hover:bg-muted hover:opacity-100',
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
                        'flex items-center gap-1 text-[11px] tabular-nums',
                        active && 'text-primary-foreground/80',
                        !active && complete && 'font-medium text-primary',
                        !active && partial && 'font-medium text-amber-700 dark:text-amber-400',
                        !active && !complete && !partial && 'text-muted-foreground',
                      )}
                    >
                      {complete && !active && (
                        <CheckCircle2 className="size-3 shrink-0" aria-hidden />
                      )}
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

function draftRowsForExercise(
  ex: TrainingExercise,
  log: CompletedSet[],
  /** Si el usuario quitó o añadió filas en el editor, no volver a rellenar
   *  hasta `ex.sets`: si no, la X parece no hacer nada. */
  rowCount?: number | null,
): {
  sets: DraftSet[]
  logged: Set<string>
} {
  const done = log
    .filter((s) => s.exercise_id === ex.exercise_id)
    .sort((a, b) => a.set_index - b.set_index)
  const count =
    rowCount != null ? Math.max(1, rowCount) : Math.max(ex.sets, done.length, 1)
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
  startExerciseId = null,
  onExit,
  onPersist,
  onFinish,
}: {
  day: WeekDay
  /** Espacio del que sale el material. Es el del PLAN, no el del selector: si
   *  estás mirando otro espacio mientras entrenas, el stepper de mancuernas
   *  tiene que seguir ofreciendo las tuyas. */
  gymId: number | null
  /** Si viene de la guía, abrir la sesión en este ejercicio. */
  startExerciseId?: string | null
  onExit: () => void
  onPersist: (payload: SessionPersistPayload) => Promise<void>
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
  const [skips, setSkips] = useState<ExerciseSkipsMap>({})
  const [skippingId, setSkippingId] = useState<string | null>(null)
  const [checkInTouched, setCheckInTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [persistStatus, setPersistStatusState] = useState<PersistStatus>('idle')
  const setPersistStatus = useCallback((s: PersistStatus) => {
    persistStatusRef.current = s
    setPersistStatusState(s)
  }, [])
  const [listExerciseId, setListExerciseId] = useState<string | null>(null)
  /** Filas visibles en el editor de lista; `null` = usar plan + log. */
  const [listRowCount, setListRowCount] = useState<number | null>(null)
  const [cardioDraft, setCardioDraft] = useState<CardioLogValues | null>(null)
  const [cardioSaving, setCardioSaving] = useState(false)
  /** Serie ya marcada que se está corrigiendo (set_index 1-based), o null. */
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null)
  const restSeconds = useMemo(() => (getRestTimerEnabled() ? getRestSeconds() : 0), [])
  const afterSet = useMemo(() => getAfterSet(), [])
  const checkInPref = useMemo(() => getCheckInPref(), [])
  const prevPhaseRef = useRef(state.phase)
  /** Si el arranque del descanso ya sonó en el gesto de completar serie. */
  const restStartFromGestureRef = useRef(false)
  /** Si ya disparó el aviso de los últimos N segundos. */
  const restEndArmedRef = useRef(false)
  const restLeftRef = useRef(state.restLeft)
  /** Si el día ya estaba marcado entrenado al abrir: el autosave no lo baja. */
  const baselineCompletedRef = useRef(false)
  /** Reloj al abrir TrainingMode; base para duración si no había horario guardado. */
  const wallStartRef = useRef({ at: formatClock(), ms: Date.now() })
  /** Horario ya persistido: al finish solo rellenamos lo que falte. */
  const savedScheduleRef = useRef<{ startedAt: string | null; durationMin: number | null }>({
    startedAt: null,
    durationMin: null,
  })
  const stateRef = useRef(state)
  stateRef.current = state
  type PersistJob = {
    log: CompletedSet[]
    clearExerciseIds: string[]
    resolve: () => void
    reject: (err: unknown) => void
  }
  const pendingPersistRef = useRef<PersistJob | null>(null)
  const persistInflightRef = useRef(false)
  const persistGenRef = useRef(0)
  const persistStatusRef = useRef<PersistStatus>('idle')
  /** Evita reaplicar el foco si el usuario ya cambió de ejercicio a mano. */
  const focusAppliedRef = useRef<string | null>(null)

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
      api.runs().catch(() => [] as CardioRun[]),
    ]).then(([lasts, saved, runs]) => {
      if (cancelled) return
      const sets = saved?.sets ?? []
      const log = hydrateLog(sets, day.items)
      // Cardio de resistencia: una tirada en `runs` cuenta como la serie del plan.
      for (const item of day.items) {
        if (!isEnduranceCardioItem(item)) continue
        if (log.some((s) => s.exercise_id === item.exercise_id)) continue
        const run = runForExercise(runs, day.date, item.exercise_id)
        if (!run) continue
        log.push({
          exercise_id: item.exercise_id,
          set_index: 1,
          reps: Math.round(Number(run.duration_min) || 0),
          weight_kg: Number(run.distance_km) || 0,
          rpe: run.rpe ?? 7,
        })
      }
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
        if (saved.exercise_skips) setSkips(saved.exercise_skips)
      }
      savedScheduleRef.current = {
        startedAt: saved?.started_at ?? null,
        durationMin: saved?.duration_min ?? null,
      }
      baselineCompletedRef.current = Boolean(saved?.completed)
      setPersistStatus(log.length ? 'saved' : 'idle')
      focusAppliedRef.current = null
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
    if (!startExerciseId || state.phase === 'loading') return
    if (focusAppliedRef.current === startExerciseId) return
    const ti = state.exs.findIndex((e) => e.exercise_id === startExerciseId)
    if (ti < 0) return
    focusAppliedRef.current = startExerciseId
    dispatch({ type: 'SELECT_EXERCISE', ti })
  }, [startExerciseId, state.phase, state.exs])

  const flushPersist = useCallback(async () => {
    // Un solo drenador a la vez; lo que se encole durante el await lo recoge
    // el mismo bucle al volver.
    if (persistInflightRef.current) return
    persistInflightRef.current = true
    try {
      while (pendingPersistRef.current) {
        const job = pendingPersistRef.current
        pendingPersistRef.current = null
        const gen = ++persistGenRef.current
        setPersistStatus('saving')
        try {
          await onPersist({
            sets: toSessionSets(job.log),
            completed: baselineCompletedRef.current,
            clearExerciseIds: job.clearExerciseIds.length
              ? job.clearExerciseIds
              : undefined,
          })
          if (gen === persistGenRef.current) {
            // Actualiza la ref al momento: handleExit lee stateRef tras await y
            // no puede esperar al re-render de React.
            stateRef.current = { ...stateRef.current, hydrated: job.log.length }
            dispatch({ type: 'MARK_PERSISTED', count: job.log.length })
            setPersistStatus('saved')
          }
          job.resolve()
        } catch (err) {
          if (gen === persistGenRef.current) setPersistStatus('error')
          job.reject(err)
        }
      }
    } finally {
      persistInflightRef.current = false
    }
  }, [onPersist])

  /** Encola un autosave. Si ya hay uno pendiente, se queda solo el más reciente
   *  (latest-wins) y une los `clearExerciseIds`. */
  const enqueuePersist = useCallback(
    (log: CompletedSet[], clearExerciseIds: string[] = []) => {
      return new Promise<void>((resolve, reject) => {
        const prev = pendingPersistRef.current
        const mergedClear = [
          ...new Set([...(prev?.clearExerciseIds ?? []), ...clearExerciseIds]),
        ]
        if (prev) prev.resolve()
        pendingPersistRef.current = {
          log,
          clearExerciseIds: mergedClear,
          resolve,
          reject,
        }
        void flushPersist()
      })
    },
    [flushPersist],
  )

  const awaitPersistIdle = useCallback(async () => {
    while (persistInflightRef.current || pendingPersistRef.current) {
      await new Promise((r) => setTimeout(r, 40))
    }
  }, [])

  /** Aplica una acción al reducer y, si cambia el log, la persiste. */
  const dispatchAndPersist = useCallback(
    (action: Parameters<typeof trainingReducer>[1], clearExerciseIds: string[] = []) => {
      const prev = stateRef.current
      const next = trainingReducer(prev, action)
      // Mantener la ref al día: dos series rápidas no pueden leer estado viejo.
      stateRef.current = next
      dispatch(action)
      if (next.log !== prev.log) {
        void enqueuePersist(next.log, clearExerciseIds).catch(() => undefined)
      }
      return next
    },
    [enqueuePersist],
  )

  useEffect(() => {
    if (state.phase !== 'rest') return
    const t = setTimeout(() => dispatch({ type: 'TICK' }), 1000)
    return () => clearTimeout(t)
  }, [state.phase, state.restLeft])

  useEffect(() => {
    if (state.phase === 'rest') restLeftRef.current = state.restLeft
  }, [state.phase, state.restLeft])

  useEffect(() => {
    const prev = prevPhaseRef.current
    prevPhaseRef.current = state.phase
    if (prev !== 'rest' && state.phase === 'rest') {
      restEndArmedRef.current = false
      if (restStartFromGestureRef.current) {
        restStartFromGestureRef.current = false
      } else {
        cueRestStart()
      }
    } else if (prev === 'rest' && state.phase !== 'rest') {
      const earlySkip =
        restLeftRef.current > REST_END_LEAD_SECONDS || !restEndArmedRef.current
      cueRestFinished({ earlySkip })
      restEndArmedRef.current = false
    }
  }, [state.phase])

  // Aviso sonoro en los últimos 3 s (duración de rest-end.ogg), sincronizado
  // con el final. Si el usuario alarga el descanso, se cancela.
  useEffect(() => {
    if (state.phase !== 'rest') return
    if (state.restLeft > REST_END_LEAD_SECONDS) {
      if (restEndArmedRef.current) {
        cancelRestEndWarning()
        restEndArmedRef.current = false
      }
      return
    }
    if (state.restLeft <= 0) return
    if (!restEndArmedRef.current) {
      restEndArmedRef.current = true
      cueRestEndWarning(state.restLeft)
    } else {
      cueRestEndTick()
    }
  }, [state.phase, state.restLeft])

  useEffect(() => () => stopRestCues(), [])

  useEffect(() => {
    // La API exige session_rpe entero (1–10). avgRpe puede devolver 7.6 y
    // el POST falla con 422: la vista no cierra ni refresca el día.
    if (state.phase === 'done') setSessionRpe(Math.round(avgRpe(state.log) || sessionRpe))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al pasar a done
  }, [state.phase])

  const [exitOpen, setExitOpen] = useState(false)
  const [saveError, setSaveError] = useState('')
  const unsaved = state.log.length - state.hydrated
  const handleExit = useCallback(async () => {
    // Drena autosaves en vuelo antes de decidir (lee refs, no closures viejos).
    await awaitPersistIdle()
    const cur = stateRef.current
    const pending = cur.log.length - cur.hydrated
    if (pending <= 0 && persistStatusRef.current !== 'error') {
      onExit()
      return
    }
    setExitOpen(true)
  }, [awaitPersistIdle, onExit])

  const handleSaveAndExit = useCallback(async () => {
    try {
      await enqueuePersist(stateRef.current.log)
      await awaitPersistIdle()
      onExit()
    } catch {
      setPersistStatus('error')
      setExitOpen(true)
    }
  }, [enqueuePersist, awaitPersistIdle, onExit])

  const handleSave = async () => {
    setSaving(true)
    setSaveError('')
    try {
      await awaitPersistIdle()
      const pref = checkInPref
      const includeCheckIn =
        pref === 'always' || (pref === 'touched' && checkInTouched)
      const saved = savedScheduleRef.current
      const elapsedMin = Math.max(
        1,
        Math.round((Date.now() - wallStartRef.current.ms) / 60_000),
      )
      await onFinish({
        sets: toSessionSets(state.log),
        sessionRpe: Math.round(sessionRpe),
        notes: sessionNotes,
        mood: includeCheckIn ? mood : DEFAULT_MOOD,
        health: includeCheckIn ? health : DEFAULT_HEALTH,
        energy: includeCheckIn ? energy : DEFAULT_ENERGY,
        exerciseFeedback: feedback,
        exerciseSkips: skips,
        includeCheckIn,
        startedAt: saved.startedAt ?? wallStartRef.current.at,
        durationMin: saved.durationMin ?? Math.min(600, elapsedMin),
      })
    } catch (e) {
      setSaveError(String((e as Error).message || e))
    } finally {
      setSaving(false)
    }
  }

  const confirmSkip = useCallback(
    (exerciseId: string, reason: SkipReason) => {
      setSkips((prev) => ({ ...prev, [exerciseId]: reason }))
      setCheckInTouched(true)
      dispatchAndPersist({ type: 'REMOVE_EXERCISE', exerciseId }, [exerciseId])
      setSkippingId(null)
      setListExerciseId(null)
    },
    [dispatchAndPersist],
  )

  const ex = state.exs[state.ti]
  const focusPlanItem = ex
    ? day.items.find((it) => it.exercise_id === ex.exercise_id)
    : undefined
  const focusIsCardio = Boolean(focusPlanItem && isEnduranceCardioItem(focusPlanItem))

  useEffect(() => {
    if (state.view !== 'focus' || state.phase !== 'work' || !focusIsCardio || !focusPlanItem) return
    const kind = (focusPlanItem.cardio_kind ?? 'carrera_libre') as CardioKind
    setCardioDraft(
      emptyCardioLog({
        kind,
        surface: (focusPlanItem.cardio_surface ?? 'aire_libre') as CardioSurface,
        session_type:
          (focusPlanItem.session_type as CardioSessionType) || defaultSessionType(kind),
        distance_km: focusPlanItem.target_km != null ? String(focusPlanItem.target_km) : '',
        duration_min: focusPlanItem.target_min != null ? String(focusPlanItem.target_min) : '',
      }),
    )
  }, [state.view, state.phase, focusIsCardio, focusPlanItem?.exercise_id])

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
  const editing = editDraft != null

  useEffect(() => {
    setEditDraft(null)
  }, [state.ti])

  const beginEditSet = useCallback(
    (setIndex0: number) => {
      if (!ex) return
      const setIndex = setIndex0 + 1
      const logged = state.log.find(
        (s) => s.exercise_id === ex.exercise_id && s.set_index === setIndex,
      )
      if (!logged) return
      setEditDraft({
        setIndex,
        reps: logged.reps,
        weight_kg: logged.weight_kg,
        rpe: logged.rpe,
      })
    },
    [ex, state.log],
  )

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
  const listDraft = listEx
    ? draftRowsForExercise(listEx, state.log, listRowCount)
    : null
  const listPlanItem = listExerciseId
    ? day.items.find((it) => it.exercise_id === listExerciseId)
    : undefined
  const listIsCardio = Boolean(listPlanItem && isEnduranceCardioItem(listPlanItem))

  const openListExercise = (exerciseId: string) => {
    const item = day.items.find((it) => it.exercise_id === exerciseId)
    setSkippingId(null)
    setListRowCount(null)
    setListExerciseId(exerciseId)
    if (item && isEnduranceCardioItem(item)) {
      const kind = (item.cardio_kind ?? 'carrera_libre') as CardioKind
      setCardioDraft(
        emptyCardioLog({
          kind,
          surface: (item.cardio_surface ?? 'aire_libre') as CardioSurface,
          session_type: (item.session_type as CardioSessionType) || defaultSessionType(kind),
          distance_km: item.target_km != null ? String(item.target_km) : '',
          duration_min: item.target_min != null ? String(item.target_min) : '',
        }),
      )
    } else {
      setCardioDraft(null)
    }
  }

  const saveCardioLog = async (exerciseId: string) => {
    if (!cardioDraft) return
    setCardioSaving(true)
    try {
      await api.addRun({
        date: day.date,
        exercise_id: exerciseId,
        kind: cardioDraft.kind,
        surface: cardioDraft.surface,
        session_type: cardioDraft.session_type,
        distance_km: Number(cardioDraft.distance_km),
        duration_min: Number(cardioDraft.duration_min),
        rpe: cardioDraft.rpe,
        notes: cardioDraft.notes.trim() || null,
      })
      const completed: CompletedSet[] = [
        {
          exercise_id: exerciseId,
          set_index: 1,
          reps: Math.round(Number(cardioDraft.duration_min)),
          weight_kg: Number(cardioDraft.distance_km),
          rpe: cardioDraft.rpe ?? 7,
        },
      ]
      dispatchAndPersist({ type: 'REPLACE_EXERCISE_SETS', exerciseId, sets: completed }, [
        exerciseId,
      ])
      setListExerciseId(null)
      setCardioDraft(null)
    } finally {
      setCardioSaving(false)
    }
  }

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
    // Si se desmarcan todas las series, el log ya no menciona el ejercicio y
    // merge no lo tocaría: hay que pedirlo en clear_exercise_ids.
    dispatchAndPersist(
      { type: 'REPLACE_EXERCISE_SETS', exerciseId, sets: completed },
      [exerciseId],
    )
  }

  const showCheckIn = checkInPref !== 'skip'

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <ConfirmDialog
        open={exitOpen}
        onOpenChange={setExitOpen}
        title="¿Salir del entrenamiento?"
        description="Hay series que aún no están confirmadas en el servidor. Puedes guardarlas y salir, o descartar solo esas."
        confirmLabel="Guardar y salir"
        cancelLabel="Seguir entrenando"
        dangerLabel="Salir sin guardar"
        onConfirm={() => {
          void handleSaveAndExit()
        }}
        onDanger={onExit}
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
            {state.phase !== 'loading' && persistStatus === 'saving' && ' · Guardando…'}
            {state.phase !== 'loading' && persistStatus === 'saved' && unsaved <= 0 && ' · Guardado'}
            {state.phase !== 'loading' && persistStatus === 'error' && ' · Error al guardar'}
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
            const id = state.exs[i]?.exercise_id
            if (state.view === 'list' && id) openListExercise(id)
          }}
          onMove={(from, to) => dispatch({ type: 'REORDER', from, to })}
        />
      )}

      <main className="scrollbar-thin flex-1 overflow-auto p-4">
        {state.view === 'list' && state.phase !== 'done' && (
          <div
            className={cn(
              'mx-auto flex w-full flex-col gap-3',
              listEx ? 'max-w-lg' : 'max-w-2xl',
            )}
          >
            {!listEx && (
              <SessionExercisePlaylist
                exs={state.exs}
                log={state.log}
                skips={skips}
                items={day.items}
                onSelect={(i) => {
                  dispatch({ type: 'SELECT_EXERCISE', ti: i })
                  const id = state.exs[i]?.exercise_id
                  if (id) openListExercise(id)
                }}
              />
            )}
            {listEx && listDraft && skippingId === listEx.exercise_id ? (
              <SkipExercisePanel
                exerciseId={listEx.exercise_id}
                exercise={exMap[listEx.exercise_id]}
                feedback={feedback}
                onFeedbackChange={(next) => {
                  setFeedback(next)
                  setCheckInTouched(true)
                }}
                onConfirm={(reason) => confirmSkip(listEx.exercise_id, reason)}
                onCancel={() => setSkippingId(null)}
              />
            ) : listEx && listDraft && listIsCardio && cardioDraft ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{listEx.name_es}</div>
                    {listPlanItem && (
                      <div className="truncate text-xs text-muted-foreground">
                        {formatCardioPrescription(listPlanItem)}
                      </div>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setListExerciseId(null)
                      setCardioDraft(null)
                    }}
                  >
                    Atrás
                  </Button>
                </div>
                <CardioLogForm
                  value={cardioDraft}
                  onChange={setCardioDraft}
                  onSubmit={() => void saveCardioLog(listEx.exercise_id)}
                  submitLabel={cardioSaving ? 'Guardando…' : 'Guardar cardio'}
                  disabled={cardioSaving}
                />
              </div>
            ) : listEx && listDraft ? (
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
                  setListRowCount(rows.length)
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
                  setListRowCount(Math.max(1, remapped.length))
                  syncListSets(listEx.exercise_id, remapped, newLogged)
                }}
                onRemoveExercise={() => {
                  setSkippingId(listEx.exercise_id)
                }}
                onBack={() => {
                  setSkippingId(null)
                  setListRowCount(null)
                  setListExerciseId(null)
                }}
                onOpenGuide={() => undefined}
                onSuggestProgression={() => undefined}
                feedback={feedback}
                onFeedbackChange={(next) => {
                  setFeedback(next)
                  setCheckInTouched(true)
                }}
              />
            ) : null}
          </div>
        )}

        {state.view === 'focus' && state.phase === 'work'
 && ex && (
          <div className="mx-auto flex max-w-md flex-col gap-4">
            {skippingId === ex.exercise_id ? (
              <SkipExercisePanel
                exerciseId={ex.exercise_id}
                exercise={exMap[ex.exercise_id]}
                feedback={feedback}
                onFeedbackChange={(next) => {
                  setFeedback(next)
                  setCheckInTouched(true)
                }}
                onConfirm={(reason) => confirmSkip(ex.exercise_id, reason)}
                onCancel={() => setSkippingId(null)}
              />
            ) : focusIsCardio && cardioDraft ? (
              <>
                <div className="overflow-hidden rounded-xl border bg-white">
                  <MediaImg
                    image={ex.image}
                    gif={ex.gif}
                    alt={ex.name_es}
                    className="aspect-video w-full object-contain"
                  />
                </div>
                <div>
                  <h2 className="font-heading text-xl font-bold">{ex.name_es}</h2>
                  {focusPlanItem && (
                    <p className="text-sm text-muted-foreground">
                      {formatCardioPrescription(focusPlanItem)}
                    </p>
                  )}
                </div>
                {setsDoneFor(ex.exercise_id, state.log) >= ex.sets ? (
                  <p className="text-sm text-muted-foreground">Cardio de este ejercicio ya registrado.</p>
                ) : (
                  <CardioLogForm
                    value={cardioDraft}
                    onChange={setCardioDraft}
                    onSubmit={() => void saveCardioLog(ex.exercise_id)}
                    submitLabel={cardioSaving ? 'Guardando…' : 'Guardar cardio'}
                    disabled={cardioSaving}
                  />
                )}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSkippingId(ex.exercise_id)}
                >
                  Omitir
                </Button>
              </>
            ) : (
            <>
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
              {Array.from({ length: ex.sets }).map((_, i) => {
                const done = i < state.si || exerciseComplete
                const isCurrent = i === state.si && !exerciseComplete && !editing
                const isEditing = editDraft?.setIndex === i + 1
                const canEdit = done
                const clickable =
                  canEdit || (editing && i === state.si && !exerciseComplete)
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={!clickable}
                    aria-label={
                      canEdit
                        ? `Editar serie ${i + 1}`
                        : isCurrent
                          ? `Serie actual ${i + 1}`
                          : `Serie ${i + 1}`
                    }
                    onClick={() => {
                      if (canEdit) beginEditSet(i)
                      else if (editing && i === state.si && !exerciseComplete) setEditDraft(null)
                    }}
                    className={cn(
                      'flex size-9 items-center justify-center rounded-lg border text-sm font-semibold transition-colors',
                      done && !isEditing && 'border-primary/30 bg-primary/10 text-primary',
                      isCurrent && 'border-primary bg-primary text-primary-foreground',
                      isEditing && 'border-primary bg-primary text-primary-foreground ring-2 ring-primary/40',
                      !done && !isCurrent && 'text-muted-foreground',
                      canEdit && !isEditing && 'hover:border-primary/60 hover:bg-primary/20',
                      clickable ? 'cursor-pointer' : 'cursor-default',
                    )}
                  >
                    {done && !isEditing ? <Check className="size-4" /> : i + 1}
                  </button>
                )
              })}
            </div>

            {exerciseComplete && !editing ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Series de este ejercicio completadas. Toca una serie para corregirla, o elige otro ejercicio.
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
                {editing && (
                  <p className="text-sm text-muted-foreground">
                    Corrigiendo serie {editDraft.setIndex} de {ex.sets}.
                    {!exerciseComplete && (
                      <>
                        {' '}
                        <button
                          type="button"
                          className="font-medium text-primary underline-offset-2 hover:underline"
                          onClick={() => setEditDraft(null)}
                        >
                          Volver a la serie {state.si + 1}
                        </button>
                      </>
                    )}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <Stepper
                    label="Reps"
                    value={String(editing ? editDraft.reps : ex.reps)}
                    onDec={() =>
                      editing
                        ? setEditDraft((d) => (d ? { ...d, reps: Math.max(0, d.reps - 1) } : d))
                        : dispatch({ type: 'ADJUST', field: 'reps', delta: -1 })
                    }
                    onInc={() =>
                      editing
                        ? setEditDraft((d) => (d ? { ...d, reps: d.reps + 1 } : d))
                        : dispatch({ type: 'ADJUST', field: 'reps', delta: 1 })
                    }
                  />
                  <Stepper
                    label={isBodyweight ? 'Kg lastre' : 'Kg'}
                    value={
                      (editing ? editDraft.weight_kg : ex.weight_kg)
                        ? String(editing ? editDraft.weight_kg : ex.weight_kg)
                        : '—'
                    }
                    onDec={() =>
                      editing
                        ? setEditDraft((d) =>
                            d
                              ? {
                                  ...d,
                                  weight_kg: stepWeight(d.weight_kg, -1, ex.availableWeights),
                                }
                              : d,
                          )
                        : dispatch({ type: 'ADJUST', field: 'weight_kg', delta: -1 })
                    }
                    onInc={() =>
                      editing
                        ? setEditDraft((d) =>
                            d
                              ? {
                                  ...d,
                                  weight_kg: stepWeight(d.weight_kg, 1, ex.availableWeights),
                                }
                              : d,
                          )
                        : dispatch({ type: 'ADJUST', field: 'weight_kg', delta: 1 })
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>RPE de la serie</Label>
                  <div className="flex gap-1.5">
                    {[6, 7, 8, 9, 10].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() =>
                          editing ? setEditDraft((d) => (d ? { ...d, rpe: v } : d)) : setRpe(v)
                        }
                        className={cn(
                          'h-10 flex-1 rounded-lg border text-sm font-semibold transition-colors',
                          (editing ? editDraft.rpe : rpe) === v
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'hover:bg-muted',
                        )}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">1 muy fácil · 10 al fallo.</p>
                </div>

                {editing ? (
                  <Button
                    size="lg"
                    className="w-full gap-2"
                    onClick={() => {
                      dispatchAndPersist({
                        type: 'UPDATE_SET',
                        exerciseId: ex.exercise_id,
                        set_index: editDraft.setIndex,
                        reps: editDraft.reps,
                        weight_kg: editDraft.weight_kg,
                        rpe: editDraft.rpe,
                      })
                      setEditDraft(null)
                    }}
                  >
                    <Check className="size-5" />
                    Guardar serie {editDraft.setIndex}
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    className="w-full gap-2"
                    onClick={() => {
                      // El audio de móvil exige gesto: precargar y, si hay
                      // descanso, disparar el cue aquí (no solo en el effect).
                      prepareRestCues()
                      const finishing =
                        !!ex &&
                        state.exs.every((e) => {
                          const done = setsDoneFor(e.exercise_id, state.log)
                          const next = e.exercise_id === ex.exercise_id ? done + 1 : done
                          return next >= e.sets
                        })
                      if (restSeconds > 0 && !finishing) {
                        restStartFromGestureRef.current = true
                        cueRestStart()
                      }
                      dispatchAndPersist({
                        type: 'COMPLETE_SET',
                        rpe,
                        restSeconds,
                        advance: afterSet,
                        now: Date.now(),
                      })
                    }}
                  >
                    <Check className="size-5" />
                    Completar serie {state.si + 1} de {ex.sets}
                  </Button>
                )}
              </>
            )}
            {!exerciseComplete && !editing && (
              <Button
                variant="ghost"
                className="w-full text-muted-foreground"
                onClick={() => setSkippingId(ex.exercise_id)}
              >
                No lo hago
              </Button>
            )}
            </>
            )}
          </div>
        )}

        {state.view === 'focus' && state.phase === 'rest' && ex && (
          <div
            className={cn(
              'mx-auto flex max-w-md flex-col items-center gap-5 pt-6 text-center transition-colors',
              state.restLeft > 0 &&
                state.restLeft <= REST_END_LEAD_SECONDS &&
                'rounded-2xl border border-warning/40 bg-warning/10 px-4 py-6',
            )}
          >
            <div
              className={cn(
                'kicker',
                state.restLeft > 0 &&
                  state.restLeft <= REST_END_LEAD_SECONDS &&
                  'text-warning-strong dark:text-warning',
              )}
            >
              {state.restLeft > 0 && state.restLeft <= REST_END_LEAD_SECONDS
                ? '¡A prepararse!'
                : 'Descanso'}
            </div>
            <div
              className={cn(
                'font-heading text-7xl font-extrabold tabular-nums transition-colors',
                state.restLeft > 0 && state.restLeft <= REST_END_LEAD_SECONDS
                  ? 'animate-pulse text-warning-strong dark:text-warning'
                  : 'text-primary',
              )}
            >
              {mmss(state.restLeft)}
            </div>
            <Progress
              value={state.restTotal ? (state.restLeft / state.restTotal) * 100 : 0}
              className="h-2 w-full"
              indicatorClassName={
                state.restLeft > 0 && state.restLeft <= REST_END_LEAD_SECONDS
                  ? 'bg-warning'
                  : 'bg-primary'
              }
            />
            <p className="text-sm text-muted-foreground">
              {state.restLeft > 0 && state.restLeft <= REST_END_LEAD_SECONDS ? (
                <>
                  Empieza:{' '}
                  <strong className="text-foreground">{ex.name_es}</strong>
                  {state.si < ex.sets
                    ? ` · serie ${state.si + 1} de ${ex.sets}`
                    : ' · elige otro ejercicio'}
                </>
              ) : (
                <>
                  Siguiente:{' '}
                  <strong className="text-foreground">{ex.name_es}</strong>
                  {state.si < ex.sets
                    ? ` · serie ${state.si + 1} de ${ex.sets}`
                    : ' · elige otro ejercicio'}
                </>
              )}
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
            {Object.keys(skips).length > 0 && (
              <p className="text-xs text-muted-foreground">
                Omitiste {Object.keys(skips).length}{' '}
                {Object.keys(skips).length === 1 ? 'ejercicio' : 'ejercicios'} a propósito.
              </p>
            )}

            {saveError && (
              <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {saveError}
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
