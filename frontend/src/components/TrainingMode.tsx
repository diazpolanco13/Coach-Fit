import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import { Check, CheckCircle2, Loader2, Minus, Plus, X } from 'lucide-react'
import { api, type SessionSet, type UserEquipment, type WeekDay } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { MediaImg } from '@/components/MediaImg'
import { equipmentES } from '@/lib/equipment'
import { muscleES } from '@/lib/muscle'
import { getRestSeconds } from '@/lib/settings'
import { cn } from '@/lib/utils'
import {
  avgRpe,
  dumbbellWeights,
  initialTrainingState,
  seedExercise,
  sessionVolume,
  toSessionSets,
  totalSets,
  trainingReducer,
} from '@/lib/training'

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

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
  onFinish: (sets: SessionSet[], sessionRpe: number, notes: string) => Promise<void>
}) {
  const [equipment, setEquipment] = useState<UserEquipment[]>([])
  const [state, dispatch] = useReducer(trainingReducer, initialTrainingState)
  const [rpe, setRpe] = useState(7)
  const [sessionRpe, setSessionRpe] = useState(7)
  const [sessionNotes, setSessionNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const restSeconds = useMemo(() => getRestSeconds(), [])

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
    Promise.all(
      day.items.map((item) =>
        api
          .dashboardExerciseHistory(item.exercise_id)
          .then((h) => h.history[h.history.length - 1])
          .catch(() => undefined),
      ),
    ).then((lasts) => {
      if (cancelled) return
      dispatch({
        type: 'INIT',
        exs: day.items.map((item, i) => seedExercise(item, lasts[i], weights)),
        now: Date.now(),
      })
    })
    return () => {
      cancelled = true
    }
  }, [day, equipment])

  // El temporizador se re-arma en cada segundo en lugar de mantener un intervalo vivo,
  // así una pausa o un cambio de fase no puede dejar ticks huérfanos corriendo.
  useEffect(() => {
    if (state.phase !== 'rest') return
    const t = setTimeout(() => dispatch({ type: 'TICK' }), 1000)
    return () => clearTimeout(t)
  }, [state.phase, state.restLeft])

  useEffect(() => {
    if (state.phase === 'done') setSessionRpe(avgRpe(state.log))
  }, [state.phase, state.log])

  const handleExit = useCallback(() => {
    if (!state.log.length || window.confirm('¿Salir del entrenamiento? Se perderán las series no guardadas.')) {
      onExit()
    }
  }, [state.log.length, onExit])

  const handleSave = async () => {
    setSaving(true)
    try {
      await onFinish(toSessionSets(state.log), sessionRpe, sessionNotes)
    } finally {
      setSaving(false)
    }
  }

  const ex = state.exs[state.ti]
  const plannedSets = totalSets(state.exs)
  const doneSets = state.log.length
  const isBodyweight = ex?.equipment === 'body weight'
  const durationMin = Math.max(1, Math.round(((state.finishedAt ?? Date.now()) - state.startedAt) / 60000))

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <div className="kicker truncate">{day.label}</div>
          <div className="text-sm text-muted-foreground">
            {state.phase === 'loading'
              ? 'Preparando…'
              : state.phase === 'done'
                ? 'Entrenamiento completado'
                : `Ejercicio ${state.ti + 1} de ${state.exs.length} · ${doneSets}/${plannedSets} series`}
          </div>
        </div>
        <button
          type="button"
          onClick={handleExit}
          aria-label="Salir del entrenamiento"
          className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-5" />
        </button>
      </header>

      <Progress
        value={plannedSets ? (doneSets / plannedSets) * 100 : 0}
        className="h-1 rounded-none"
        indicatorClassName="bg-primary"
      />

      <main className="flex-1 overflow-auto p-4">
        {state.phase === 'loading' && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="size-8 animate-spin" />
            <p className="text-sm">Preparando tu entrenamiento…</p>
          </div>
        )}

        {state.phase === 'work' && ex && (
          <div className="mx-auto flex max-w-md flex-col gap-4">
            <div className="overflow-hidden rounded-xl border bg-white">
              <MediaImg
                image={ex.image}
                gif={ex.gif}
                alt={ex.name_es}
                preferGif
                className="mx-auto max-h-56 w-full object-contain"
              />
            </div>

            <div>
              <h2 className="font-heading text-2xl leading-tight font-extrabold">{ex.name_es}</h2>
              <p className="text-sm text-muted-foreground">
                {muscleES(ex.target)} · {equipmentES(ex.equipment)}
              </p>
            </div>

            <div className="flex gap-2">
              {Array.from({ length: ex.sets }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex size-9 items-center justify-center rounded-lg border text-sm font-semibold',
                    i < state.si && 'border-primary/30 bg-primary/10 text-primary',
                    i === state.si && 'border-primary bg-primary text-primary-foreground',
                    i > state.si && 'text-muted-foreground',
                  )}
                >
                  {i < state.si ? <Check className="size-4" /> : i + 1}
                </div>
              ))}
            </div>

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
              onClick={() => dispatch({ type: 'COMPLETE_SET', rpe, restSeconds, now: Date.now() })}
            >
              <Check className="size-5" />
              Completar serie {state.si + 1} de {ex.sets}
            </Button>
          </div>
        )}

        {state.phase === 'rest' && ex && (
          <div className="mx-auto flex max-w-md flex-col items-center gap-5 pt-6 text-center">
            <div className="kicker">Descanso</div>
            <div className="font-heading text-7xl font-extrabold tabular-nums text-primary">{mmss(state.restLeft)}</div>
            <Progress
              value={state.restTotal ? (state.restLeft / state.restTotal) * 100 : 0}
              className="h-2 w-full"
              indicatorClassName="bg-primary"
            />
            <p className="text-sm text-muted-foreground">
              Siguiente: <strong className="text-foreground">{ex.name_es}</strong> · serie {state.si + 1} de {ex.sets}
            </p>
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
              <p className="text-sm text-muted-foreground">Revisa y guarda para que cuente en tu carga semanal.</p>
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

            <div className="space-y-1.5">
              <Label>RPE de la sesión (1–10)</Label>
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
              <Input
                value={sessionNotes}
                onChange={(e) => setSessionNotes(e.target.value)}
                placeholder="Cómo te sentiste"
              />
            </div>

            <Button size="lg" className="w-full gap-2" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="size-5 animate-spin" /> : <Check className="size-5" />}
              Guardar sesión
            </Button>
          </div>
        )}
      </main>
    </div>
  )
}
