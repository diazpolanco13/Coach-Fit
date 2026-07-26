import { Dumbbell, Search } from 'lucide-react'
import type { Gym } from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ALL, ROLES, type ExerciseFilter } from '@/lib/exerciseFilter'
import { bodyPartES } from '@/lib/bodyPart'
import { equipmentES } from '@/lib/equipment'
import { gymIcon } from '@/lib/gym'
import { muscleES } from '@/lib/muscle'
import { cn } from '@/lib/utils'

export function ExerciseRoleChips({
  role,
  onChange,
  roles = ROLES,
  className,
}: {
  role: string
  onChange: (role: string) => void
  roles?: typeof ROLES
  className?: string
}) {
  return (
    <div
      role="group"
      aria-label="Categoría"
      className={cn('flex overflow-hidden rounded-lg border border-border', className)}
    >
      {roles.map((f, i) => (
        <button
          key={f.id}
          type="button"
          onClick={() => onChange(f.id)}
          className={cn(
            'px-3 py-2 text-sm transition-colors',
            i > 0 && 'border-l border-border',
            role === f.id ? 'bg-primary text-primary-foreground' : 'bg-transparent hover:bg-muted',
          )}
        >
          {f.label}
        </button>
      ))}
    </div>
  )
}

export function ExerciseFilterBar({
  filter,
  onPatch,
  muscles,
  bodyParts,
  equipments,
  layout = 'grid',
  showEquip = true,
  spaces,
  counts,
}: {
  filter: ExerciseFilter
  onPatch: (p: Partial<ExerciseFilter>) => void
  muscles: string[]
  bodyParts: string[]
  equipments: string[]
  /** `grid` = filas anchas (biblioteca / Dialog); `stack` = apilado estrecho. */
  layout?: 'grid' | 'stack'
  showEquip?: boolean
  /** Espacios entre los que elegir el inventario que limita la lista. El primero
   *  suele ser el del plan que se edita, que no tiene por qué ser el del selector
   *  de la cabecera. */
  spaces?: Gym[]
  /** Cuántos ejercicios quedan por espacio y sin filtrar, ya con el resto de
   *  filtros aplicados. */
  counts?: { all: number; bySpace: Map<number, number> }
}) {
  const stack = layout === 'stack'
  const cols = showEquip
    ? 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'
    : 'grid gap-3 sm:grid-cols-2 lg:grid-cols-4'
  return (
    <div className={stack ? 'space-y-2' : cols}>
      <div className={stack ? undefined : 'space-y-1.5'}>
        {!stack && <Label>Buscar</Label>}
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="press, sentadilla, curl…"
            aria-label="Buscar ejercicio"
            value={filter.query}
            onChange={(e) => onPatch({ query: e.target.value })}
          />
        </div>
      </div>

      <div className={stack ? undefined : 'space-y-1.5'}>
        {!stack && <Label>Parte del cuerpo</Label>}
        <Select value={filter.bodyPart} onValueChange={(v) => onPatch({ bodyPart: v })}>
          <SelectTrigger aria-label="Filtrar por parte del cuerpo">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas las partes</SelectItem>
            {bodyParts.map((p) => (
              <SelectItem key={p} value={p}>
                {bodyPartES(p)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className={stack ? undefined : 'space-y-1.5'}>
        {!stack && <Label>Músculo</Label>}
        <Select value={filter.muscle} onValueChange={(v) => onPatch({ muscle: v })}>
          <SelectTrigger aria-label="Filtrar por músculo">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos los músculos</SelectItem>
            {muscles.map((m) => (
              <SelectItem key={m} value={m}>
                {muscleES(m)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {showEquip && (
        <div className={stack ? undefined : 'space-y-1.5'}>
          {!stack && <Label>Equipamiento</Label>}
          <Select value={filter.equip} onValueChange={(v) => onPatch({ equip: v })}>
            <SelectTrigger aria-label="Filtrar por equipamiento">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Cualquier aparato</SelectItem>
              {equipments.map((eq) => (
                <SelectItem key={eq} value={eq}>
                  {equipmentES(eq)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className={stack ? undefined : 'space-y-1.5'}>
        {!stack && <Label>Equipo disponible</Label>}
        {/* Un selector, y no un botón: la pregunta «con qué material» tiene tantas
            respuestas como espacios tenga el usuario, y un toggle solo sabe decir
            dos. Antes era un botón cuyo texto llevaba el nombre del espacio
            dentro, que se leía como una etiqueta fija. Cada opción trae su
            recuento, así que se ve de una que en el gimnasio hay el doble de
            ejercicios que en casa. */}
        <Select
          value={filter.onlyMine && filter.spaceId != null ? `gym:${filter.spaceId}` : 'todo'}
          onValueChange={(v) =>
            v === 'todo'
              ? onPatch({ onlyMine: false })
              : onPatch({ onlyMine: true, spaceId: Number(v.slice('gym:'.length)) })
          }
        >
          <SelectTrigger aria-label="Material con el que se filtra">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(spaces ?? []).map((g) => (
              <SelectItem key={g.id} value={`gym:${g.id}`}>
                <span className="flex items-center gap-1.5">
                  <span aria-hidden>{gymIcon(g)}</span>
                  {g.name}
                  {counts && (
                    <span className="tabular-nums text-muted-foreground">
                      {counts.bySpace.get(g.id) ?? 0}
                    </span>
                  )}
                </span>
              </SelectItem>
            ))}
            <SelectItem value="todo">
              {/* En flex y no suelto: `SelectItem` mete los hijos dentro de un
                  `ItemText`, que es flujo inline, y el preflight de Tailwind pone
                  los `svg` en `display: block` — el icono se llevaba el texto a
                  la línea siguiente. Los demás ítems no lo sufren porque su icono
                  es un emoji. */}
              <span className="flex items-center gap-1.5">
                <Dumbbell className="size-3.5 shrink-0" />
                Todo el catálogo
                {counts && (
                  <span className="tabular-nums text-muted-foreground">{counts.all}</span>
                )}
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
