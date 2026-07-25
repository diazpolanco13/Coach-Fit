import { useState } from 'react'
import { Undo2 } from 'lucide-react'
import type { PlanGoals } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { OBJECTIVES, objectiveByLabel } from '@/lib/objectives'

export function ObjectivePicker({
  objective,
  goals,
  onSetObjective,
  onApply,
}: {
  objective: string | null
  goals: PlanGoals
  onSetObjective: (objective: string | null) => void
  onApply: (goals: PlanGoals, mode: 'reemplazar' | 'rellenar') => void
}) {
  /** Instantánea previa para poder deshacer. Quita el miedo a pulsar. */
  const [before, setBefore] = useState<PlanGoals | null>(null)
  const selected = objectiveByLabel(objective)

  const apply = (mode: 'reemplazar' | 'rellenar') => {
    if (!selected) return
    setBefore(goals)
    onApply(selected.goals, mode)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Objetivo del plan</CardTitle>
        <CardDescription>
          Para qué es este plan. Sugiere unos objetivos de volumen, pero no los impone: se aplican
          solo si lo pides y luego los editas libremente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1.5">
            <Label>Intención</Label>
            <Select
              value={objective ?? ''}
              onValueChange={(v) => onSetObjective(v || null)}
            >
              <SelectTrigger className="w-56" aria-label="Objetivo del plan">
                <SelectValue placeholder="Sin objetivo definido" />
              </SelectTrigger>
              <SelectContent>
                {OBJECTIVES.map((o) => (
                  <SelectItem key={o.id} value={o.label}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {before && (
            <Button variant="outline" className="gap-1.5" onClick={() => { onApply(before, 'reemplazar'); setBefore(null) }}>
              <Undo2 className="size-3.5" />
              Deshacer
            </Button>
          )}
        </div>

        {selected && (
          <div className="space-y-2 rounded-lg border p-3 text-sm">
            <p className="text-muted-foreground">{selected.hint}</p>
            <p>
              Sugiere base{' '}
              <strong>
                {selected.goals.base.min}–{selected.goals.base.max}
              </strong>
              {selected.goals.overrides.length > 0 && (
                <>
                  {' '}
                  y prioriza{' '}
                  <strong>
                    {selected.goals.overrides
                      .slice(0, 3)
                      .map((o) => o.muscle)
                      .join(', ')}
                    {selected.goals.overrides.length > 3 &&
                      ` y ${selected.goals.overrides.length - 3} más`}
                  </strong>
                </>
              )}
              .
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => apply('reemplazar')}>
                Aplicar
              </Button>
              <Button size="sm" variant="outline" onClick={() => apply('rellenar')}>
                Aplicar solo lo que no he tocado
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
