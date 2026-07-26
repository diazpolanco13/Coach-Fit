import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, CheckCircle2, Lightbulb, Loader2, Plus, X } from 'lucide-react'
import {
  api,
  type Exercise,
  type ProgressionSuggestion,
  type SessionSet,
  type WeekDay,
} from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MediaImg } from '@/components/MediaImg'
import { AddExercisePicker } from '@/components/session/AddExercisePicker'
import { SetListEditor } from '@/components/session/SetListEditor'
import { useNav } from '@/components/shell/NavContext'
import { muscleES } from '@/lib/muscle'
import * as draft from '@/lib/sessionDraft'
import { setKey } from '@/lib/sessionDraft'
import { DEFAULT_REPS, midReps } from '@/lib/training'
import { todayISO } from '@/lib/utils'

export function RegistrarScreen({
  days,
  exercises,
  initialDate,
  gymId,
  onSaved,
  onOpenExercise,
}: {
  days: WeekDay[]
  exercises: Exercise[]
  initialDate?: string
  /** Espacio donde se entrena ahora: la escalera de mancuernas de la sugerencia
   *  de progresión depende de él. */
  gymId: number | null
  onSaved: () => Promise<void>
  onOpenExercise: (ex: Exercise) => void
}) {
  const { goBack } = useNav()
  const [sessionDate, setSessionDate] = useState(initialDate || todayISO())
  const [sessionRpe, setSessionRpe] = useState(7)
  const [sessionNotes, setSessionNotes] = useState('')
  const [draftSets, setDraftSets] = useState<SessionSet[]>([])
  // El formulario siembra reps y RPE 7 por comodidad, así que los valores por sí
  // solos no distinguen "ya registrado" de "aún sin tocar". Esto marca las series
  // que vienen de una sesión guardada o que el usuario ha editado.
  const [loggedSets, setLoggedSets] = useState<Set<string>>(new Set())
  const [openExerciseId, setOpenExerciseId] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)
  const [suggestion, setSuggestion] = useState<ProgressionSuggestion | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (initialDate) setSessionDate(initialDate)
  }, [initialDate])

  const exMap = useMemo(
    () => Object.fromEntries(exercises.map((e) => [e.id, e])),
    [exercises],
  )

  useEffect(() => {
    // Sin `day` (una fecha fuera de la semana en curso) ya no se sale sin hacer
    // nada: eso dejaba en pantalla el borrador de la fecha anterior. Se carga la
    // sesión igual y el prefill del plan simplemente queda vacío.
    const day = days.find((d) => d.date === sessionDate)
    setOpenExerciseId(null)
    setPicking(false)
    api
      .session(sessionDate)
      .then((s) => {
        if (s.sets?.length) {
          setDraftSets(s.sets)
          // Solo las marcadas como hechas son datos reales. Las que se guardaron
          // sin tocar (`done: false`) vuelven al formulario como prefill, no
          // como registro: si contaran, editar el día las convertiría en ciertas
          // sin que nadie las mirara.
          setLoggedSets(new Set(s.sets.filter((x) => x.done !== false).map(setKey)))
          setSessionRpe(s.session_rpe || 7)
          setSessionNotes(s.notes || '')
        } else {
          // Una sola serie por ejercicio, no las que prescribe el plan. Sembrar
          // las 3 previstas es pedirle al usuario que borre lo que no hizo en vez
          // de anotar lo que hizo; el plan sigue visible como contexto dentro del
          // editor. Las reps salen del centro del rango: con el 8–12 por defecto,
          // 10.
          const sets: SessionSet[] = (day?.items ?? []).map((item) => ({
            exercise_id: item.exercise_id,
            set_index: 1,
            reps: midReps(item),
            weight_kg: undefined,
            rpe: 7,
            done: false,
          }))
          setDraftSets(sets)
          setLoggedSets(new Set())
        }
      })
      .catch(() => undefined)
  }, [sessionDate, days])

  /** Lo que el plan prescribe hoy, por ejercicio. Solo es contexto: el registro
   *  no lo usa para sembrar series. */
  const planItems = useMemo(() => {
    const day = days.find((d) => d.date === sessionDate)
    return Object.fromEntries((day?.items ?? []).map((i) => [i.exercise_id, i]))
  }, [days, sessionDate])

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
    const s = draftSets[idx]
    if (s) setLoggedSets((prev) => (prev.has(setKey(s)) ? prev : new Set(prev).add(setKey(s))))
  }

  /** Añade un ejercicio que no está en el plan del día: el extra de un día de
   *  descanso, o lo que se improvisa sobre la marcha.
   *
   *  Las series entran como prefill, igual que las del plan y por el mismo
   *  motivo: elegir el ejercicio dice qué hiciste, no cuánto. Cuentan cuando se
   *  rellenan. */
  const addExercise = (ex: Exercise) => {
    setDraftSets((prev) => {
      if (prev.some((s) => s.exercise_id === ex.id)) return prev
      const first: SessionSet = {
        exercise_id: ex.id,
        set_index: 1,
        reps: DEFAULT_REPS,
        weight_kg: undefined,
        rpe: 7,
        done: false,
      }
      return [...prev, first]
    })
    setPicking(false)
    setOpenExerciseId(ex.id)
  }

  /** Las tres operaciones que reordenan o renumeran viven en `lib/sessionDraft`
   *  como funciones puras: mantener `draftSets` y `loggedSets` coherentes es
   *  fácil de romper y ahí se puede probar sin montar la pantalla. */
  const apply = (next: draft.SessionDraft) => {
    setDraftSets(next.sets)
    setLoggedSets(next.logged)
  }

  const removeExercise = (exerciseId: string) => {
    apply(draft.removeExercise({ sets: draftSets, logged: loggedSets }, exerciseId))
    setOpenExerciseId((cur) => (cur === exerciseId ? null : cur))
  }

  const addSet = (exerciseId: string) =>
    apply(draft.addSet({ sets: draftSets, logged: loggedSets }, exerciseId))

  const removeSet = (exerciseId: string, setIndex: number) =>
    apply(draft.removeSet({ sets: draftSets, logged: loggedSets }, exerciseId, setIndex))

  const saveSession = async () => {
    setBusy(true)
    setError('')
    try {
      const day = days.find((d) => d.date === sessionDate)
      await api.saveSession({
        date: sessionDate,
        focus: day?.focus,
        completed: true,
        session_rpe: sessionRpe,
        notes: sessionNotes,
        // `done` sale de lo que el usuario tocó de verdad, no del prefill. Una
        // serie sembrada y nunca editada se guarda con `done: false`: queda como
        // lo que estaba previsto, y todas las agregaciones (volumen, RPE medio,
        // cobertura) la ignoran porque filtran por `ss.done = 1`. Antes se
        // guardaban todas en true, y un día abierto y guardado sin escribir nada
        // producía series con `weight_kg` nulo y RPE 7 indistinguibles de las
        // reales — de ahí los «0 kg» con 18 series registradas.
        sets: draftSets.map((s) => ({ ...s, done: loggedSets.has(setKey(s)) })),
        // Esta pantalla hidrata la sesión guardada antes de dejar editar, así
        // que `draftSets` ES el día entero: puede declarar el reemplazo y con
        // eso quitar una serie sigue siendo posible.
        mode: 'replace',
      })
      await onSaved()
    } catch (e) {
      setError(String((e as Error).message || e))
    } finally {
      setBusy(false)
    }
  }

  const askProgression = async (
    exerciseId: string,
    reps: number,
    weightKg: number,
    rpe: number,
  ) => {
    try {
      setSuggestion(
        await api.suggestProgression({
          exercise_id: exerciseId,
          reps,
          weight_kg: weightKg,
          session_rpe: rpe,
          gym_id: gymId ?? undefined,
        }),
      )
    } catch (e) {
      setError(String((e as Error).message || e))
    }
  }

  return (
    <div className="space-y-3">
      <Button variant="ghost" size="sm" className="-ml-2 gap-1.5 text-muted-foreground" onClick={goBack}>
        <ArrowLeft className="size-3.5" />
        Volver
      </Button>
    <Card>
      <CardHeader>
        <CardTitle>Registro de sesión</CardTitle>
        <CardDescription>
          Por serie: repeticiones, kilos (o lastre) y RPE (esfuerzo 1–10). Alimenta la carga semanal
          y al coach.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <p className="rounded-lg border border-destructive/40 p-2.5 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Fecha</Label>
            <Input
              type="date"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
            />
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
            <Input
              value={sessionNotes}
              onChange={(e) => setSessionNotes(e.target.value)}
              placeholder="Cómo te sentiste"
            />
          </div>
        </div>

        <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          <strong className="font-medium text-foreground">RPE</strong> = qué tan duro sentiste la
          serie: 1 muy fácil, 10 al fallo (no puedes hacer ni una repetición más).
        </p>

        <div className="space-y-3">
          {!openExerciseId && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                {draftSets.length
                  ? `${exerciseGroups.length} ${exerciseGroups.length === 1 ? 'ejercicio' : 'ejercicios'} en la sesión`
                  : // Un día sin plan no es un callejón sin salida: el extra
                    // suelto de un día de descanso se registra igual.
                    'Este día no tiene ejercicios programados. Puedes añadir los que hayas hecho.'}
              </p>
              {!picking && (
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setPicking(true)}>
                  <Plus className="size-3.5" />
                  Añadir ejercicio
                </Button>
              )}
            </div>
          )}

          {picking && !openExerciseId && (
            <AddExercisePicker
              present={new Set(draftSets.map((s) => s.exercise_id))}
              onAdd={addExercise}
              onClose={() => setPicking(false)}
            />
          )}

          {!!draftSets.length && !openExerciseId && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {exerciseGroups.map((g) => {
                const ex = exMap[g.exercise_id]
                // El denominador ya no es una meta: las filas las decide quien
                // registra. Así que se cuenta lo hecho, sin «0/3» que reproche
                // series que quizá nunca se pensaron hacer.
                const filled = g.sets.filter((s) => loggedSets.has(setKey(s))).length
                return (
                  // La X va como hermana del botón y no dentro: un <button>
                  // anidado en otro es HTML inválido y el clic se vuelve
                  // impredecible.
                  <div key={g.exercise_id} className="relative">
                    <button
                      type="button"
                      onClick={() => removeExercise(g.exercise_id)}
                      aria-label={`Quitar ${ex?.name_es || g.exercise_id} de la sesión`}
                      className="absolute top-1.5 right-1.5 z-10 flex size-7 items-center justify-center rounded-full border bg-background/90 text-muted-foreground shadow-sm transition-colors hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                    >
                      <X className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpenExerciseId(g.exercise_id)}
                      className="group w-full overflow-hidden rounded-xl border bg-card text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <div className="aspect-square bg-muted/40">
                        {ex && (
                          <MediaImg
                            image={ex.image}
                            gif={ex.gif}
                            alt={ex.name_es}
                            className="h-full w-full object-contain p-2"
                          />
                        )}
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
                              filled === 0
                                ? 'text-muted-foreground'
                                : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            }
                          >
                            {filled === 0 ? (
                              'sin registrar'
                            ) : (
                              <>
                                <CheckCircle2 className="size-3" /> {filled}{' '}
                                {filled === 1 ? 'serie' : 'series'}
                              </>
                            )}
                          </Badge>
                        </div>
                      </div>
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {!!openExerciseId &&
            (() => {
              const group = exerciseGroups.find((g) => g.exercise_id === openExerciseId)
              if (!group) return null
              return (
                <SetListEditor
                  exerciseId={group.exercise_id}
                  exercise={exMap[group.exercise_id]}
                  planItem={planItems[group.exercise_id]}
                  sets={group.sets}
                  onUpdate={updateSet}
                  onAddSet={() => addSet(group.exercise_id)}
                  onRemoveSet={(setIndex) => removeSet(group.exercise_id, setIndex)}
                  onRemoveExercise={() => removeExercise(group.exercise_id)}
                  onBack={() => setOpenExerciseId(null)}
                  onOpenGuide={onOpenExercise}
                  onSuggestProgression={askProgression}
                />
              )
            })()}
        </div>

        {suggestion && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
            <div className="flex items-start gap-2">
              <Lightbulb className="mt-0.5 size-4 flex-shrink-0 text-primary" />
              <div className="space-y-1 text-sm">
                <div className="font-medium">{suggestion.recommendation}</div>
                <div className="text-xs text-muted-foreground">
                  Próxima vez: {suggestion.next_reps} reps × {suggestion.next_weight_kg} kg
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
    </div>
  )
}
