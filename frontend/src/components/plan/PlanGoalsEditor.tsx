import { useMemo, useState } from 'react'
import { AlertTriangle, Plus, X } from 'lucide-react'
import type { PlanGoals } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { VolumePanel } from '@/components/VolumePanel'
import { MUSCLE_LABELS_ES } from '@/lib/muscle'
import { formatSets, orphanGoals, type MuscleVolume } from '@/lib/volume'

const SLIDER = { min: 4, max: 30, step: 1 }

export function PlanGoalsEditor({
  goals,
  volumes,
  indirectWeight,
  onSetIndirectWeight,
  onSetBase,
  onSetMuscle,
  onRemoveMuscle,
}: {
  goals: PlanGoals
  volumes: MuscleVolume[]
  indirectWeight: number
  onSetIndirectWeight: (weight: number) => void
  onSetBase: (min: number, max: number) => void
  onSetMuscle: (muscle: string, min: number, max: number) => void
  onRemoveMuscle: (muscle: string) => void
}) {
  const [adding, setAdding] = useState('')

  const totals = useMemo(() => new Map(volumes.map((v) => [v.muscle, v.total])), [volumes])
  const orphans = useMemo(() => orphanGoals(goals, MUSCLE_LABELS_ES), [goals])

  /** Primero los músculos que este plan ya trabaja: son los que tiene sentido
   *  priorizar. Detrás, el resto del catálogo. */
  const options = useMemo(() => {
    const taken = new Set(goals.overrides.map((o) => o.muscle))
    const programmed = volumes.filter((v) => v.programmed).map((v) => v.muscle)
    const rest = MUSCLE_LABELS_ES.filter((m) => !programmed.includes(m))
    return [...programmed, ...rest].filter((m) => !taken.has(m))
  }, [goals.overrides, volumes])

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Objetivo de volumen</CardTitle>
          <CardDescription>
            Series semanales por músculo que busca este plan. Cada plan tiene el suyo: uno de piernas no
            persigue el mismo volumen de pecho que uno de empuje.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <Label>Rango base</Label>
              <span className="font-medium">
                {goals.base.min}–{goals.base.max} series
              </span>
            </div>
            <Slider
              {...SLIDER}
              value={[goals.base.min, goals.base.max]}
              onValueChange={([min, max]) => {
                if (min >= max) return
                onSetBase(min, max)
              }}
            />
            <p className="text-xs text-muted-foreground">
              Se aplica a todos los músculos que no tengan prioridad propia.
            </p>
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <Label>Peso del trabajo indirecto</Label>
              <span className="font-medium">{indirectWeight.toFixed(2)} series</span>
            </div>
            <Slider
              min={0}
              max={1}
              step={0.05}
              value={[indirectWeight]}
              onValueChange={([v]) => onSetIndirectWeight(v)}
            />
            <p className="text-xs text-muted-foreground">
              Cuánto cuenta una serie para un músculo secundario. 0,5 es la convención habitual; un
              plan de fuerza puede querer contarlo menos.
            </p>
          </div>

          <Separator />

          <div className="space-y-3">
            <div>
              <Label>Músculos prioritarios</Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Ej.: en un plan de piernas, sube cuádriceps y glúteos a 16–22 y deja el resto en el rango
                base.
              </p>
            </div>

            {!goals.overrides.length ? (
              <p className="text-sm text-muted-foreground">
                Este plan no tiene músculos prioritarios. El rango base se aplica a todos.
              </p>
            ) : (
              <div className="space-y-3">
                {goals.overrides.map((o) => (
                  <div key={o.muscle} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="font-medium">{o.muscle}</span>
                      <span className="flex items-center gap-2">
                        <span className="text-muted-foreground">
                          ahora {formatSets(totals.get(o.muscle) ?? 0)}
                        </span>
                        <strong>
                          {o.min}–{o.max}
                        </strong>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Quitar prioridad de ${o.muscle}`}
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => onRemoveMuscle(o.muscle)}
                        >
                          <X />
                        </Button>
                      </span>
                    </div>
                    <Slider
                      {...SLIDER}
                      className="mt-2"
                      value={[o.min, o.max]}
                      onValueChange={([min, max]) => {
                        if (min >= max) return
                        onSetMuscle(o.muscle, min, max)
                      }}
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Select value={adding} onValueChange={setAdding}>
                <SelectTrigger className="w-56" aria-label="Músculo a priorizar">
                  <SelectValue placeholder="Elige un músculo…" />
                </SelectTrigger>
                <SelectContent>
                  {options.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                className="gap-1.5"
                disabled={!adding}
                onClick={() => {
                  onSetMuscle(adding, goals.base.min, goals.base.max)
                  setAdding('')
                }}
              >
                <Plus className="size-3.5" />
                Priorizar
              </Button>
            </div>

            {orphans.length > 0 && (
              <div className="space-y-1.5 rounded-lg border border-amber-500/40 p-3 text-xs">
                <p className="flex items-start gap-1.5 text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="mt-px size-3.5 shrink-0" />
                  <span>
                    Hay objetivos guardados para músculos que ya no están en el catálogo. No se aplican a
                    nada.
                  </span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {orphans.map((m) => (
                    <Button key={m} size="sm" variant="outline" onClick={() => onRemoveMuscle(m)}>
                      Quitar «{m}»
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <VolumePanel volumes={volumes} goals={goals} />
        </CardContent>
      </Card>
    </div>
  )
}
