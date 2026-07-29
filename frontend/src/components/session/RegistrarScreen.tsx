import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, CalendarClock, CheckCircle2, History, Lightbulb, Loader2, Pause, Play, Plus, X } from 'lucide-react'
import {
  api,
  type DaySummary,
  type Exercise,
  type ProgressionSuggestion,
  type SessionSet,
  type WeekDay,
} from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { MediaImg } from '@/components/MediaImg'
import { AddExercisePicker } from '@/components/session/AddExercisePicker'
import { DayNavigator } from '@/components/session/DayNavigator'
import { RpeSessionBar } from '@/components/session/RpeSessionBar'
import { SessionCheckIn } from '@/components/session/SessionCheckIn'
import { SetListEditor } from '@/components/session/SetListEditor'
import { useNav } from '@/components/shell/NavContext'
import { addDays, daysFrom, longLabel, startOfWeek, weekdayOf } from '@/lib/dates'
import { muscleES } from '@/lib/muscle'
import * as draft from '@/lib/sessionDraft'
import { setKey } from '@/lib/sessionDraft'
import {
  DEFAULT_ENERGY,
  DEFAULT_HEALTH,
  DEFAULT_MOOD,
  hasExercisePain,
  removeExerciseFeedback,
  type EnergyId,
  type ExerciseFeedbackMap,
  type HealthId,
  type MoodId,
} from '@/lib/sessionCheckIn'
import { DEFAULT_REPS, midReps } from '@/lib/training'
import { readyToProgress } from '@/lib/hoy'
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
  const today = todayISO()
  const [sessionDate, setSessionDate] = useState(initialDate || today)
  const [weekSessions, setWeekSessions] = useState<Record<string, DaySummary>>({})
  const [weekToken, setWeekToken] = useState(0)
  /** Lo que ya había guardado en la fecha que se está mirando, o null. */
  const [saved, setSaved] = useState<{
    completed: boolean
    setCount: number
    volumeKg: number
  } | null>(null)
  const [justSaved, setJustSaved] = useState(false)
  const [sessionRpe, setSessionRpe] = useState(7)
  const [mood, setMood] = useState<MoodId>(DEFAULT_MOOD)
  const [health, setHealth] = useState<HealthId>(DEFAULT_HEALTH)
  const [energy, setEnergy] = useState<EnergyId>(DEFAULT_ENERGY)
  const [feedback, setFeedback] = useState<ExerciseFeedbackMap>({})
  const [draftSets, setDraftSets] = useState<SessionSet[]>([])
  // El formulario siembra reps y RPE 7 por comodidad, así que los valores por sí
  // solos no distinguen "ya registrado" de "aún sin tocar". Esto marca las series
  // que vienen de una sesión guardada o que el usuario ha editado.
  const [loggedSets, setLoggedSets] = useState<Set<string>>(new Set())
  const [openExerciseId, setOpenExerciseId] = useState<string | null>(null)
  /** GIF en la tarjeta del grid: uno a la vez, sin abrir el editor. */
  const [previewGifId, setPreviewGifId] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)
  const [suggestion, setSuggestion] = useState<ProgressionSuggestion | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const resetCheckIn = () => {
    setSessionRpe(7)
    setMood(DEFAULT_MOOD)
    setHealth(DEFAULT_HEALTH)
    setEnergy(DEFAULT_ENERGY)
    setFeedback({})
  }

  const loadCheckIn = (s: {
    session_rpe?: number | null
    mood?: string | null
    health?: string | null
    energy?: string | null
    exercise_feedback?: ExerciseFeedbackMap
  }) => {
    setSessionRpe(s.session_rpe || 7)
    setMood((s.mood as MoodId) || DEFAULT_MOOD)
    setHealth((s.health as HealthId) || DEFAULT_HEALTH)
    setEnergy((s.energy as EnergyId) || DEFAULT_ENERGY)
    setFeedback(s.exercise_feedback ?? {})
  }

  useEffect(() => {
    if (initialDate) setSessionDate(initialDate)
  }, [initialDate])

  const exMap = useMemo(
    () => Object.fromEntries(exercises.map((e) => [e.id, e])),
    [exercises],
  )

  const offset = daysFrom(sessionDate, today)
  const isFuture = offset > 0

  /** El día del plan que corresponde a esta fecha.
   *
   *  Primero por fecha exacta, que es la de la semana en curso y trae
   *  `completed` y `volume_kg` ya calculados. Si la fecha cae fuera, por día de
   *  la semana: el plan activo es una plantilla semanal, así que el lunes que
   *  viene le toca lo mismo que a este lunes. Antes solo se buscaba por fecha,
   *  y por eso cambiar el día en el calendario no mostraba nada. */
  const planDay = useMemo(
    () =>
      days.find((d) => d.date === sessionDate) ??
      days.find((d) => d.weekday === weekdayOf(sessionDate)),
    [days, sessionDate],
  )

  /** Sesiones de la semana en pantalla, para la tira del navegador. Se pide por
   *  semana y no por día para no encadenar siete peticiones al pasear. */
  const visibleWeek = startOfWeek(sessionDate)
  useEffect(() => {
    let cancelled = false
    api
      .sessionsRange(visibleWeek, addDays(visibleWeek, 6))
      .then((res) => {
        if (cancelled) return
        setWeekSessions(Object.fromEntries(res.sessions.map((s) => [s.date, s])))
      })
      // La tira es contexto, no el contenido: si falla, el resto de la pantalla
      // sigue sirviendo y no vale la pena un error rojo.
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [visibleWeek, weekToken])

  useEffect(() => {
    const day = planDay
    setOpenExerciseId(null)
    setPreviewGifId(null)
    setPicking(false)
    setJustSaved(false)
    api
      .session(sessionDate)
      .then((s) => {
        const done = (s.sets ?? []).filter((x) => x.done !== false)
        // El resumen sale de la sesión que se acaba de cargar y no de la tira de
        // la semana: la tira llega por otra petición, y hasta que llegase un día
        // ya registrado se anunciaría como vacío.
        setSaved(
          s.sets?.length
            ? {
                completed: s.completed,
                setCount: done.length,
                volumeKg: done.reduce((sum, x) => sum + (x.reps ?? 0) * (x.weight_kg ?? 0), 0),
              }
            : null,
        )
        if (s.sets?.length) {
          setDraftSets(draft.padToPlan(s.sets, day?.items ?? []))
          // Solo las marcadas como hechas son datos reales. Las que se guardaron
          // sin tocar (`done: false`) vuelven al formulario como prefill, no
          // como registro: si contaran, editar el día las convertiría en ciertas
          // sin que nadie las mirara.
          setLoggedSets(new Set(s.sets.filter((x) => x.done !== false).map(setKey)))
          loadCheckIn(s)
        } else {
          // Tantas filas como series pide el plan, todas sin marcar. Durante un
          // tiempo se sembraba una sola para no dar por hechas series que nadie
          // había levantado, pero eso obligaba a pulsar «Añadir serie» tres
          // veces para registrar lo que el plan ya prescribía. Ahora que
          // «hecha» es una casilla visible, sembrar las cuatro no afirma nada:
          // enseña el objetivo y tú marcas lo que cumpliste.
          //
          // Las reps salen del centro del rango: con el 8–12 por defecto, 10.
          const sets: SessionSet[] = (day?.items ?? []).flatMap((item) =>
            Array.from({ length: Math.max(1, item.sets) }, (_, i) => ({
              exercise_id: item.exercise_id,
              set_index: i + 1,
              reps: midReps(item),
              weight_kg: undefined,
              rpe: 7,
              done: false,
            })),
          )
          setDraftSets(sets)
          setLoggedSets(new Set())
          // Se reinician con el día. Antes solo se escribían al cargar una
          // sesión guardada, así que al saltar de un día registrado a uno vacío
          // el formulario se quedaba con el RPE y el check-in del anterior.
          resetCheckIn()
        }
      })
      .catch(() => undefined)
  }, [sessionDate, planDay])

  /** Lo que el plan prescribe ese día, por ejercicio. Solo es contexto: el
   *  registro no lo usa para sembrar series. */
  const planItems = useMemo(
    () => Object.fromEntries((planDay?.items ?? []).map((i) => [i.exercise_id, i])),
    [planDay],
  )

  /** Series que cuentan de verdad. Es el número que sale en el resumen del día
   *  y el que ven las agregaciones; el resto del borrador es prescripción. */
  const countedSets = useMemo(
    () => draftSets.filter((s) => loggedSets.has(setKey(s))).length,
    [draftSets, loggedSets],
  )

  const exerciseGroups = useMemo(() => {
    const map = new Map<string, Array<SessionSet & { idx: number }>>()
    draftSets.forEach((s, idx) => {
      if (!map.has(s.exercise_id)) map.set(s.exercise_id, [])
      map.get(s.exercise_id)!.push({ ...s, idx })
    })
    return Array.from(map.entries()).map(([exercise_id, sets]) => ({ exercise_id, sets }))
  }, [draftSets])

  const progressionCues = useMemo(() => {
    const out = new Map<string, ReturnType<typeof readyToProgress>>()
    for (const group of exerciseGroups) {
      const item = planItems[group.exercise_id]
      if (!item) continue
      const sets = group.sets.map((set) => ({ ...set, done: loggedSets.has(setKey(set)) }))
      const cue = readyToProgress(item, sets)
      if (cue) out.set(group.exercise_id, cue)
    }
    return out
  }, [exerciseGroups, loggedSets, planItems])

  const updateSet = (idx: number, patch: Partial<SessionSet>) => {
    setDraftSets((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)))
    const s = draftSets[idx]
    if (s) setLoggedSets((prev) => (prev.has(setKey(s)) ? prev : new Set(prev).add(setKey(s))))
    setJustSaved(false)
  }

  /** Marca o desmarca una serie como hecha. Escribir en una fila la sigue
   *  marcando sola —anotar los kilos ya dice que la hiciste—, pero ahora se
   *  puede marcar sin tocar nada: cumplir el plan tal cual está prescrito no
   *  debería obligar a reescribir los números que ya salen en pantalla. */
  const toggleLogged = (idx: number) => {
    const s = draftSets[idx]
    if (!s) return
    setLoggedSets((prev) => {
      const next = new Set(prev)
      const key = setKey(s)
      if (!next.delete(key)) next.add(key)
      return next
    })
    setJustSaved(false)
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
    setJustSaved(false)
  }

  /** Todas las series de un ejercicio de golpe. Cumplir el plan tal cual está
   *  prescrito es el caso más frecuente y debería ser el más corto. */
  const toggleAllLogged = (exerciseId: string) => {
    const mine = draftSets.filter((s) => s.exercise_id === exerciseId)
    const allLogged = mine.every((s) => loggedSets.has(setKey(s)))
    setLoggedSets((prev) => {
      const next = new Set(prev)
      for (const s of mine) {
        if (allLogged) next.delete(setKey(s))
        else next.add(setKey(s))
      }
      return next
    })
    setJustSaved(false)
  }

  /** Las tres operaciones que reordenan o renumeran viven en `lib/sessionDraft`
   *  como funciones puras: mantener `draftSets` y `loggedSets` coherentes es
   *  fácil de romper y ahí se puede probar sin montar la pantalla. */
  const apply = (next: draft.SessionDraft) => {
    setDraftSets(next.sets)
    setLoggedSets(next.logged)
    setJustSaved(false)
  }

  const removeExercise = (exerciseId: string) => {
    apply(draft.removeExercise({ sets: draftSets, logged: loggedSets }, exerciseId))
    setFeedback((f) => removeExerciseFeedback(f, exerciseId))
    setOpenExerciseId((cur) => (cur === exerciseId ? null : cur))
  }

  const addSet = (exerciseId: string) =>
    apply(draft.addSet({ sets: draftSets, logged: loggedSets }, exerciseId))

  const removeSet = (exerciseId: string, setIndex: number) =>
    apply(draft.removeSet({ sets: draftSets, logged: loggedSets }, exerciseId, setIndex))

  const saveSession = async () => {
    setBusy(true)
    setError('')
    const counted = draftSets.filter((s) => loggedSets.has(setKey(s)))
    try {
      await api.saveSession({
        date: sessionDate,
        focus: planDay?.focus,
        completed: true,
        session_rpe: sessionRpe,
        mood,
        health,
        energy,
        exercise_feedback: feedback,
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
      // Ya no se navega a ninguna parte, así que la pantalla se pone al día
      // sola. El resumen se recalcula del borrador que se acaba de mandar y no
      // recargando la sesión: releerla reiniciaría el editor y te sacaría del
      // ejercicio que estabas mirando justo al confirmarte que se guardó.
      //
      // Va antes del refresco de la semana a propósito: si ese refresco falla,
      // la sesión ya está guardada y la pantalla no debe decir lo contrario.
      setSaved({
        completed: true,
        setCount: counted.length,
        volumeKg: counted.reduce((sum, s) => sum + (s.reps ?? 0) * (s.weight_kg ?? 0), 0),
      })
      const firstCue = [...progressionCues.values()].find((cue) => cue != null)
      if (firstCue) {
        void askProgression(firstCue.exercise_id, firstCue.reps, firstCue.weight_kg, firstCue.rpe)
      }
      setJustSaved(true)
      setWeekToken((n) => n + 1)
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

      <DayNavigator
        date={sessionDate}
        today={today}
        planDays={days}
        sessions={weekSessions}
        onChange={setSessionDate}
      />

    <Card>
      <CardHeader>
        <CardTitle>
          {isFuture ? 'Lo que toca' : offset === 0 ? 'Historial de hoy' : 'Historial de sesión'}
        </CardTitle>
        <CardDescription>
          {isFuture ? (
            <>
              {longLabel(sessionDate)} · previsión del plan activo. Cuando llegue el día podrás
              registrar lo que hayas hecho.
            </>
          ) : (
            <>
              Edición por lista: repeticiones, kilos (o lastre) y RPE. Para el flujo guiado del día,
              entra a la sesión desde Hoy.
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <p className="rounded-lg border border-destructive/40 p-2.5 text-sm text-destructive">
            {error}
          </p>
        )}

        {/* Contexto del día: qué estás mirando y si ya hay algo guardado. Sin
            esto, una fecha de hace tres semanas y la de hoy se ven igual. */}
        {offset !== 0 && (
          <div
            className={
              isFuture
                ? 'flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 p-2.5 text-sm'
                : 'flex items-start gap-2 rounded-lg border bg-muted/40 p-2.5 text-sm'
            }
          >
            {isFuture ? (
              <CalendarClock className="mt-0.5 size-4 shrink-0 text-primary" />
            ) : (
              <History className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            )}
            <div className="min-w-0">
              <div className="font-medium text-foreground">
                {isFuture
                  ? `${planDay?.focus || 'Descanso'} · ${planDay?.items.length ?? 0} ejercicios previstos`
                  : saved
                    ? `Sesión registrada · ${saved.setCount} ${saved.setCount === 1 ? 'serie' : 'series'}${saved.volumeKg ? ` · ${Math.round(saved.volumeKg)} kg` : ''}`
                    : 'Este día no tiene sesión registrada'}
              </div>
              <div className="text-xs text-muted-foreground">
                {isFuture
                  ? 'Según el plan activo. Si cambias de plan antes de ese día, cambiará.'
                  : saved
                    ? 'Puedes seguir editándolo: al guardar se reemplaza lo de ese día.'
                    : 'Puedes registrarlo ahora: se guarda con la fecha que estás viendo, no con la de hoy.'}
              </div>
            </div>
          </div>
        )}

        {/* Un día futuro se lee, no se rellena. Marcarlo como hecho ensuciaría
            todas las agregaciones con series que nadie ha levantado todavía. */}
        {isFuture &&
          (planDay?.items.length ? (
            <ul className="divide-y rounded-lg border">
              {planDay.items.map((item) => {
                const ex = item.exercise ?? exMap[item.exercise_id]
                return (
                  <li key={item.exercise_id} className="flex items-center gap-3 p-2.5">
                    <div className="size-12 shrink-0 overflow-hidden rounded-md bg-muted/40">
                      {ex && (
                        <MediaImg
                          image={ex.image}
                          gif={ex.gif}
                          alt={ex.name_es}
                          className="h-full w-full object-contain p-1"
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => ex && onOpenExercise(ex)}
                        disabled={!ex}
                        className="truncate text-left text-sm font-medium text-foreground hover:text-primary disabled:hover:text-foreground"
                      >
                        {ex?.name_es || item.exercise_id}
                      </button>
                      {ex?.target && (
                        <div className="text-xs text-muted-foreground">{muscleES(ex.target)}</div>
                      )}
                    </div>
                    <Badge variant="secondary" className="shrink-0 tabular-nums">
                      {item.sets} × {item.rep_min}–{item.rep_max}
                    </Badge>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
              Día de descanso: el plan activo no programa nada.
            </p>
          ))}

        {!isFuture && (
          <>
        {/* Ejercicios primero: el check-in va compacto debajo. */}
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
                // El denominador vuelve a tener sentido: las filas son las que
                // el plan prescribe, así que «2 de 4» dice cuánto queda. Cuando
                // las filas las inventaba quien registraba, no significaba nada.
                const filled = g.sets.filter((s) => loggedSets.has(setKey(s))).length
                const previewing = previewGifId === g.exercise_id
                const progressionCue = progressionCues.get(g.exercise_id)
                const btn =
                  'flex size-8 items-center justify-center rounded-lg border border-border/70 bg-background/90 text-muted-foreground shadow-sm backdrop-blur-sm transition-colors'
                return (
                  // Controles sobre la imagen, con aire (bottom/left/right-3):
                  // fuera del dibujo robaban sitio al nombre en móvil; pegados
                  // a la esquina se leían como chapas.
                  <div key={g.exercise_id} className="overflow-hidden rounded-xl border bg-card shadow-sm">
                    <div className="relative aspect-square bg-muted/40">
                      <button
                        type="button"
                        onClick={() => {
                          setPreviewGifId(null)
                          setOpenExerciseId(g.exercise_id)
                        }}
                        className="absolute inset-0"
                        aria-label={`Abrir ${ex?.name_es || g.exercise_id}`}
                      >
                        {ex && (
                          <MediaImg
                            image={ex.image}
                            gif={ex.gif}
                            preferGif={previewing}
                            alt={ex.name_es}
                            className="h-full w-full object-contain p-2"
                          />
                        )}
                      </button>
                      {ex?.gif && (
                        <button
                          type="button"
                          onClick={() => setPreviewGifId(previewing ? null : g.exercise_id)}
                          aria-label={
                            previewing
                              ? `Parar animación de ${ex.name_es}`
                              : `Ver animación de ${ex.name_es}`
                          }
                          aria-pressed={previewing}
                          className={
                            previewing
                              ? `absolute bottom-3 left-3 z-10 ${btn} border-primary bg-primary text-primary-foreground`
                              : `absolute bottom-3 left-3 z-10 ${btn} hover:border-primary/50 hover:text-primary`
                          }
                        >
                          {previewing ? (
                            <Pause className="size-3.5 fill-current" />
                          ) : (
                            <Play className="size-3.5 fill-current" />
                          )}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => removeExercise(g.exercise_id)}
                        aria-label={`Quitar ${ex?.name_es || g.exercise_id} de la sesión`}
                        className={`absolute bottom-3 right-3 z-10 ${btn} hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive`}
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewGifId(null)
                        setOpenExerciseId(g.exercise_id)
                      }}
                      className="w-full space-y-2 p-3 text-left transition hover:bg-muted/20"
                    >
                      <span className="line-clamp-2 block text-sm font-medium leading-snug text-foreground">
                        {ex?.name_es || g.exercise_id}
                      </span>
                      <span className="flex flex-wrap gap-1">
                        {ex?.target && <Badge variant="secondary">{muscleES(ex.target)}</Badge>}
                        {hasExercisePain(feedback, g.exercise_id) && (
                          <Badge
                            variant="outline"
                            className="border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400"
                          >
                            Dolor
                          </Badge>
                        )}
                        {progressionCue && (
                          <Badge
                            variant="outline"
                            className="border-primary/30 bg-primary/10 text-primary"
                          >
                            Listo para subir
                          </Badge>
                        )}
                        <Badge
                          variant="outline"
                          className={
                            filled === 0
                              ? 'text-muted-foreground'
                              : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          }
                        >
                          {filled === 0 ? (
                            `0 de ${g.sets.length} series`
                          ) : (
                            <>
                              <CheckCircle2 className="size-3" /> {filled} de {g.sets.length}{' '}
                              {g.sets.length === 1 ? 'serie' : 'series'}
                            </>
                          )}
                        </Badge>
                      </span>
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
                  logged={loggedSets}
                  onUpdate={updateSet}
                  onToggleLogged={toggleLogged}
                  onToggleAll={() => toggleAllLogged(group.exercise_id)}
                  onAddSet={() => addSet(group.exercise_id)}
                  onRemoveSet={(setIndex) => removeSet(group.exercise_id, setIndex)}
                  onRemoveExercise={() => removeExercise(group.exercise_id)}
                  onBack={() => setOpenExerciseId(null)}
                  onOpenGuide={onOpenExercise}
                  onSuggestProgression={askProgression}
                  feedback={feedback}
                  onFeedbackChange={(next) => {
                    setFeedback(next)
                    setJustSaved(false)
                  }}
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

        {/* Check-in: 4 filas finas. Default verde (bien); solo se toca si empeora.
            Se oculta al editar un ejercicio para no competir con las series. */}
        {!openExerciseId && (
          <div className="space-y-1.5 rounded-lg border px-3 py-2">
            <RpeSessionBar
              value={sessionRpe}
              onChange={(n) => {
                setSessionRpe(n)
                setJustSaved(false)
              }}
            />
            <SessionCheckIn
              mood={mood}
              health={health}
              energy={energy}
              onMood={(v) => {
                setMood(v)
                setJustSaved(false)
              }}
              onHealth={(v) => {
                setHealth(v)
                setJustSaved(false)
              }}
              onEnergy={(v) => {
                setEnergy(v)
                setJustSaved(false)
              }}
            />
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-3">
          {justSaved && (
            <span className="mr-auto text-sm text-muted-foreground">
              {countedSets} {countedSets === 1 ? 'serie guardada' : 'series guardadas'} en{' '}
              {longLabel(sessionDate).toLowerCase()}. Sigue editando o vuelve atrás.
            </span>
          )}
          <Button
            onClick={saveSession}
            disabled={busy || !draftSets.length || justSaved}
            className="gap-2"
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CheckCircle2 className="size-4" />
            )}
            {justSaved
              ? 'Guardado'
              : offset === 0
                ? 'Guardar sesión y marcar día'
                : `Guardar sesión del ${longLabel(sessionDate).toLowerCase()}`}
          </Button>
          {/* Al guardar ya no se sale de la pantalla, así que la confirmación
              tiene que verse aquí: sin esto el botón parecía no hacer nada. */}
        </div>
          </>
        )}
      </CardContent>
    </Card>
    </div>
  )
}
