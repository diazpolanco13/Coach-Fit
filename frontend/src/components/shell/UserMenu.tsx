import { Activity, CalendarDays, Images, TrendingUp, UserRound } from 'lucide-react'
import type { UserProfile } from '@/lib/api'
import { routeScope, type Route } from '@/lib/nav'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type ProgressKey = 'perfil' | 'mediciones' | 'fuerza' | 'cardio' | 'consistencia'

const PROGRESS_ITEMS: Array<{
  k: ProgressKey
  label: string
  icon: React.ReactNode
}> = [
  { k: 'perfil', label: 'Perfil', icon: <UserRound /> },
  { k: 'mediciones', label: 'Mediciones', icon: <Images /> },
  { k: 'fuerza', label: 'Fuerza', icon: <TrendingUp /> },
  { k: 'cardio', label: 'Cardio', icon: <Activity /> },
  { k: 'consistencia', label: 'Consistencia', icon: <CalendarDays /> },
]

export function UserMenu({
  route,
  onNavigate,
  profile,
}: {
  route: Route
  onNavigate: (route: Route) => void
  profile?: UserProfile | null
}) {
  const scope = routeScope(route)
  const photoUrl = profile?.has_photo ? profile.photo_url : null
  const progressActive = PROGRESS_ITEMS.some((item) => item.k === scope)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Menú de usuario"
          title="Progreso"
          className={cn(
            'relative size-9 overflow-hidden rounded-full',
            progressActive && 'ring-2 ring-primary/40',
          )}
        >
          {photoUrl ? (
            <img src={photoUrl} alt="" className="size-full object-cover" />
          ) : (
            <UserRound className="size-4.5" />
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-52">
        <DropdownMenuLabel className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Progreso
        </DropdownMenuLabel>
        <DropdownMenuGroup>
          {PROGRESS_ITEMS.map((item) => (
            <DropdownMenuItem
              key={item.k}
              onSelect={() => onNavigate({ k: item.k })}
              className={cn(scope === item.k && 'bg-accent text-accent-foreground')}
            >
              {item.icon}
              {item.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
