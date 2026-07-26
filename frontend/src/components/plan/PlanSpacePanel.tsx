import { useMemo, useState } from 'react'
import { AlertTriangle, ArrowRightLeft, Copy, Trash2 } from 'lucide-react'
import type { Gym } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { equipmentES } from '@/lib/equipment'
import { gymIcon } from '@/lib/gym'
import { type EquipmentGap } from '@/lib/gymFit'

/**
 * Duplicar el plan en otro espacio.
 *
 * Mover vive en el selector de espacio de la cabecera, que es donde se lee a qué
 * espacio pertenece el plan. Aquí queda lo que ese selector no puede hacer:
 * dejar el original donde está y llevarse una copia. El destino se elige con el
 * precio delante —cuántos ejercicios no se pueden hacer allí—, porque duplicar
 * sí crea algo nuevo y volver atrás cuesta un borrado.
 */
export function PlanSpacePanel({
  gyms,
  currentGymId,
  gapsByGym,
  onDuplicateTo,
}: {
  gyms: Gym[]
  currentGymId: number | null
  /** Huecos de equipo por espacio; `null` = espacio sin inventario registrado. */
  gapsByGym: Map<number, number | null>
  onDuplicateTo: (gymId: number) => void
}) {
  const others = useMemo(() => gyms.filter((g) => g.id !== currentGymId), [gyms, currentGymId])
  const [targetId, setTargetId] = useState<number | null>(others[0]?.id ?? null)

  if (!others.length) return null

  const target = others.find((g) => g.id === targetId) ?? null
  const gaps = target ? (gapsByGym.get(target.id) ?? null) : null

  return (
    <div className="w-full space-y-2 border-t border-border pt-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Duplicar este plan en</span>
        <Select
          value={targetId != null ? String(targetId) : ''}
          onValueChange={(v) => setTargetId(Number(v))}
        >
          <SelectTrigger className="h-8 w-auto min-w-40" aria-label="Espacio de destino">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {others.map((g) => {
              const n = gapsByGym.get(g.id)
              return (
                <SelectItem key={g.id} value={String(g.id)}>
                  <span aria-hidden>{gymIcon(g)}</span> {g.name}
                  {n == null && <span className="text-muted-foreground"> · sin inventario</span>}
                  {n != null && n > 0 && (
                    <span className="text-muted-foreground"> · {n} sin equipo</span>
                  )}
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>

        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          disabled={!target}
          onClick={() => target && onDuplicateTo(target.id)}
        >
          <Copy className="size-3.5" /> Duplicar allí
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        {gaps == null ? (
          <>{target?.name} no tiene inventario registrado, así que no puedo comprobar el material.</>
        ) : gaps > 0 ? (
          <>
            En {target?.name} {gaps === 1 ? 'hay 1 ejercicio' : `hay ${gaps} ejercicios`} que no se
            {gaps === 1 ? ' puede' : ' pueden'} hacer con su inventario; la copia te los lista con un
            sustituto del mismo patrón.
          </>
        ) : (
          <>Todo el plan se puede hacer en {target?.name}.</>
        )}{' '}
        El plan original se queda donde está.
      </p>
    </div>
  )
}

/** Lista de ejercicios que el espacio del plan no permite, con el cambio hecho.
 *  Vive fuera del menú de acciones: es un problema del plan, no una acción que
 *  el usuario esté buscando. */
export function PlanEquipmentGaps({
  gaps,
  gymName,
  onSwap,
  onRemove,
}: {
  gaps: EquipmentGap[]
  gymName: string | null
  onSwap: (gap: EquipmentGap) => void
  onRemove: (gap: EquipmentGap) => void
}) {
  if (!gaps.length) return null

  return (
    <div className="space-y-2 rounded-lg border border-warning/50 bg-warning/10 p-3">
      <p className="flex items-center gap-1.5 text-sm font-medium text-warning-strong">
        <AlertTriangle className="size-4 shrink-0" />
        {gaps.length === 1
          ? '1 ejercicio pide equipo que no hay'
          : `${gaps.length} ejercicios piden equipo que no hay`}
        {gymName ? ` en ${gymName}` : ''}
      </p>

      <ul className="space-y-1.5">
        {gaps.map((gap) => (
          <li
            key={`${gap.weekday}-${gap.index}`}
            className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs"
          >
            <span className="font-medium">{gap.exercise.name_es}</span>
            <span className="text-muted-foreground">
              {gap.dayLabel} · pide {equipmentES(gap.exercise.equipment)}
            </span>
            <span className="ml-auto flex items-center gap-1.5">
              {gap.suggestion ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1.5"
                  title={`Mismo músculo y mismo patrón, con ${equipmentES(gap.suggestion.equipment)}`}
                  onClick={() => onSwap(gap)}
                >
                  <ArrowRightLeft className="size-3" />
                  Cambiar por {gap.suggestion.name_es}
                </Button>
              ) : (
                <span className="text-muted-foreground">Sin sustituto del mismo patrón</span>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1.5 text-muted-foreground hover:text-destructive"
                onClick={() => onRemove(gap)}
              >
                <Trash2 className="size-3" />
                Quitar
              </Button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
