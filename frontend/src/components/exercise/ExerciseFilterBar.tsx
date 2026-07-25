import { Check, Dumbbell, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ALL, ROLES, type ExerciseFilter } from '@/lib/exerciseFilter'
import { equipmentES } from '@/lib/equipment'
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
    <div className={cn('flex overflow-hidden rounded-lg border border-border', className)}>
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
  equipments,
  layout = 'grid',
  showEquip = true,
}: {
  filter: ExerciseFilter
  onPatch: (p: Partial<ExerciseFilter>) => void
  muscles: string[]
  equipments: string[]
  /** `grid` = filas anchas (biblioteca / Dialog); `stack` = apilado estrecho. */
  layout?: 'grid' | 'stack'
  showEquip?: boolean
}) {
  const stack = layout === 'stack'
  return (
    <div
      className={cn(
        stack
          ? 'space-y-2'
          : showEquip
            ? 'grid gap-3 sm:grid-cols-2 lg:grid-cols-4'
            : 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3',
      )}
    >
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
          {!stack && <Label>Equipo</Label>}
          <Select value={filter.equip} onValueChange={(v) => onPatch({ equip: v })}>
            <SelectTrigger aria-label="Filtrar por equipo">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todo el equipo</SelectItem>
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
        {!stack && <Label>Filtro</Label>}
        {/* La etiqueta no cambia al alternar: si cambiaran texto y estilo a la
            vez no se sabe si el boton describe el estado actual o la accion.
            Fijo el texto y el estado lo dice el relleno + el check. */}
        <Button
          variant={filter.onlyMine ? 'default' : 'outline'}
          aria-pressed={filter.onlyMine}
          className="w-full gap-1.5"
          onClick={() => onPatch({ onlyMine: !filter.onlyMine })}
        >
          {filter.onlyMine ? <Check /> : <Dumbbell />}
          Solo con mi equipo
        </Button>
      </div>
    </div>
  )
}
