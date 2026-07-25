import { Check, ChevronDown, Menu } from 'lucide-react'
import type { Gym } from '@/lib/api'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { gymIcon } from '@/lib/gym'

/** Selector del espacio en el que estás ahora. Tiñe lo que ves: qué planes
 *  lista el sidebar y con qué inventario y curación trabaja la biblioteca.
 *  No decide qué muestra «Hoy» — eso siempre es el plan activo del servidor. */
export function GymSwitcher({
  gyms,
  activeGym,
  onChange,
}: {
  gyms: Gym[]
  activeGym: Gym | null
  onChange: (id: number) => void
}) {
  if (!gyms.length) return null
  return (
    <Select value={activeGym ? String(activeGym.id) : ''} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger className="h-9 w-auto gap-1.5 border-0 bg-muted/60 px-2.5" aria-label="Espacio activo">
        <SelectValue>
          <span className="flex items-center gap-1.5">
            <span aria-hidden>{activeGym ? gymIcon(activeGym) : '📍'}</span>
            <span className="max-w-[9rem] truncate">{activeGym?.name ?? 'Sin espacio'}</span>
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {gyms.map((g) => (
          <SelectItem key={g.id} value={String(g.id)}>
            <span className="flex items-center gap-1.5">
              <span aria-hidden>{gymIcon(g)}</span>
              {g.name}
              {g.id === activeGym?.id && <Check className="size-3.5 text-primary" />}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function AppHeader({
  gyms,
  activeGym,
  onChangeGym,
  activePlanName,
  showMenuButton,
  onOpenMenu,
}: {
  gyms: Gym[]
  activeGym: Gym | null
  onChangeGym: (id: number) => void
  activePlanName: string
  showMenuButton: boolean
  onOpenMenu: () => void
}) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/95 px-3 backdrop-blur sm:px-4">
      {showMenuButton && (
        <Button variant="ghost" size="icon-sm" aria-label="Abrir menú" onClick={onOpenMenu}>
          <Menu />
        </Button>
      )}
      <GymSwitcher gyms={gyms} activeGym={activeGym} onChange={onChangeGym} />
      {activePlanName && (
        <span className="ml-auto flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
          <ChevronDown className="hidden size-3.5 rotate-[-90deg] sm:block" aria-hidden />
          <span className="truncate">{activePlanName}</span>
        </span>
      )}
    </header>
  )
}
