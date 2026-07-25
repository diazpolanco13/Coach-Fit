import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, CalendarDays, Loader2, Moon, Plus, Save, X } from 'lucide-react'
import type { Exercise, PlanDay, UserEquipment, WeekDay } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ExercisePicker } from '@/components/ExercisePicker'
import { MediaImg } from '@/components/MediaImg'
import { VolumePanel } from '@/components/VolumePanel'
import { equipmentES } from '@/lib/equipment'
import { muscleES } from '@/lib/muscle'
import { getVolumeRange } from '@/lib/settings'
import { overloadedMuscles, weeklyVolume } from '@/lib/volume'

/** Quita los campos que `GET /api/week` añade al vuelo. El backend guarda el
 *  payload literal, así que persistir `date`/`completed` congelaría datos de
 *  una semana concreta dentro de la rutina. */
const toPlanDay = (d: WeekDay): PlanDay => ({
  weekday: d.weekday,
  label: d.label,
  focus: d.focus,
  exercise_ids: [...d.exercise_ids],
})

export function PlanEditor({
  planName,
  days,
  exercises,
  equipment,
  equipmentUnlocks,
  busy,
  onSave,
  onCancel,
}: {
  planName: string
  days: WeekDay[]
  exercises: Exercise[]
  equipment: UserEquipment[]
  equipmentUnlocks: Record<string, string[]>
  busy: boolean
  onSave: (plan: { name: string; days: PlanDay[] }) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(planName)
  const [draft, setDraft] = useState<PlanDay[]>(() => days.map(toPlanDay))
  const [pickerFor, setPickerFor] = useState<number | null>(null)

  const exMap = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises])

  const range = useMemo(() => getVolumeRange(), [])
  const volumes = useMemo(() => weeklyVolume(draft, exMap), [draft, exMap])
  const overloaded = useMemo(() => overloadedMuscles(volumes, range.max), [volumes, range.max])

  const dirty = useMemo(() => {
    const original = JSON.stringify({ name: planName, days: days.map(toPlanDay) })
    return original !== JSON.stringify({ name, days: draft })
  }, [planName, days, name, draft])

  const patchDay = (weekday: number, patch: Partial<PlanDay>) =>
    setDraft((prev) => prev.map((d) => (d.weekday === weekday ? { ...d, ...patch } : d)))

  const moveExercise = (weekday: number, index: number, dir: -1 | 1) =>
    setDraft((prev) =>
      prev.map((d) => {
        if (d.weekday !== weekday) return d
        const ids = [...d.exercise_ids]
        const to = index + dir
        if (to < 0 || to >= ids.length) return d
        ;[ids[index], ids[to]] = [ids[to], ids[index]]
        return { ...d, exercise_ids: ids }
      }),
    )

  const removeExercise = (weekday: number, index: number) =>
    setDraft((prev) =>
      prev.map((d) =>
        d.weekday === weekday
          ? { ...d, exercise_ids: d.exercise_ids.filter((_, i) => i !== index) }
          : d,
      ),
    )

  const addExercise = (weekday: number, ex: Exercise) =>
    setDraft((prev) =>
      prev.map((d) =>
        d.weekday === weekday && !d.exercise_ids.includes(ex.id)
          ? { ...d, exercise_ids: [...d.exercise_ids, ex.id] }
          : d,
      ),
    )

  const pickerDay = pickerFor == null ? null : draft.find((d) => d.weekday === pickerFor)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1.5">
          <Label>Nombre del plan</Label>
          <div className="flex items-center gap-2">
            <CalendarDays className="size-5 shrink-0 text-primary" />
            <Input value={name} onChange={(e) => setName(e.target.value)} className="w-64" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {dirty && <span className="text-xs text-muted-foreground">Cambios sin guardar</span>}
          <Button variant="outline" onClick={onCancel} disabled={busy}>
            Cancelar
          </Button>
          <Button className="gap-1.5" disabled={busy || !dirty} onClick={() => onSave({ name, days: draft })}>
            {busy ? <Loader2 className="animate-spin" /> : <Save />}
            Guardar plan
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <VolumePanel volumes={volumes} min={range.min} max={range.max} />
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {draft.map((day) => {
          const isRest = !day.exercise_ids.length
          return (
            <Card key={day.weekday}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <Input
                    value={day.label}
                    onChange={(e) => patchDay(day.weekday, { label: e.target.value })}
                    className="font-heading font-extrabold"
                    aria-label={`Nombre del día ${day.weekday + 1}`}
                  />
                  <Badge variant={isRest ? 'outline' : 'brand'} className="mt-1 shrink-0">
                    {isRest ? 'Descanso' : `${day.exercise_ids.length} ej.`}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {isRest ? (
                  <p className="py-2 text-sm text-muted-foreground">
                    Día de descanso. Añade ejercicios para convertirlo en día de entreno.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {day.exercise_ids.map((id, i) => {
                      const ex = exMap.get(id)
                      return (
                        <div key={`${id}-${i}`} className="flex items-center gap-2 rounded-lg border p-1.5">
                          <div className="size-9 shrink-0 overflow-hidden rounded border bg-white">
                            {ex && (
                              <MediaImg
                                image={ex.image}
                                gif={ex.gif}
                                alt={ex.name_es}
                                className="h-full w-full object-contain"
                              />
                            )}
                          </div>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{ex?.name_es || id}</span>
                            {ex && (
                              <span className="block truncate text-xs text-muted-foreground">
                                {muscleES(ex.target)} · {equipmentES(ex.equipment)}
                              </span>
                            )}
                          </span>
                          <div className="flex shrink-0 items-center">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Subir"
                              disabled={i === 0}
                              onClick={() => moveExercise(day.weekday, i, -1)}
                            >
                              <ArrowUp />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Bajar"
                              disabled={i === day.exercise_ids.length - 1}
                              onClick={() => moveExercise(day.weekday, i, 1)}
                            >
                              <ArrowDown />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Quitar ${ex?.name_es || id}`}
                              className="text-muted-foreground hover:text-destructive"
                              onClick={() => removeExercise(day.weekday, i)}
                            >
                              <X />
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-1">
                  <Button size="sm" className="gap-1.5" onClick={() => setPickerFor(day.weekday)}>
                    <Plus className="size-3.5" />
                    Añadir ejercicio
                  </Button>
                  {!isRest && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => patchDay(day.weekday, { exercise_ids: [] })}
                    >
                      <Moon className="size-3.5" />
                      Convertir en descanso
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <ExercisePicker
        open={pickerFor != null}
        dayLabel={pickerDay?.label ?? ''}
        exercises={exercises}
        equipment={equipment}
        equipmentUnlocks={equipmentUnlocks}
        alreadyIn={pickerDay?.exercise_ids ?? []}
        overloaded={overloaded}
        volumeMax={range.max}
        onPick={(ex) => pickerFor != null && addExercise(pickerFor, ex)}
        onClose={() => setPickerFor(null)}
      />
    </div>
  )
}
