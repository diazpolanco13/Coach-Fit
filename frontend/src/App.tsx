import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  api,
  type Exercise,
  type MuscleCoverageItem,
  type MuscleTrendItem,
  type SessionSet,
  type WeekDay,
  type WeekLoad,
} from '@/lib/api'
import { GuideModal } from '@/components/GuideModal'
import { TrainingMode } from '@/components/TrainingMode'
import { AppShell } from '@/components/shell/AppShell'
import { CardioTab } from '@/components/tabs/CardioTab'
import { EjerciciosTab } from '@/components/tabs/EjerciciosTab'
import { FuerzaTab } from '@/components/tabs/FuerzaTab'
import { HoyTab } from '@/components/tabs/HoyTab'
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

  const [muscleTrends, setMuscleTrends] = useState<MuscleTrendItem[]>([])
  const [staleCount, setStaleCount] = useState(0)
  const [prCount, setPrCount] = useState(0)
  const [exerciseFrequency, setExerciseFrequency] = useState<Record<string, number>>({})
  const [selectedExerciseHistory, setSelectedExerciseHistory] = useState<string | null>(null)
  const [exerciseHistory, setExerciseHistory] = useState<
    Array<{ date: string; max_weight: number; max_reps: number }>
  >([])
  const [exerciseHistoryName, setExerciseHistoryName] = useState('')
  const [exerciseHistoryMax, setExerciseHistoryMax] = useState<number | null>(null)

  const [weight, setWeight] = useState('')
  const [runKm, setRunKm] = useState('')
  const [runMin, setRunMin] = useState('')
  const [metricsBody, setMetricsBody] = useState<
    Array<{ id: number; date: string; weight_kg: number; body_fat_pct?: number; notes?: string }>
  >([])
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
    const [week, cat, body, runs, latest, freq, muscleCoverage, trends, prs] = await Promise.all([
      api.week(),
      api.catalog(),
      api.bodyMetrics(),
      api.runs(),
      api.coachLatest(),
      api.dashboardFrequency(),
      api.muscleCoverage(14),
      api.muscleTrends(28),
      api.prsThisMonth(),
    ])
    applyWeek(week)
    setExercises(cat.exercises)
    setEquipmentUnlocks(cat.equipment_unlocks || {})
    setMetricsBody(body)
    setMetricsRuns(runs)
    setExerciseFrequency(freq.frequency)
    setCoverage(muscleCoverage.groups)
    setMuscleTrends(trends.groups)
    setStaleCount(trends.stale_count)
    setPrCount(prs.pr_count)
    if (latest.advice) {
      setAdvice(latest.advice)
      setAdviceSource(latest.source || '')
    }
  }, [])

  /** Recarga solo la semana. Guardar o activar un plan no necesita las nueve
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
      await refresh()
    } catch (e) {
      setError(String((e as Error).message || e))
    }
  }

  const saveWeight = async () => {
    if (!weight) return
    await api.addBody({ weight_kg: Number(weight) })
    setWeight('')
    await refresh()
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

  const loadExerciseHistory = useCallback(async (exerciseId: string) => {
    try {
      const hist = await api.dashboardExerciseHistory(exerciseId)
      setSelectedExerciseHistory(exerciseId)
      setExerciseHistory(hist.history)
      setExerciseHistoryName(hist.exercise_name)
      setExerciseHistoryMax(hist.max_weight)
    } catch (e) {
      console.error(e)
    }
  }, [])

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
              trends={muscleTrends}
              staleCount={staleCount}
              prCount={prCount}
              exercises={exercises}
              exerciseFrequency={exerciseFrequency}
              selectedExerciseId={selectedExerciseHistory}
              exerciseHistory={exerciseHistory}
              exerciseHistoryName={exerciseHistoryName}
              exerciseHistoryMax={exerciseHistoryMax}
              onSelectExercise={loadExerciseHistory}
            />
          ),
          cardio: (
            <CardioTab
              metricsBody={metricsBody}
              metricsRuns={metricsRuns}
              weight={weight}
              runKm={runKm}
              runMin={runMin}
              onWeightChange={setWeight}
              onRunKmChange={setRunKm}
              onRunMinChange={setRunMin}
              onSaveWeight={saveWeight}
              onSaveRun={saveRun}
            />
          ),
          catalogo: <EjerciciosTab exercises={exercises} onOpenExercise={setSelected} />,
        })}
      />

      <GuideModal ex={selected} onClose={() => setSelected(null)} />

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
