import { ChartSpline, KeyRound, LogOut, UserRound } from 'lucide-react'
import type { UserProfile } from '@/lib/api'
import { useSession } from '@/components/auth/AuthContext'
import { isProgresoTab, type Route } from '@/lib/nav'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrador',
  entrenador: 'Entrenador',
  usuario: 'Usuario',
}

/**
 * Menú de cuenta.
 *
 * Antes listaba las seis pantallas de Progreso, que es exactamente lo que ya
 * ofrecen las pestañas cuando estás dentro: la misma navegación en dos sitios.
 * Ahora deja una sola puerta de entrada a Progreso —el sidebar no tiene
 * ninguna— y se queda con lo que solo puede vivir aquí: quién eres y salir.
 */
export function UserMenu({
  route,
  onNavigate,
  profile,
  onChangePassword,
  onLogout,
}: {
  route: Route
  onNavigate: (route: Route) => void
  profile?: UserProfile | null
  onChangePassword: () => void
  onLogout: () => void
}) {
  const user = useSession()
  const photoUrl = profile?.has_photo ? profile.photo_url : null
  const progressActive = isProgresoTab(route)
  const name = user.full_name || profile?.full_name || user.email

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Menú de cuenta"
          title={name}
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

      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuLabel className="flex flex-col gap-1">
          <span className="truncate text-sm font-medium">{name}</span>
          <span className="flex items-center gap-1.5">
            <Badge variant="secondary" className="text-[10px]">
              {ROLE_LABEL[user.role] ?? user.role}
            </Badge>
            {/* Sin nombre, `name` ya es el correo: repetirlo debajo es ruido. */}
            {name !== user.email && (
              <span className="truncate text-xs font-normal text-muted-foreground">
                {user.email}
              </span>
            )}
          </span>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        {/* Única entrada a Progreso desde fuera: el sidebar no lo lista. Una vez
            dentro, las pestañas se encargan del resto. */}
        <DropdownMenuItem
          onSelect={() => onNavigate({ k: 'perfil' })}
          className={cn(progressActive && 'bg-accent text-accent-foreground')}
        >
          <ChartSpline />
          Progreso
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onSelect={onChangePassword}>
          <KeyRound />
          Cambiar contraseña
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onLogout} variant="destructive">
          <LogOut />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
