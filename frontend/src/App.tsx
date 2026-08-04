import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  api,
  type BodyMetric,
  type BodyMetricInput,
  type Exercise,
  type ExerciseFeedbackMap,
  type ExerciseSkipsMap,
  type PlanGoals,
  type PlanSummary,
  type ProfileSummary,
  type SessionSet,
  type UserProfile,
  type UserProfileInput,
  type WeekDay,
  type WeekLoad,
} from '@/lib/api'
import { GuideModal, type GuideSelection } from '@/components/GuideModal'
import {
  TrainingMode,
  type SessionFinishPayload,
  type SessionPersistPayload,
} from '@/components/TrainingMode'
import { draftToPayload, emptyBodyDraft, type ProfileBodyDraft } from '@/lib/bodyDraft'
import { type CardioKind, type CardioRun, type CardioSessionType, type CardioSurface, defaultSessionType } from '@/lib/cardio'
import { AppShell } from '@/components/shell/AppShell'
import { AjustesScreen } from '@/components/shell/AjustesScreen'
import { UsuariosScreen } from '@/components/shell/UsuariosScreen'
import { CardioTab } from '@/components/tabs/CardioTab'
import { ConsistenciaTab } from '@/components/tabs/ConsistenciaTab'
import { EjerciciosTab } from '@/components/tabs/EjerciciosTab'
import { FuerzaTab } from '@/components/tabs/FuerzaTab'
import { HoyTab } from '@/components/tabs/HoyTab'
import { MedicionesTab } from '@/components/tabs/MedicionesTab'
import { PerfilTab } from '@/components/tabs/PerfilTab'
import { TendenciasTab } from '@/components/tabs/TendenciasTab'
import { CoachScreen } from '@/components/coach/CoachScreen'
import { useStrengthDashboard } from '@/hooks/useStrengthDashboard'
import { weekdayOf } from '@/lib/dates'
import { todayISO } from '@/lib/utils'
import { DEFAULT_INDIRECT_WEIGHT } from '@/lib/volume'

