import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  api,
  type BodyMetric,
  type BodyMetricInput,
  type Exercise,
  type MuscleCoverageItem,
  type PlanGoals,
  type PlanSummary,
  type ProfileSummary,
  type SessionSet,
  type UserProfile,
  type WeekDay,
  type WeekLoad,
} from '@/lib/api'
import { GuideModal } from '@/components/GuideModal'
import { TrainingMode } from '@/components/TrainingMode'
import type { ProfileBodyDraft } from '@/components/measurements/NuevaMedicionForm'
import { AppShell } from '@/components/shell/AppShell'
import { SplashIntro } from '@/components/shell/SplashIntro'
import { CardioTab } from '@/components/tabs/CardioTab'
import { ConsistenciaTab } from '@/components/tabs/ConsistenciaTab'
import { EjerciciosTab } from '@/components/tabs/EjerciciosTab'
import { FuerzaTab } from '@/components/tabs/FuerzaTab'
import { HoyTab } from '@/components/tabs/HoyTab'
import { MedicionesTab } from '@/components/tabs/MedicionesTab'
import { PerfilTab } from '@/components/tabs/PerfilTab'
import { CoachScreen } from '@/components/coach/CoachScreen'
import { useStrengthDashboard } from '@/hooks/useStrengthDashboard'
import { weekdayOf } from '@/lib/dates'
import { todayISO } from '@/lib/utils'
import { DEFAULT_INDIRECT_WEIGHT } from '@/lib/volume'

