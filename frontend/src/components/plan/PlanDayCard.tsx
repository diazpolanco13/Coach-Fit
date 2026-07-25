import { Moon, Play, Plus } from 'lucide-react'
import type { Exercise, PlanDay, PlanItem, WeekDay } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PlanItemRow } from '@/components/plan/PlanItemRow'
import { cn } from '@/lib/utils'

export function PlanDayCard({
  day,
  week,
  focused,
  onFocus,
  onRelabel,
  onPatchItem,
  onCommitItem,
  onMoveItem,
  onRemoveItem,
  onClearDay,
  onAddExercise,
  onOpenExercise,
  onMarkDay,
  onGoRegister,
  onGoTrain,
}: {
  day: PlanDay
  /** El mismo día proyectado sobre la semana en curso. Solo llega cuando el
   *  plan seleccionado es el activo: es lo que habilita ejecutar desde aquí. */
  week: WeekDay | undefined
  focused: boolean
  onFocus: () => void
  onRelabel: (label: string) => void
  onPatchItem: (index: number, patch: Partial<PlanItem>) => void
  onCommitItem: (index: number) => void
  onMoveItem: (index: number, dir: -1 | 1) => void
  onRemoveItem: (index: number) => void
  onClearDay: () => void
  onAddExercise: () => void
  onOpenExercise: (ex: Exercise) => void
  onMarkDay: (day: WeekDay, completed: boolean) => void
  onGoRegister: (day: WeekDay) => void
  onGoTrain: (day: WeekDay) => void
}) {
  const isRest = !day.items.length
  const sets = day.items.reduce((n, i) => n + i.sets, 0)

  return (
    <Card
      onClick={onFocus}
      className={cn(
        'transition-shadow',
        focused && 'ring-2 ring-primary/40',
        week?.completed && !focused && 'ring-primary/40',
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {week && <div className="kicker">{week.date}</div>}
            <Input
              value={day.label}
              onChange={(e) => onRelabel(e.target.value)}
              className="font-heading font-extrabold"
              aria-label={`Nombre del día ${day.weekday + 1}`}
            />
          </div>
          {week?.completed ? (
            <Badge variant="brand" className="mt-1 shrink-0">
              Hecho
            </Badge>
          ) : (
            <Badge variant={isRest ? 'outline' : 'brand'} className="mt-1 shrink-0">
              {isRest ? 'Descanso' : `${day.items.length} ej. · ${sets} series`}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-2">
        {isRest ? (
          <p className="py-2 text-sm text-muted-foreground">
            Día de descanso. Añade ejercicios para convertirlo en día de entreno.
          </p>
        ) : (
          <div className="space-y-1">
            {day.items.map((item, i) => (
              <PlanItemRow
                key={`${item.exercise_id}-${i}`}
                item={item}
                index={i}
                count={day.items.length}
                onPatch={(patch) => onPatchItem(i, patch)}
                onCommit={() => onCommitItem(i)}
                onMove={(dir) => onMoveItem(i, dir)}
                onRemove={() => onRemoveItem(i)}
                onOpenGuide={() => item.exercise && onOpenExercise(item.exercise)}
              />
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" className="gap-1.5" onClick={onAddExercise}>
            <Plus className="size-3.5" />
            Añadir ejercicio
          </Button>
          {!isRest && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={onClearDay}>
              <Moon className="size-3.5" />
              Convertir en descanso
            </Button>
          )}
        </div>

        {/* Ejecutar el día solo tiene sentido en el plan activo, que es el que
            está proyectado sobre la semana en curso. */}
        {week && (
          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-2.5">
            {!isRest && week.volume_kg > 0 && (
              <span className="mr-auto text-xs text-muted-foreground">
                {Math.round(week.volume_kg)} kg · RPE {week.session_rpe}
              </span>
            )}
            <Button size="sm" variant="outline" onClick={() => onMarkDay(week, !week.completed)}>
              {week.completed ? 'Desmarcar' : 'Marcar'}
            </Button>
            {!isRest && (
              <>
                <Button size="sm" variant="outline" onClick={() => onGoRegister(week)}>
                  Registrar
                </Button>
                <Button size="sm" className="gap-1.5" onClick={() => onGoTrain(week)}>
                  <Play className="size-3.5" />
                  Entrenar
                </Button>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
