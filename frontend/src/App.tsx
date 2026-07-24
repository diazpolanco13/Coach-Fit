import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  Bot,
  CalendarDays,
  CheckCircle2,
  Dumbbell,
  Footprints,
  Loader2,
  Scale,
  Sparkles,
} from 'lucide-react'
import { api, type Exercise, type SessionSet, type WeekDay, type WeekLoad } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function markdownLite(text: string) {
  return text.split('\n').map((line, i) => {
    const t = line.trim()
    if (t.startsWith('### '))
      return (
        <h3 key={i} className="mt-4 text-base font-semibold text-foreground">
          {t.slice(4)}
        </h3>
      )
    if (t.startsWith('## '))
      return (
        <h2 key={i} className="mt-5 text-lg font-semibold text-foreground">
          {t.slice(3)}
        </h2>
      )
    if (t.startsWith('- '))
      return (
        <li key={i} className="ml-4 list-disc text-sm leading-relaxed text-muted-foreground">
          {t.slice(2).replace(/\*\*(.*?)\*\*/g, '$1')}
        </li>
      )
    if (!t) return <div key={i} className="h-2" />
    return (
      <p key={i} className="text-sm leading-relaxed text-muted-foreground">
        {t.replace(/\*\*(.*?)\*\*/g, '$1')}
      </p>
    )
  })
}

function MediaImg({
  image,
  gif,
  alt,
  className,
  preferGif = false,
}: {
  image?: string | null
  gif?: string | null
  alt: string
  className?: string
  preferGif?: boolean
}) {
  const primary = preferGif ? gif || image : image || gif
  const fallback = preferGif ? image : gif
  return (
    <img
      src={primary || ''}
      alt={alt}
      className={className}
      loading="lazy"
      onError={(e) => {
        const el = e.currentTarget
        if (fallback && el.src !== fallback && !el.dataset.fallback) {
          el.dataset.fallback = '1'
          el.src = fallback
        }
      }}
    />
  )
}

function ExerciseCard({
  ex,
  onOpen,
}: {
  ex: Exercise
  onOpen: (ex: Exercise) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(ex)}
      className="group overflow-hidden rounded-xl border bg-card text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="aspect-square bg-muted/40">
        <MediaImg
          image={ex.image}
          gif={ex.gif}
          alt={ex.name_es}
          className="h-full w-full object-contain p-2"
        />
      </div>
      <div className="space-y-2 p-3">
        <div className="line-clamp-2 text-sm font-medium text-foreground">{ex.name_es}</div>
        <div className="flex flex-wrap gap-1">
          <Badge variant="secondary">{ex.role}</Badge>
          <Badge variant="outline">{ex.equipment}</Badge>
        </div>
      </div>
    </button>
  )
}