export default function App({ onBooted }: { onBooted: () => void }) {
  const [days, setDays] = useState<WeekDay[]>([])
  const [planName, setPlanName] = useState('')
  const [planGymId, setPlanGymId] = useState<number | null>(null)
  const [load, setLoad] = useState<WeekLoad | null>(null)
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [equipmentUnlocks, setEquipmentUnlocks] = useState<Record<string, string[]>>({})
  const [selected, setSelected] = useState<GuideSelection | null>(null)
  const [trainingDay, setTrainingDay] = useState<WeekDay | null>(null)
  const [planGoals, setPlanGoals] = useState<PlanGoals>({ base: { min: 10, max: 20 }, overrides: [] })
  const [planObjective, setPlanObjective] = useState<string | null>(null)
  const [planIndirectWeight, setPlanIndirectWeight] = useState(DEFAULT_INDIRECT_WEIGHT)
  const [plans, setPlans] = useState<PlanSummary[]>([])
  const [activePlanId, setActivePlanId] = useState<number | null>(null)
  const [weeklySets, setWeeklySets] = useState<Record<string, number>>({})
  const [todaySets, setTodaySets] = useState<SessionSet[]>([])
  const [todayFeedback, setTodayFeedback] = useState<ExerciseFeedbackMap>({})
  const [todaySkips, setTodaySkips] = useState<ExerciseSkipsMap>({})
  const [advice, setAdvice] = useState('')
  const [adviceSource, setAdviceSource] = useState('')
  const [adviceCreatedAt, setAdviceCreatedAt] = useState<string | undefined>()
  const [coachNotes, setCoachNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  // La intro de arranque tapa el shell vacío del primer `refresh()`. `booted`
  // se marca pase lo que pase —también si el backend falla—: si no, un 500
  // dejaría al usuario mirando la animación para siempre.
  //
  // La intro ya no se monta aquí sino en `Root`, por encima: si viviera dentro
  // de `App` y `App` no se montara sin sesión, el `#boot` de index.html nunca se
  // borraría y taparía el login para siempre.
  const [booted, setBooted] = useState(false)
  const strength = useStrengthDashboard()

  const [runKind, setRunKind] = useState<CardioKind>('carrera_libre')
  const [runSessionType, setRunSessionType] = useState<CardioSessionType>('rodaje_suave')
  const [runSurface, setRunSurface] = useState<CardioSurface>('aire_libre')
  const [runKm, setRunKm] = useState('')
  const [runMin, setRunMin] = useState('')
  const [runRpe, setRunRpe] = useState<number | null>(null)
  const [runNotes, setRunNotes] = useState('')
  const [metricsBody, setMetricsBody] = useState<BodyMetric[]>([])
  const [metricsBodyTotal, setMetricsBodyTotal] = useState(0)
  const [metricsBodyHasMore, setMetricsBodyHasMore] = useState(false)
  const [metricsBodyLoadingMore, setMetricsBodyLoadingMore] = useState(false)
  const [profileSummary, setProfileSummary] = useState<ProfileSummary | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [bodyPhotos, setBodyPhotos] = useState<File[]>([])
  const [bodyDraft, setBodyDraft] = useState<ProfileBodyDraft>(() => emptyBodyDraft(todayISO()))
  const [metricsRuns, setMetricsRuns] = useState<CardioRun[]>([])

  const todayDay = useMemo(() => {
    const t = todayISO()
    // El respaldo por día de la semana usaba `getDay() - 1`, que el domingo da
    // -1 y no casa con ningún día del plan (el `weekday` del plan es 0=lunes,
    // como el de Python). `weekdayOf` hace esa conversión bien.
    return days.find((d) => d.date === t) || days.find((d) => d.weekday === weekdayOf(t)) || days[0]
  }, [days])

  /** Respaldo del catálogo para `weeklyVolume`: los items del plan vienen ya
   *  hidratados por el servidor, pero las series hechas llegan como ids sueltos. */
  const exMap = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises])

  const applyWeek = (week: Awaited<ReturnType<typeof api.week>>) => {
    setDays(week.plan.days)
    setPlanName(week.plan.name)
    setPlanGymId(week.plan.gym?.id ?? null)
    setPlanGoals(week.plan.goals)
    setPlanObjective(week.plan.objective)
    setPlanIndirectWeight(week.plan.indirect_weight ?? DEFAULT_INDIRECT_WEIGHT)
    setPlans(week.plans)
    setActivePlanId(week.active_id)
    setLoad(week.load)
  }

  const refresh = useCallback(async () => {
    setError('')
    const today = todayISO()
    const [week, cat, body, profile, user, runs, latest, sets, session] =
      await Promise.all([
        api.week(),
        api.catalog(),
        api.bodyMetrics({ limit: 20, offset: 0 }),
        api.profileSummary(28),
        api.profile(),
        api.runs(),
        api.coachLatest(),
        api.weeklySets(),
        api.session(today),
      ])
    applyWeek(week)
    setExercises(cat.exercises)
    setEquipmentUnlocks(cat.equipment_unlocks || {})
    setMetricsBody(body.items)
    setMetricsBodyTotal(body.total)
    setMetricsBodyHasMore(body.has_more)
    setProfileSummary(profile)
    setUserProfile(user)
    setMetricsRuns(runs)
    setWeeklySets(sets.sets)
    setTodaySets(session.sets ?? [])
    setTodayFeedback(session.exercise_feedback ?? {})
    setTodaySkips(session.exercise_skips ?? {})
    if (latest.advice) {
      setAdvice(latest.advice)
      setAdviceSource(latest.source || '')
      setAdviceCreatedAt(latest.created_at)
    }
  }, [])

  const loadMoreBodyMetrics = useCallback(async () => {
    if (metricsBodyLoadingMore || !metricsBodyHasMore) return
    setMetricsBodyLoadingMore(true)
    setError('')
    try {
      // Backend cap le=100. Pedir el remanente (o 100) evita el drip de
      // páginas de 10 cuando el viewer necesita toda la galería de fotos.
      const remaining = Math.max(metricsBodyTotal - metricsBody.length, 10)
      const page = await api.bodyMetrics({
        limit: Math.min(remaining, 100),
        offset: metricsBody.length,
      })
      setMetricsBody((current) => {
        const seen = new Set(current.map((metric) => metric.id))
        return [...current, ...page.items.filter((metric) => !seen.has(metric.id))]
      })
      setMetricsBodyTotal(page.total)
      setMetricsBodyHasMore(page.has_more)
    } catch (e) {
      setError(String((e as Error).message || e))
    } finally {
      setMetricsBodyLoadingMore(false)
    }
  }, [metricsBody.length, metricsBodyTotal, metricsBodyHasMore, metricsBodyLoadingMore])

  const openGuide = useCallback((ex: Exercise, cardio?: GuideSelection['cardio']) => {
    setSelected({ exercise: ex, cardio: cardio ?? null })
  }, [])

  /** Recarga solo la semana. Guardar o activar un plan no necesita todas las
   *  peticiones de `refresh()`, y en el móvil se nota. */
  const refreshWeek = useCallback(async () => {
    const today = todayISO()
    const [week, sets, session, profile] = await Promise.all([
      api.week(),
      api.weeklySets(),
      api.session(today),
      api.profileSummary(28),
    ])
    applyWeek(week)
    setWeeklySets(sets.sets)
    setTodaySets(session.sets ?? [])
    setTodayFeedback(session.exercise_feedback ?? {})
    setTodaySkips(session.exercise_skips ?? {})
    setProfileSummary(profile)
  }, [])

  const reorderDayExercises = useCallback(
    async (weekday: number, from: number, to: number) => {
      if (!activePlanId || from === to) return
      let nextDays: WeekDay[] = []
      setDays((prev) => {
        nextDays = prev.map((d) => {
          if (d.weekday !== weekday) return d
          if (from < 0 || to < 0 || from >= d.items.length || to >= d.items.length) return d
          const items = [...d.items]
          const [moved] = items.splice(from, 1)
          items.splice(to, 0, moved)
          return { ...d, items }
        })
        return nextDays
      })
      try {
        await api.patchPlan(activePlanId, {
          days: nextDays.map((d) => ({
            weekday: d.weekday,
            label: d.label,
            focus: d.focus,
            items: d.items.map((it) => ({
              exercise_id: it.exercise_id,
              sets: it.sets,
              rep_min: it.rep_min,
              rep_max: it.rep_max,
              rest_seconds: it.rest_seconds,
              notes: it.notes,
              cardio_kind: it.cardio_kind ?? null,
              cardio_surface: it.cardio_surface ?? null,
              session_type: it.session_type ?? null,
              target_km: it.target_km ?? null,
              target_min: it.target_min ?? null,
            })),
          })),
        })
        await refreshWeek()
      } catch (e) {
        setError(String((e as Error).message || e))
        await refreshWeek()
      }
    },
    [activePlanId, refreshWeek],
  )

  useEffect(() => {
    refresh()
      .catch((e) => {
        // Un `SessionExpiredError` ya está siendo atendido por `AuthProvider`,
        // que pinta el login encima. Enseñarlo también en el banner rojo sería
        // ruido justo debajo del formulario.
        if (e?.name === 'SessionExpiredError') return
        setError(String(e.message || e))
      })
      .finally(() => {
        setBooted(true)
        onBooted()
      })
  }, [refresh, onBooted])

  const askCoach = async () => {
    setBusy(true)
    setError('')
    try {
      const res = await api.coachAdvise(coachNotes || undefined)
      setAdvice(res.advice)
      setAdviceSource(res.source)
      setAdviceCreatedAt(new Date().toISOString())
      setLoad(res.load)
    } catch (e) {
      setError(String((e as Error).message || e))
    } finally {
      setBusy(false)
    }
  }

  const markDay = useCallback(async (day: WeekDay, completed: boolean) => {
    await api.toggleDay(day.date, completed)
    // Se recarga tambien weekly-sets: las agregaciones filtran por
    // `s.completed = 1`, asi que desmarcar un dia cambia las series contadas.
    await refreshWeek()
  }, [refreshWeek])

  /** Autosave durante la sesión: merge sin cerrar ni refrescar el dashboard. */
  const persistTraining = async (payload: SessionPersistPayload) => {
    if (!trainingDay) return
    await api.saveSession({
      date: trainingDay.date,
      focus: trainingDay.focus,
      completed: payload.completed,
      sets: payload.sets,
      mode: 'merge',
      clear_exercise_ids: payload.clearExerciseIds,
    })
  }

  const finishTraining = async (payload: SessionFinishPayload) => {
    if (!trainingDay) return
    const body: Parameters<typeof api.saveSession>[0] = {
      date: trainingDay.date,
      focus: trainingDay.focus,
      completed: true,
      // Entero 1–10: un promedio tipo 7.6 lo rechaza el backend (422).
      session_rpe: Math.round(payload.sessionRpe),
      notes: payload.notes,
      sets: payload.sets,
      // Sesión activa del plan: merge para no borrar extras de otro plan.
      mode: 'merge',
      clear_exercise_ids: payload.clearExerciseIds,
    }
    const hasFeedback = Object.keys(payload.exerciseFeedback).length > 0
    const hasSkips = Object.keys(payload.exerciseSkips).length > 0
    if (payload.includeCheckIn || hasFeedback || hasSkips) {
      body.mood = payload.mood
      body.health = payload.health
      body.energy = payload.energy
      body.exercise_feedback = payload.exerciseFeedback
      body.exercise_skips = payload.exerciseSkips
    }
    // Si esto falla, el error sube a TrainingMode (sigue abierta la vista).
    await api.saveSession(body)
    setTrainingDay(null)
    try {
      await Promise.all([refresh(), strength.refresh()])
    } catch (e) {
      setError(String((e as Error).message || e))
    }
  }

  const exitTraining = async () => {
    setTrainingDay(null)
    try {
      await Promise.all([refresh(), strength.refresh()])
    } catch (e) {
      setError(String((e as Error).message || e))
    }
  }

  const changeBodyDraft = (field: keyof ProfileBodyDraft, value: string) => {
    setBodyDraft((draft) => ({ ...draft, [field]: value }))
  }

  const changeBodyPhotos = (files: File[]) => {
    setBodyPhotos(files.slice(0, 3))
  }

  const removeBodyPhoto = (index: number) => {
    setBodyPhotos((files) => files.filter((_, i) => i !== index))
  }

  const saveBody = async () => {
    if (!bodyDraft.weight_kg) return false
    setError('')
    const payload = draftToPayload({ ...bodyDraft, date: bodyDraft.date || todayISO() })
    try {
      if (bodyPhotos.length) {
        await api.addBodyWithPhotos(payload, bodyPhotos)
      } else {
        await api.addBody(payload)
      }
      setBodyDraft(emptyBodyDraft(todayISO()))
      setBodyPhotos([])
      await refresh()
      return true
    } catch (e) {
      setError(String((e as Error).message || e))
      return false
    }
  }

  const importBodyCsv = async (file: File) => {
    setError('')
    try {
      await api.importBodyCsv(await file.text())
      await refresh()
      return true
    } catch (e) {
      setError(String((e as Error).message || e))
      return false
    }
  }

  const setProfilePhoto = async (file: File) => {
    setError('')
    try {
      setUserProfile(await api.setProfilePhoto(file))
    } catch (e) {
      setError(String((e as Error).message || e))
    }
  }

  const clearProfilePhoto = async () => {
    setError('')
    try {
      setUserProfile(await api.deleteProfilePhoto())
    } catch (e) {
      setError(String((e as Error).message || e))
    }
  }

  /** Devuelve el mensaje de error, o `null` si guardó. El perfil lo pinta junto
   *  al formulario: un banner global no dice qué campo falla. */
  const saveProfile = async (patch: UserProfileInput) => {
    setError('')
    try {
      setUserProfile(await api.updateProfile(patch))
      return null
    } catch (e) {
      return String((e as Error).message || e)
    }
  }

  const applyUpdatedMetric = async (metricId: number, updated: BodyMetric) => {
    setMetricsBody((current) => current.map((metric) => (metric.id === metricId ? updated : metric)))
    setProfileSummary(await api.profileSummary(28))
  }

  const addMetricPhotos = async (metricId: number, files: File[]) => {
    setError('')
    try {
      await applyUpdatedMetric(metricId, await api.addBodyPhotos(metricId, files))
    } catch (e) {
      setError(String((e as Error).message || e))
      throw e
    }
  }

  const replaceMetricPhoto = async (metricId: number, photoId: number, file: File) => {
    setError('')
    try {
      await applyUpdatedMetric(metricId, await api.replaceBodyPhoto(photoId, file))
    } catch (e) {
      setError(String((e as Error).message || e))
      throw e
    }
  }

  const deleteMetricPhoto = async (metricId: number, photoId: number) => {
    setError('')
    try {
      await applyUpdatedMetric(metricId, await api.deleteBodyPhoto(photoId))
    } catch (e) {
      setError(String((e as Error).message || e))
      throw e
    }
  }

  const updateMetric = async (metricId: number, patch: BodyMetricInput) => {
    setError('')
    try {
      await applyUpdatedMetric(metricId, await api.updateBody(metricId, patch))
    } catch (e) {
      setError(String((e as Error).message || e))
      throw e
    }
  }

  const saveRun = async () => {
    if (!runKm || !runMin) return
    await api.addRun({
      kind: runKind,
      surface: runSurface,
      session_type: runSessionType,
      distance_km: Number(runKm),
      duration_min: Number(runMin),
      rpe: runRpe,
      notes: runNotes.trim() || null,
    })
    setRunKm('')
    setRunMin('')
    setRunRpe(null)
    setRunNotes('')
    await refresh()
  }

  const changeRunKind = (kind: CardioKind) => {
    setRunKind(kind)
    setRunSessionType(defaultSessionType(kind))
  }

  return (
    <>
      {error && (
        <div className="border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <AppShell
        exercises={exercises}
        equipmentUnlocks={equipmentUnlocks}
        weekDays={days}
        activePlanName={planName}
        planGymId={planGymId}
        onMarkDay={markDay}
        onWeekChanged={refreshWeek}
        openGuide={openGuide}
        startTraining={setTrainingDay}
        profile={userProfile}
        screens={(h) => ({
          hoy: (
            <HoyTab
              load={load}
              days={days}
              todayDay={todayDay}
              planName={planName}
              plans={plans}
              activeId={activePlanId}
              objective={planObjective}
              goals={planGoals}
              indirectWeight={planIndirectWeight}
              weeklySets={weeklySets}
              todaySets={todaySets}
              todayFeedback={todayFeedback}
              todaySkips={todaySkips}
              metricsRuns={metricsRuns}
              gymId={planGymId}
              exMap={exMap}
              onOpenExercise={openGuide}
              onMarkDay={markDay}
              onGoRegister={h.goRegister}
              onGoTrain={setTrainingDay}
              onReorderExercises={reorderDayExercises}
            />
          ),
          coach: (
            <CoachScreen
              coachNotes={coachNotes}
              onNotesChange={setCoachNotes}
              onAsk={askCoach}
              busy={busy}
              advice={advice}
              adviceSource={adviceSource}
              adviceCreatedAt={adviceCreatedAt}
            />
          ),
          fuerza: (
            <FuerzaTab
              days={strength.days}
              onDaysChange={strength.setDays}
              dashboard={strength.dashboard}
              loading={strength.loading}
              error={strength.error}
              onRetry={strength.refresh}
              selectedExerciseId={strength.selectedExerciseId}
              onSelectExercise={strength.selectExercise}
              history={strength.history}
              historyLoading={strength.historyLoading}
              historyError={strength.historyError}
              onOpenExercise={(id) => {
                const exercise = exercises.find((item) => item.id === id)
                if (exercise) openGuide(exercise)
              }}
            />
          ),
          perfil: (
            <PerfilTab
              profile={userProfile}
              onSaveProfile={saveProfile}
              onSetProfilePhoto={setProfilePhoto}
              onClearProfilePhoto={clearProfilePhoto}
            />
          ),
          mediciones: (
            <MedicionesTab
              metrics={metricsBody}
              total={metricsBodyTotal}
              loading={!booted}
              hasMore={metricsBodyHasMore}
              loadingMore={metricsBodyLoadingMore}
              onLoadMore={loadMoreBodyMetrics}
              draft={bodyDraft}
              photos={bodyPhotos}
              onDraftChange={changeBodyDraft}
              onPhotosChange={changeBodyPhotos}
              onRemovePhoto={removeBodyPhoto}
              onSaveBody={saveBody}
              onImportCsv={importBodyCsv}
              onAddPhotos={addMetricPhotos}
              onReplacePhoto={replaceMetricPhoto}
              onDeletePhoto={deleteMetricPhoto}
              onUpdateMetric={updateMetric}
            />
          ),
          tendencias: (
            <TendenciasTab
              heightCm={userProfile?.height_cm ?? null}
              onGoMediciones={() => h.go({ k: 'mediciones' })}
            />
          ),
          consistencia: <ConsistenciaTab summary={profileSummary} onOpenDay={h.goRegisterDate} />,
          cardio: (
            <CardioTab
              metricsRuns={metricsRuns}
              runKind={runKind}
              runSessionType={runSessionType}
              runSurface={runSurface}
              runKm={runKm}
              runMin={runMin}
              runRpe={runRpe}
              runNotes={runNotes}
              onRunKindChange={changeRunKind}
              onRunSessionTypeChange={setRunSessionType}
              onRunSurfaceChange={setRunSurface}
              onRunKmChange={setRunKm}
              onRunMinChange={setRunMin}
              onRunRpeChange={setRunRpe}
              onRunNotesChange={setRunNotes}
              onSaveRun={saveRun}
            />
          ),
          catalogo: <EjerciciosTab exercises={exercises} onOpenExercise={openGuide} />,
          ajustes: (
            <AjustesScreen
              onAfterSync={async () => {
                const body = await api.bodyMetrics({ limit: 20, offset: 0 })
                setMetricsBody(body.items)
                setMetricsBodyTotal(body.total)
                setMetricsBodyHasMore(body.has_more)
              }}
            />
          ),
          usuarios: <UsuariosScreen />,
        })}
      />

      <GuideModal selection={selected} exercises={exercises} onClose={() => setSelected(null)} />

      {trainingDay && (
        <TrainingMode
          day={trainingDay}
          /* El material es el del espacio DEL PLAN, no el del selector: si estás
             mirando «Parque» mientras entrenas un plan de casa, el stepper tiene
             que ofrecerte tus mancuernas. */
          gymId={planGymId}
          onExit={exitTraining}
          onPersist={persistTraining}
          onFinish={finishTraining}
        />
      )}
    </>
  )
}