export default function App() {
  const [days, setDays] = useState<WeekDay[]>([])
  const [planName, setPlanName] = useState('')
  const [planGymId, setPlanGymId] = useState<number | null>(null)
  const [load, setLoad] = useState<WeekLoad | null>(null)
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [equipmentUnlocks, setEquipmentUnlocks] = useState<Record<string, string[]>>({})
  const [selected, setSelected] = useState<Exercise | null>(null)
  const [trainingDay, setTrainingDay] = useState<WeekDay | null>(null)
  const [planGoals, setPlanGoals] = useState<PlanGoals>({ base: { min: 10, max: 20 }, overrides: [] })
  const [planObjective, setPlanObjective] = useState<string | null>(null)
  const [planIndirectWeight, setPlanIndirectWeight] = useState(DEFAULT_INDIRECT_WEIGHT)
  const [plans, setPlans] = useState<PlanSummary[]>([])
  const [activePlanId, setActivePlanId] = useState<number | null>(null)
  const [weeklySets, setWeeklySets] = useState<Record<string, number>>({})
  const [advice, setAdvice] = useState('')
  const [adviceSource, setAdviceSource] = useState('')
  const [adviceCreatedAt, setAdviceCreatedAt] = useState<string | undefined>()
  const [coachNotes, setCoachNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  // La intro de arranque tapa el shell vacío del primer `refresh()`. `booted`
  // se marca pase lo que pase —también si el backend falla—: si no, un 500
  // dejaría al usuario mirando la animación para siempre.
  const [booted, setBooted] = useState(false)
  const [showSplash, setShowSplash] = useState(true)
  const strength = useStrengthDashboard()

  const [runKm, setRunKm] = useState('')
  const [runMin, setRunMin] = useState('')
  const [metricsBody, setMetricsBody] = useState<BodyMetric[]>([])
  const [metricsBodyTotal, setMetricsBodyTotal] = useState(0)
  const [metricsBodyHasMore, setMetricsBodyHasMore] = useState(false)
  const [metricsBodyLoadingMore, setMetricsBodyLoadingMore] = useState(false)
  const [profileSummary, setProfileSummary] = useState<ProfileSummary | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [bodyPhotos, setBodyPhotos] = useState<File[]>([])
  const [bodyDraft, setBodyDraft] = useState<ProfileBodyDraft>({
    date: todayISO(),
    weight_kg: '',
    body_fat_pct: '',
    muscle_pct: '',
    visceral_fat: '',
    water_pct: '',
    bmr_kcal: '',
  })
  const [metricsRuns, setMetricsRuns] = useState<
    Array<{
      id: number
      date: string
      distance_km: number
      duration_min?: number
      pace_min_per_km?: number
      rpe?: number
      notes?: string
    }>
  >([])
  const [coverage, setCoverage] = useState<MuscleCoverageItem[]>([])

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
    const [week, cat, body, profile, user, runs, latest, muscleCoverage, sets] = await Promise.all([
      api.week(),
      api.catalog(),
      api.bodyMetrics({ limit: 20, offset: 0 }),
      api.profileSummary(28),
      api.profile(),
      api.runs(),
      api.coachLatest(),
      api.muscleCoverage(14),
      api.weeklySets(),
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
    setCoverage(muscleCoverage.groups)
    setWeeklySets(sets.sets)
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

  /** Recarga solo la semana. Guardar o activar un plan no necesita todas las
   *  peticiones de `refresh()`, y en el móvil se nota. */
  const refreshWeek = useCallback(async () => {
    const [week, sets] = await Promise.all([api.week(), api.weeklySets()])
    applyWeek(week)
    setWeeklySets(sets.sets)
  }, [])

  useEffect(() => {
    refresh()
      .catch((e) => setError(String(e.message || e)))
      .finally(() => setBooted(true))
  }, [refresh])

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

  const finishTraining = async (sets: SessionSet[], rpe: number, notes: string) => {
    if (!trainingDay) return
    try {
      await api.saveSession({
        date: trainingDay.date,
        focus: trainingDay.focus,
        completed: true,
        session_rpe: rpe,
        notes,
        sets,
        // Entrenar solo conoce los ejercicios del plan activo. Si ese día ya
        // había algo registrado que este plan no incluye —se cambió de plan a
        // mitad de semana, o el ejercicio se movió a otra semana del ciclo—,
        // `replace` lo borraría sin que el usuario llegue a verlo.
        mode: 'merge',
      })
      setTrainingDay(null)
      await Promise.all([refresh(), strength.refresh()])
    } catch (e) {
      setError(String((e as Error).message || e))
    }
  }

  const bodyNumber = (value: string) => (value ? Number(value) : undefined)

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
    const payload = {
      date: bodyDraft.date || todayISO(),
      weight_kg: Number(bodyDraft.weight_kg),
      body_fat_pct: bodyNumber(bodyDraft.body_fat_pct),
      muscle_pct: bodyNumber(bodyDraft.muscle_pct),
      visceral_fat: bodyNumber(bodyDraft.visceral_fat),
      water_pct: bodyNumber(bodyDraft.water_pct),
      bmr_kcal: bodyNumber(bodyDraft.bmr_kcal),
    }
    try {
      if (bodyPhotos.length) {
        await api.addBodyWithPhotos(payload, bodyPhotos)
      } else {
        await api.addBody(payload)
      }
      setBodyDraft({
        date: todayISO(),
        weight_kg: '',
        body_fat_pct: '',
        muscle_pct: '',
        visceral_fat: '',
        water_pct: '',
        bmr_kcal: '',
      })
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
    if (!runKm) return
    await api.addRun({
      distance_km: Number(runKm),
      duration_min: runMin ? Number(runMin) : undefined,
    })
    setRunKm('')
    setRunMin('')
    await refresh()
  }

  return (
    <>
      {showSplash && <SplashIntro ready={booted} onDone={() => setShowSplash(false)} />}

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
        openGuide={setSelected}
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
              exMap={exMap}
              coverage={coverage}
              onOpenExercise={setSelected}
              onMarkDay={markDay}
              onGoRegister={h.goRegister}
              onGoTrain={setTrainingDay}
              onGoFuerza={() => h.go({ k: 'fuerza' })}
              onGoDay={(day) =>
                activePlanId ? h.go({ k: 'plan', id: activePlanId, sub: 'dias' }) : h.goRegister(day)
              }
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
                if (exercise) setSelected(exercise)
              }}
            />
          ),
          perfil: (
            <PerfilTab
              metricsBody={metricsBody}
              summary={profileSummary}
              profile={userProfile}
              draft={bodyDraft}
              photos={bodyPhotos}
              onDraftChange={changeBodyDraft}
              onPhotosChange={changeBodyPhotos}
              onRemovePhoto={removeBodyPhoto}
              onSaveBody={saveBody}
              onImportCsv={importBodyCsv}
              onSetProfilePhoto={setProfilePhoto}
              onClearProfilePhoto={clearProfilePhoto}
              onGoMediciones={() => h.go({ k: 'mediciones' })}
            />
          ),
          mediciones: (
            <MedicionesTab
              metrics={metricsBody}
              total={metricsBodyTotal}
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
          consistencia: <ConsistenciaTab summary={profileSummary} onOpenDay={h.goRegisterDate} />,
          cardio: (
            <CardioTab
              metricsRuns={metricsRuns}
              runKm={runKm}
              runMin={runMin}
              onRunKmChange={setRunKm}
              onRunMinChange={setRunMin}
              onSaveRun={saveRun}
            />
          ),
          catalogo: <EjerciciosTab exercises={exercises} onOpenExercise={setSelected} />,
        })}
      />

      <GuideModal ex={selected} exercises={exercises} onClose={() => setSelected(null)} />

      {trainingDay && (
        <TrainingMode
          day={trainingDay}
          /* El material es el del espacio DEL PLAN, no el del selector: si estás
             mirando «Parque» mientras entrenas un plan de casa, el stepper tiene
             que ofrecerte tus mancuernas. */
          gymId={planGymId}
          onExit={() => setTrainingDay(null)}
          onFinish={finishTraining}
        />
      )}
    </>
  )
}