function GuideModal({
  ex,
  onClose,
}: {
  ex: Exercise | null
  onClose: () => void
}) {
  if (!ex) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={onClose}>
      <Card className="max-h-[90vh] w-full max-w-lg overflow-auto" onClick={(e) => e.stopPropagation()}>
        <CardHeader>
          <CardTitle>{ex.name_es}</CardTitle>
          <CardDescription>
            {ex.target} · {ex.equipment} · {ex.body_part}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <MediaImg
            image={ex.image}
            gif={ex.gif}
            alt={ex.name_es}
            preferGif
            className="mx-auto max-h-56 object-contain"
          />
          <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            {ex.guide_es.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
          <Button className="w-full" onClick={onClose}>
            Cerrar
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

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

  const [weight, setWeight] = useState('')
  const [runKm, setRunKm] = useState('')
  const [runMin, setRunMin] = useState('')
  const [metricsBody, setMetricsBody] = useState<Array<{ id: number; date: string; weight_kg: number }>>([])
  const [metricsRuns, setMetricsRuns] = useState<
    Array<{ id: number; date: string; distance_km: number; duration_min?: number }>
  >([])

  const todayDay = useMemo(() => {
    const t = todayISO()
    return days.find((d) => d.date === t) || days.find((d) => d.weekday === new Date().getDay() - 1) || days[0]
  }, [days])

  const refresh = useCallback(async () => {
    setError('')
    const [week, cat, body, runs, latest] = await Promise.all([
      api.week(),
      api.catalog(),
      api.bodyMetrics(),
      api.runs(),
      api.coachLatest(),
    ])
    setDays(week.plan.days)
    setPlanName(week.plan.name)
    setLoad(week.load)
    setExercises(cat.exercises)
    setMetricsBody(body)
    setMetricsRuns(runs)
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
              sets.push({ exercise_id: ex.id, set_index: i, reps: 10, weight_kg: 0, rpe: 7, done: true })
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

  const exMap = useMemo(() => Object.fromEntries(exercises.map((e) => [e.id, e])), [exercises])

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
        <TabsList className="mb-4 grid h-auto w-full grid-cols-2 sm:grid-cols-5">
          <TabsTrigger value="hoy">Hoy / Coach</TabsTrigger>
          <TabsTrigger value="semana">Semana</TabsTrigger>
          <TabsTrigger value="sesion">Registrar</TabsTrigger>
          <TabsTrigger value="metricas">Métricas</TabsTrigger>
          <TabsTrigger value="biblioteca">Ejercicios</TabsTrigger>
        </TabsList>

        <TabsContent value="hoy" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="size-5 text-primary" />
                  Coach inteligente
                </CardTitle>
                <CardDescription>
                  Propone qué hacer según volumen, RPE, días entrenados, peso y carreras.
                  {adviceSource ? ` Fuente: ${adviceSource === 'vllm' ? 'Gemma local' : 'reglas locales'}.` : ''}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Label htmlFor="notes">Notas para el coach (opcional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Ej: me duele el hombro izquierdo, dormí mal, quiero bajar de peso..."
                  value={coachNotes}
                  onChange={(e) => setCoachNotes(e.target.value)}
                />
                <Button onClick={askCoach} disabled={busy} className="gap-2">
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                  Pedir recomendación
                </Button>
                <Separator />
                <div className="max-h-[420px] overflow-auto pr-1">{advice ? markdownLite(advice) : (
                  <p className="text-sm text-muted-foreground">Aún no hay consejo. Pide una recomendación.</p>
                )}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{todayDay?.label || 'Hoy'}</CardTitle>
                <CardDescription>
                  {todayDay?.date}
                  {todayDay?.completed ? ' · completado' : ' · pendiente'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {todayDay?.exercises?.length ? (
                  <div className="grid grid-cols-2 gap-3">
                    {todayDay.exercises.map((ex) => (
                      <ExerciseCard key={ex.id} ex={ex} onOpen={setSelected} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Día de descanso o sin ejercicios planificados.</p>
                )}
                {todayDay && (
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant={todayDay.completed ? 'secondary' : 'default'}
                      className="gap-2"
                      onClick={() => markDay(todayDay, !todayDay.completed)}
                    >
                      <CheckCircle2 className="size-4" />
                      {todayDay.completed ? 'Desmarcar día' : 'Marcar entrenado'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSessionDate(todayDay.date)
                        setTab('sesion')
                      }}
                    >
                      Registrar series
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="semana" className="space-y-4">
          <div className="flex items-center gap-2">
            <CalendarDays className="size-5 text-primary" />
            <h2 className="text-xl font-semibold">{planName}</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {days.map((day) => (
              <Card key={day.date} className={day.completed ? 'border-primary/40' : ''}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">{day.label}</CardTitle>
                      <CardDescription>{day.date}</CardDescription>
                    </div>
                    {day.completed ? <Badge>Hecho</Badge> : <Badge variant="outline">{day.focus}</Badge>}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {day.exercises.slice(0, 6).map((ex) => (
                      <button key={ex.id} type="button" onClick={() => setSelected(ex)} className="size-12 overflow-hidden rounded-md border bg-muted/30">
                        <img src={ex.image || ''} alt={ex.name_es} className="h-full w-full object-contain" />
                      </button>
                    ))}
                    {!day.exercises.length && (
                      <span className="text-sm text-muted-foreground">Descanso / carrera opcional</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Vol {Math.round(day.volume_kg || 0)} kg
                    {day.session_rpe ? ` · RPE ${day.session_rpe}` : ''}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => markDay(day, !day.completed)}>
                      {day.completed ? 'Desmarcar' : 'Marcar'}
                    </Button>
                    {!!day.exercises.length && (
                      <Button
                        size="sm"
                        onClick={() => {
                          setSessionDate(day.date)
                          setTab('sesion')
                        }}
                      >
                        Registrar
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="sesion" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Registro de sesión</CardTitle>
              <CardDescription>Series, peso, reps y RPE. Esto alimenta la carga semanal y al coach.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <Label>Fecha</Label>
                  <Input type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} />
                </div>
                <div>
                  <Label>RPE sesión (1–10)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={sessionRpe}
                    onChange={(e) => setSessionRpe(Number(e.target.value))}
                  />
                </div>
                <div>
                  <Label>Notas</Label>
                  <Input value={sessionNotes} onChange={(e) => setSessionNotes(e.target.value)} placeholder="Cómo te sentiste" />
                </div>
              </div>

              <div className="space-y-3">
                {draftSets.map((s, idx) => {
                  const ex = exMap[s.exercise_id]
                  const showHeader = idx === 0 || draftSets[idx - 1].exercise_id !== s.exercise_id
                  return (
                    <div key={`${s.exercise_id}-${s.set_index}-${idx}`}>
                      {showHeader && (
                        <button
                          type="button"
                          className="mb-2 flex items-center gap-2 text-left text-sm font-medium"
                          onClick={() => ex && setSelected(ex)}
                        >
                          {ex?.image && <img src={ex.image} alt="" className="size-8 rounded border object-contain" />}
                          {ex?.name_es || s.exercise_id}
                        </button>
                      )}
                      <div className="mb-2 grid grid-cols-4 gap-2">
                        <Input
                          type="number"
                          placeholder="Reps"
                          value={s.reps ?? ''}
                          onChange={(e) => updateSet(idx, { reps: Number(e.target.value) })}
                        />
                        <Input
                          type="number"
                          placeholder="Kg"
                          value={s.weight_kg ?? ''}
                          onChange={(e) => updateSet(idx, { weight_kg: Number(e.target.value) })}
                        />
                        <Input
                          type="number"
                          placeholder="RPE"
                          value={s.rpe ?? ''}
                          onChange={(e) => updateSet(idx, { rpe: Number(e.target.value) })}
                        />
                        <div className="flex items-center text-xs text-muted-foreground">Serie {s.set_index}</div>
                      </div>
                    </div>
                  )
                })}
                {!draftSets.length && (
                  <p className="text-sm text-muted-foreground">Elige un día con ejercicios en la pestaña Semana.</p>
                )}
              </div>

              <Button onClick={saveSession} disabled={busy || !draftSets.length} className="gap-2">
                {busy ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                Guardar sesión y marcar día
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metricas" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Scale className="size-5" /> Peso corporal
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Input type="number" step="0.1" placeholder="kg" value={weight} onChange={(e) => setWeight(e.target.value)} />
                  <Button onClick={saveWeight}>Guardar</Button>
                </div>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {metricsBody.slice(0, 8).map((m) => (
                    <li key={m.id}>
                      {m.date}: <span className="font-medium text-foreground">{m.weight_kg} kg</span>
                    </li>
                  ))}
                  {!metricsBody.length && <li>Sin registros aún.</li>}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Footprints className="size-5" /> Carreras
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <Input type="number" step="0.1" placeholder="km" value={runKm} onChange={(e) => setRunKm(e.target.value)} />
                  <Input type="number" step="1" placeholder="min" value={runMin} onChange={(e) => setRunMin(e.target.value)} />
                </div>
                <Button onClick={saveRun}>Guardar carrera</Button>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {metricsRuns.slice(0, 8).map((r) => (
                    <li key={r.id}>
                      {r.date}: <span className="font-medium text-foreground">{r.distance_km} km</span>
                      {r.duration_min ? ` · ${r.duration_min} min` : ''}
                    </li>
                  ))}
                  {!metricsRuns.length && <li>Sin carreras aún.</li>}
                </ul>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="biblioteca">
          <div className="mb-3 text-sm text-muted-foreground">{exercises.length} ejercicios para tu equipo</div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {exercises.map((ex) => (
              <ExerciseCard key={ex.id} ex={ex} onOpen={setSelected} />
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <GuideModal ex={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
