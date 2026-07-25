import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, CheckCircle2, Lightbulb, Loader2, TrendingUp } from 'lucide-react'
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
import { useNav } from '@/components/shell/NavContext'
import { muscleES } from '@/lib/muscle'
import { DEFAULT_SETS, midReps } from '@/lib/training'
import { todayISO } from '@/lib/utils'

/** Identifica una serie de forma estable, sin depender de su posición. */
const setKey = (s: { exercise_id: string; set_index: number }) => `${s.exercise_id}:${s.set_index}`

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
    const day = days.find((d) => d.date === sessionDate)
    if (!day) return
    setOpenExerciseId(null)
    api
      .session(sessionDate)
      .then((s) => {
        if (s.sets?.length) {
          setDraftSets(s.sets)
          // Una sesión ya guardada son datos reales: cuentan como registradas.
          setLoggedSets(new Set(s.sets.map(setKey)))
          setSessionRpe(s.session_rpe || 7)
          setSessionNotes(s.notes || '')
        } else {
          const sets: SessionSet[] = []
          day.items.forEach((item) => {
            // Series y reps salen del plan. El prefill toma el centro del rango:
            // con el 8–12 por defecto sale 10, el mismo valor que se sembraba
            // antes a mano, así que nadie nota el cambio si no ha tocado el plan.
            const n = item.sets || DEFAULT_SETS
            const reps = midReps(item)
            for (let i = 1; i <= n; i++) {
              sets.push({
                exercise_id: item.exercise_id,
                set_index: i,
                reps,
                weight_kg: undefined,
                rpe: 7,
                done: true,
              })
            }
          })
          setDraftSets(sets)
          setLoggedSets(new Set())
        }
      })
      .catch(() => undefined)
  }, [sessionDate, days])

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
        sets: draftSets,
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
          {!draftSets.length && (
            <p className="text-sm text-muted-foreground">
              Elige una fecha con ejercicios programados en tu plan activo.
            </p>
          )}

          {!!draftSets.length && !openExerciseId && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {exerciseGroups.map((g) => {
                const ex = exMap[g.exercise_id]
                const filled = g.sets.filter((s) => loggedSets.has(setKey(s))).length
                const complete = filled === g.sets.length
                return (
                  <button
                    key={g.exercise_id}
                    type="button"
                    onClick={() => setOpenExerciseId(g.exercise_id)}
                    className="group overflow-hidden rounded-xl border bg-card text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
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
              const last = group.sets[group.sets.length - 1]
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
                      onClick={() => ex && onOpenExercise(ex)}
                    >
                      {ex?.image && (
                        <img
                          src={ex.image}
                          alt=""
                          className="size-9 shrink-0 rounded border object-contain"
                        />
                      )}
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">
                          {ex?.name_es || group.exercise_id}
                        </span>
                        {ex?.target && (
                          <span className="block text-xs text-muted-foreground">
                            {muscleES(ex.target)}
                            {ex.secondary_muscles?.length
                              ? ` · ${ex.secondary_muscles.map(muscleES).join(', ')}`
                              : ''}
                          </span>
                        )}
                      </span>
                      <span className="ml-auto shrink-0 pr-1 text-xs font-medium text-primary">
                        Ver guía →
                      </span>
                    </button>
                    {isBodyweight && (
                      <p className="text-xs text-muted-foreground">
                        Peso corporal: deja Kg vacío (o 0). Solo pon kg si usas lastre.
                      </p>
                    )}
                    <div className="grid grid-cols-[auto_1fr_1fr_1fr] gap-2 px-0.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                      <span className="w-14">Serie</span>
                      <span>Reps</span>
                      <span>{isBodyweight ? 'Kg lastre' : 'Kg'}</span>
                      <span>RPE</span>
                    </div>
                  </div>
                  {group.sets.map((s) => (
                    <div
                      key={s.idx}
                      className="mb-2 grid grid-cols-[auto_1fr_1fr_1fr] items-center gap-2"
                    >
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
                  {/* !! evita el clásico "0" fantasma de JSX cuando weight_kg es 0 */}
                  {!!last?.reps && !!last?.rpe && (
                    <Button
                      variant="link"
                      size="sm"
                      className="mb-3 gap-1.5 px-0"
                      onClick={() =>
                        askProgression(last.exercise_id, last.reps!, last.weight_kg || 0, last.rpe!)
                      }
                    >
                      <TrendingUp />
                      Sugerir progresión
                    </Button>
                  )}
                </div>
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
