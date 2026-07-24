import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, ArrowLeft, CheckCircle2, Dumbbell, Loader2, Lightbulb, TrendingUp } from 'lucide-react'
import {
  api,
  type Exercise,
  type MuscleCoverageItem,
  type MuscleTrendItem,
  type ProgressionSuggestion,
  type SessionSet,
  type UserEquipment,
  type WeekDay,
  type WeekLoad,
} from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { GuideModal } from '@/components/GuideModal'
import { MediaImg } from '@/components/MediaImg'
import { TrainingMode } from '@/components/TrainingMode'
import { CardioTab } from '@/components/tabs/CardioTab'
import { EjerciciosTab } from '@/components/tabs/EjerciciosTab'
import { EquipoTab } from '@/components/tabs/EquipoTab'
import { FuerzaTab } from '@/components/tabs/FuerzaTab'
import { HoyTab } from '@/components/tabs/HoyTab'
import { SemanaTab } from '@/components/tabs/SemanaTab'
import { muscleES } from '@/lib/muscle'
import { todayISO } from '@/lib/utils'

export default function App() {
  const [tab, setTab] = useState('hoy')
  const [days, setDays] = useState<WeekDay[]>([])
  const [planName, setPlanName] = useState('')
  const [load, setLoad] = useState<WeekLoad | null>(null)
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [selected, setSelected] = useState<Exercise | null>(null)
  const [advice, setAdvice] = useState('')
  const [adviceSource, setAdviceSource] = useState('')
  const [coachNotes, setCoachNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const [sessionDate, setSessionDate] = useState(todayISO())
  const [sessionRpe, setSessionRpe] = useState(7)
  const [sessionNotes, setSessionNotes] = useState('')
  const [draftSets, setDraftSets] = useState<SessionSet[]>([])
  const [openExerciseId, setOpenExerciseId] = useState<string | null>(null)
  const [trainingDay, setTrainingDay] = useState<WeekDay | null>(null)

  const [equipment, setEquipment] = useState<UserEquipment[]>([])
  const [progressionSuggestion, setProgressionSuggestion] = useState<ProgressionSuggestion | null>(null)
  const [equipmentName, setEquipmentName] = useState('')
  const [equipmentType, setEquipmentType] = useState('dumbbell')
  const [equipmentWeight, setEquipmentWeight] = useState('')

  const [muscleTrends, setMuscleTrends] = useState<MuscleTrendItem[]>([])
  const [staleCount, setStaleCount] = useState(0)
  const [prCount, setPrCount] = useState(0)
  const [exerciseFrequency, setExerciseFrequency] = useState<Record<string, number>>({})
  const [selectedExerciseHistory, setSelectedExerciseHistory] = useState<string | null>(null)
  const [exerciseHistory, setExerciseHistory] = useState<Array<{ date: string; max_weight: number; max_reps: number }>>([])
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
    return days.find((d) => d.date === t) || days.find((d) => d.weekday === new Date().getDay() - 1) || days[0]
  }, [days])

  const refresh = useCallback(async () => {
    setError('')
    const [week, cat, body, runs, latest, eq, freq, muscleCoverage, trends, prs] = await Promise.all([
      api.week(),
      api.catalog(),
      api.bodyMetrics(),
      api.runs(),
      api.coachLatest(),
      api.getEquipment(),
      api.dashboardFrequency(),
      api.muscleCoverage(14),
      api.muscleTrends(28),
      api.prsThisMonth(),
    ])
    setDays(week.plan.days)
    setPlanName(week.plan.name)
    setLoad(week.load)
    setExercises(cat.exercises)
    setMetricsBody(body)
    setMetricsRuns(runs)
    setEquipment(eq)
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

  useEffect(() => {
    refresh().catch((e) => setError(String(e.message || e)))
  }, [refresh])

  useEffect(() => {
    const day = days.find((d) => d.date === sessionDate)
    if (!day) return
    setOpenExerciseId(null)
    api
      .session(sessionDate)
      .then((s) => {
        if (s.sets?.length) {
          setDraftSets(s.sets)
          setSessionRpe(s.session_rpe || 7)
          setSessionNotes(s.notes || '')
        } else {
          const sets: SessionSet[] = []
          day.exercises.forEach((ex) => {
            for (let i = 1; i <= 3; i++) {
              sets.push({ exercise_id: ex.id, set_index: i, reps: 10, weight_kg: undefined, rpe: 7, done: true })
            }
          })
          setDraftSets(sets)
        }
      })
      .catch(() => undefined)
  }, [sessionDate, days])

  const askCoach = async () => {
    setBusy(true)
    setError('')
    try {
      const res = await api.coachAdvise(coachNotes || undefined)
      setAdvice(res.advice)
      setAdviceSource(res.source)
      setLoad(res.load)
      setTab('hoy')
    } catch (e) {
      setError(String((e as Error).message || e))
    } finally {
      setBusy(false)
    }
  }

  const markDay = async (day: WeekDay, completed: boolean) => {
    await api.toggleDay(day.date, completed)
    await refresh()
  }

  const saveSession = async () => {
    setBusy(true)
    try {
      const day = days.find((d) => d.date === sessionDate)
      await api.saveSession({
        date: sessionDate,
        focus: day?.focus,
        completed: true,
        session_rpe: sessionRpe,
        notes: sessionNotes,
        sets: draftSets,
      })
      await refresh()
      setTab('semana')
    } catch (e) {
      setError(String((e as Error).message || e))
    } finally {
      setBusy(false)
    }
  }

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
      setTab('semana')
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

  const addEquipment = async () => {
    if (!equipmentName) return
    await api.addEquipment({
      name: equipmentName,
      equipment_type: equipmentType,
      weight_kg: equipmentWeight ? Number(equipmentWeight) : null,
    })
    setEquipmentName('')
    setEquipmentWeight('')
    await refresh()
  }

  const removeEquipment = async (id: number) => {
    await api.deleteEquipment(id)
    await refresh()
  }

  const getProgressionSuggestion = async (exerciseId: string, reps: number, weight: number, rpe: number) => {
    try {
      const suggestion = await api.suggestProgression({ exercise_id: exerciseId, reps, weight_kg: weight, session_rpe: rpe })
      setProgressionSuggestion(suggestion)
    } catch (e) {
      console.error(e)
    }
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

  const exMap = useMemo(() => Object.fromEntries(exercises.map((e) => [e.id, e])), [exercises])

  const exerciseGroups = useMemo(() => {
    const map = new Map<string, Array<SessionSet & { idx: number }>>()
    draftSets.forEach((s, idx) => {
      if (!map.has(s.exercise_id)) map.set(s.exercise_id, [])
      map.get(s.exercise_id)!.push({ ...s, idx })
    })
    return Array.from(map.entries()).map(([exercise_id, sets]) => ({ exercise_id, sets }))
  }, [draftSets])

  const updateSet = (idx: number, patch: Partial<SessionSet>) => {
    setDraftSets((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)))
  }

  return (
    <div className="mx-auto min-h-svh max-w-6xl px-4 py-6 sm:px-6">
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-primary">
            <Dumbbell className="size-5" />
            <span className="text-sm font-medium tracking-wide uppercase">Coach Fit</span>
          </div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Tu coach de casa
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Mancuernas · banco · dominadas · ligas · rueda. Rutina semanal, guías y carga según tus métricas.
          </p>
        </div>
        {load && (
          <Card className="min-w-[220px] border-primary/20 bg-primary/5">
            <CardContent className="space-y-1 pt-4 text-sm">
              <div className="flex items-center gap-2 font-medium">
                <Activity className="size-4 text-primary" /> Carga semanal
              </div>
              <div>{load.training_days} días · {Math.round(load.total_volume_kg)} kg</div>
              <div>RPE {load.avg_session_rpe ?? '—'} · strain {load.strain_index}</div>
              <div>{load.run_distance_km} km carrera</div>
            </CardContent>
          </Card>
        )}
      </header>

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        {/* !h-auto: TabsList fija h-8 con un selector de mayor especificidad y las filas envueltas desbordarían */}
        <TabsList className="mb-4 grid !h-auto w-full grid-cols-4 gap-1 sm:grid-cols-7">
          <TabsTrigger value="hoy" className="py-1.5">Hoy</TabsTrigger>
          <TabsTrigger value="semana" className="py-1.5">Semana</TabsTrigger>
          <TabsTrigger value="sesion" className="py-1.5">Registrar</TabsTrigger>
          <TabsTrigger value="equipo" className="py-1.5">Equipo</TabsTrigger>
          <TabsTrigger value="fuerza" className="py-1.5">Fuerza</TabsTrigger>
          <TabsTrigger value="cardio" className="py-1.5">Cardio</TabsTrigger>
          <TabsTrigger value="biblioteca" className="py-1.5">Ejercicios</TabsTrigger>
        </TabsList>

        <TabsContent value="hoy">
          <HoyTab
            load={load}
            days={days}
            todayDay={todayDay}
            coverage={coverage}
            onOpenExercise={setSelected}
            onMarkDay={markDay}
            onGoRegister={(day) => {
              setSessionDate(day.date)
              setTab('sesion')
            }}
            onGoTrain={setTrainingDay}
            onGoFuerza={() => setTab('fuerza')}
            coachNotes={coachNotes}
            onNotesChange={setCoachNotes}
            onAsk={askCoach}
            busy={busy}
            advice={advice}
            adviceSource={adviceSource}
          />
        </TabsContent>

        <TabsContent value="semana">
          <SemanaTab
            planName={planName}
            days={days}
            onOpenExercise={setSelected}
            onMarkDay={markDay}
            onGoRegister={(day) => {
              setSessionDate(day.date)
              setTab('sesion')
            }}
            onGoTrain={setTrainingDay}
          />
        </TabsContent>

        <TabsContent value="sesion" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Registro de sesión</CardTitle>
              <CardDescription>
                Por serie: repeticiones, kilos (o lastre) y RPE (esfuerzo 1–10). Alimenta la carga semanal y al coach.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Fecha</Label>
                  <Input type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>RPE sesión (1–10)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={sessionRpe}
                    onChange={(e) => setSessionRpe(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Notas</Label>
                  <Input value={sessionNotes} onChange={(e) => setSessionNotes(e.target.value)} placeholder="Cómo te sentiste" />
                </div>
              </div>

              <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                <strong className="font-medium text-foreground">RPE</strong> = qué tan duro sentiste la serie: 1 muy fácil,
                10 al fallo (no puedes hacer ni una repetición más).
              </p>

              <div className="space-y-3">
                {!draftSets.length && (
                  <p className="text-sm text-muted-foreground">Elige un día con ejercicios en la pestaña Semana.</p>
                )}

                {!!draftSets.length && !openExerciseId && (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {exerciseGroups.map((g) => {
                      const ex = exMap[g.exercise_id]
                      const filled = g.sets.filter((s) => !!s.reps && !!s.rpe).length
                      const complete = filled === g.sets.length
                      return (
                        <button
                          key={g.exercise_id}
                          type="button"
                          onClick={() => setOpenExerciseId(g.exercise_id)}
                          className="group overflow-hidden rounded-xl border bg-card text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                        >
                          <div className="aspect-square bg-muted/40">
                            {ex && <MediaImg image={ex.image} gif={ex.gif} alt={ex.name_es} className="h-full w-full object-contain p-2" />}
                          </div>
                          <div className="space-y-2 p-3">
                            <div className="line-clamp-2 text-sm font-medium text-foreground">
                              {ex?.name_es || g.exercise_id}
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {ex?.target && <Badge variant="secondary">{muscleES(ex.target)}</Badge>}
                              <Badge
                                variant="outline"
                                className={
                                  complete
                                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                    : filled === 0
                                      ? 'text-muted-foreground'
                                      : 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                }
                              >
                                {complete ? (
                                  <>
                                    <CheckCircle2 className="size-3" /> Completo
                                  </>
                                ) : (
                                  `${filled}/${g.sets.length} series`
                                )}
                              </Badge>
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}

                {!!openExerciseId &&
                  (() => {
                    const group = exerciseGroups.find((g) => g.exercise_id === openExerciseId)
                    if (!group) return null
                    const ex = exMap[group.exercise_id]
                    const isBodyweight = ex?.equipment === 'body weight'
                    return (
                      <div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mb-3 gap-1.5"
                          onClick={() => setOpenExerciseId(null)}
                        >
                          <ArrowLeft />
                          Volver a ejercicios
                        </Button>
                        <div className="mb-2 space-y-2">
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 rounded-lg border border-transparent p-1.5 text-left transition-colors hover:border-border hover:bg-muted/60"
                            onClick={() => ex && setSelected(ex)}
                          >
                            {ex?.image && <img src={ex.image} alt="" className="size-9 shrink-0 rounded border object-contain" />}
                            <span className="min-w-0">
                              <span className="block text-sm font-medium">{ex?.name_es || group.exercise_id}</span>
                              {ex?.target && (
                                <span className="block text-xs text-muted-foreground">
                                  {muscleES(ex.target)}
                                  {ex.secondary_muscles?.length
                                    ? ` · ${ex.secondary_muscles.map(muscleES).join(', ')}`
                                    : ''}
                                </span>
                              )}
                            </span>
                            <span className="ml-auto shrink-0 pr-1 text-xs font-medium text-primary">Ver guía →</span>
                          </button>
                          {isBodyweight && (
                            <p className="text-xs text-muted-foreground">
                              Peso corporal: deja Kg vacío (o 0). Solo pon kg si usas lastre.
                            </p>
                          )}
                          <div className="grid grid-cols-[auto_1fr_1fr_1fr] gap-2 px-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                            <span className="w-14">Serie</span>
                            <span>Reps</span>
                            <span>{isBodyweight ? 'Kg lastre' : 'Kg'}</span>
                            <span>RPE</span>
                          </div>
                        </div>
                        {group.sets.map((s) => (
                          <div key={s.idx} className="mb-2 grid grid-cols-[auto_1fr_1fr_1fr] items-center gap-2">
                            <div className="w-14 text-xs text-muted-foreground">{s.set_index}</div>
                            <Input
                              type="number"
                              inputMode="numeric"
                              aria-label={`Serie ${s.set_index} repeticiones`}
                              placeholder="10"
                              value={s.reps ?? ''}
                              onChange={(e) => updateSet(s.idx, { reps: Number(e.target.value) })}
                            />
                            <Input
                              type="number"
                              inputMode="decimal"
                              aria-label={
                                isBodyweight
                                  ? `Serie ${s.set_index} kilos de lastre (opcional)`
                                  : `Serie ${s.set_index} kilos`
                              }
                              placeholder={isBodyweight ? '0' : '12.5'}
                              value={s.weight_kg ?? ''}
                              onChange={(e) => updateSet(s.idx, { weight_kg: Number(e.target.value) })}
                            />
                            <Input
                              type="number"
                              inputMode="numeric"
                              aria-label={`Serie ${s.set_index} RPE del 1 al 10`}
                              placeholder="7"
                              min="1"
                              max="10"
                              value={s.rpe ?? ''}
                              onChange={(e) => updateSet(s.idx, { rpe: Number(e.target.value) })}
                            />
                          </div>
                        ))}
                        {(() => {
                          const last = group.sets[group.sets.length - 1]
                          {/* !! evita el clásico "0" fantasma de JSX cuando weight_kg es 0 (peso corporal) */}
                          return (
                            !!last?.reps &&
                            !!last?.rpe && (
                              <Button
                                variant="link"
                                size="sm"
                                className="mb-3 gap-1.5 px-0"
                                onClick={() =>
                                  getProgressionSuggestion(last.exercise_id, last.reps!, last.weight_kg || 0, last.rpe!)
                                }
                              >
                                <TrendingUp />
                                Sugerir progresión
                              </Button>
                            )
                          )
                        })()}
                      </div>
                    )
                  })()}
              </div>

              {progressionSuggestion && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                  <div className="flex items-start gap-2">
                    <Lightbulb className="size-4 text-primary mt-0.5 flex-shrink-0" />
                    <div className="text-sm space-y-1">
                      <div className="font-medium">{progressionSuggestion.recommendation}</div>
                      <div className="text-xs text-muted-foreground">
                        Próxima vez: {progressionSuggestion.next_reps} reps × {progressionSuggestion.next_weight_kg} kg
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <Button onClick={saveSession} disabled={busy || !draftSets.length} className="gap-2">
                {busy ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                Guardar sesión y marcar día
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="equipo">
          <EquipoTab
            planName={planName}
            equipment={equipment}
            equipmentName={equipmentName}
            equipmentType={equipmentType}
            equipmentWeight={equipmentWeight}
            onEquipmentNameChange={setEquipmentName}
            onEquipmentTypeChange={setEquipmentType}
            onEquipmentWeightChange={setEquipmentWeight}
            onAddEquipment={addEquipment}
            onRemoveEquipment={removeEquipment}
          />
        </TabsContent>

        <TabsContent value="fuerza">
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
        </TabsContent>

        <TabsContent value="cardio">
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
        </TabsContent>

        <TabsContent value="biblioteca">
          <EjerciciosTab exercises={exercises} onOpenExercise={setSelected} />
        </TabsContent>
      </Tabs>

      <GuideModal ex={selected} onClose={() => setSelected(null)} />

      {trainingDay && (
        <TrainingMode
          day={trainingDay}
          equipment={equipment}
          onExit={() => setTrainingDay(null)}
          onFinish={finishTraining}
        />
      )}
    </div>
  )
}
