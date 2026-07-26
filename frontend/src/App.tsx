import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  api,
  type BodyMetric,
  type BodyMetricInput,
  type Exercise,
  type MuscleCoverageItem,
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
import { CardioTab } from '@/components/tabs/CardioTab'
import { ConsistenciaTab } from '@/components/tabs/ConsistenciaTab'
import { EjerciciosTab } from '@/components/tabs/EjerciciosTab'
import { FuerzaTab } from '@/components/tabs/FuerzaTab'
import { HoyTab } from '@/components/tabs/HoyTab'
import { MedicionesTab } from '@/components/tabs/MedicionesTab'
import { PerfilTab } from '@/components/tabs/PerfilTab'
import { useStrengthDashboard } from '@/hooks/useStrengthDashboard'
import { todayISO } from '@/lib/utils'

export default function App() {
  const [days, setDays] = useState<WeekDay[]>([])
  const [planName, setPlanName] = useState('')
  const [planGymId, setPlanGymId] = useState<number | null>(null)
  const [load, setLoad] = useState<WeekLoad | null>(null)
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [equipmentUnlocks, setEquipmentUnlocks] = useState<Record<string, string[]>>({})
  const [selected, setSelected] = useState<Exercise | null>(null)
  const [trainingDay, setTrainingDay] = useState<WeekDay | null>(null)
  const [advice, setAdvice] = useState('')
  const [adviceSource, setAdviceSource] = useState('')
  const [coachNotes, setCoachNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
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
    return (
      days.find((d) => d.date === t) ||
      days.find((d) => d.weekday === new Date().getDay() - 1) ||
      days[0]
    )
  }, [days])

  const applyWeek = (week: Awaited<ReturnType<typeof api.week>>) => {
    setDays(week.plan.days)
    setPlanName(week.plan.name)
    setPlanGymId(week.plan.gym?.id ?? null)
    setLoad(week.load)
  }

  const refresh = useCallback(async () => {
    setError('')
    const [week, cat, body, profile, user, runs, latest, muscleCoverage] = await Promise.all([
      api.week(),
      api.catalog(),
      api.bodyMetrics({ limit: 20, offset: 0 }),
      api.profileSummary(28),
      api.profile(),
      api.runs(),
      api.coachLatest(),
      api.muscleCoverage(14),
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
    if (latest.advice) {
      setAdvice(latest.advice)
      setAdviceSource(latest.source || '')
    }
  }, [])

  const loadMoreBodyMetrics = useCallback(async () => {
    if (metricsBodyLoadingMore || !metricsBodyHasMore) return
    setMetricsBodyLoadingMore(true)
    setError('')
    try {
      const page = await api.bodyMetrics({ limit: 10, offset: metricsBody.length })
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
  }, [metricsBody.length, metricsBodyHasMore, metricsBodyLoadingMore])

  /** Recarga solo la semana. Guardar o activar un plan no necesita todas las
   *  peticiones de `refresh()`, y en el móvil se nota. */
  const refreshWeek = useCallback(async () => {
    applyWeek(await api.week())
  }, [])

  useEffect(() => {
    refresh().catch((e) => setError(String(e.message || e)))
  }, [refresh])

  const askCoach = async () => {
    setBusy(true)
    setError('')
    try {
      const res = await api.coachAdvise(coachNotes || undefined)
      setAdvice(res.advice)
      setAdviceSource(res.source)
      setLoad(res.load)
    } catch (e) {
      setError(String((e as Error).message || e))
    } finally {
      setBusy(false)
    }
  }

  const markDay = useCallback(async (day: WeekDay, completed: boolean) => {
    await api.toggleDay(day.date, completed)
    await api.week().then(applyWeek)
  }, [])

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
              coverage={coverage}
              onOpenExercise={setSelected}
              onMarkDay={markDay}
              onGoRegister={h.goRegister}
              onGoTrain={setTrainingDay}
              onGoFuerza={() => h.go({ k: 'fuerza' })}
              coachNotes={coachNotes}
              onNotesChange={setCoachNotes}
              onAsk={askCoach}
              busy={busy}
              advice={advice}
              adviceSource={adviceSource}
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
