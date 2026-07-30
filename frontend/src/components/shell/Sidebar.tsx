import {
  Bot,
  CalendarDays,
  Dumbbell,
  Home,
  Library,
  MapPin,
  NotebookPen,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings,
  Target,
  Users,
} from 'lucide-react'
import { Fragment } from 'react'
import type { Gym, PlanSummary } from '@/lib/api'
import { useSession } from '@/components/auth/AuthContext'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SidebarGroup, SidebarItem, SidebarSubList } from '@/components/shell/SidebarItem'
import { gymIcon } from '@/lib/gym'
import { espacioRoute, planRoute, routeScope, type Route } from '@/lib/nav'
import { cn } from '@/lib/utils'

/** «Casa PPL + Core» → «CP». Iniciales de las dos primeras palabras con letra
 *  o número; los signos sueltos («+», «·») no cuentan. */
function planInitials(name: string): string {
  const words = name.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w))
  return (
    words
      .slice(0, 2)
      .map((w) => [...w][0]!.toUpperCase())
      .join('') || 'P'
  )
}

/** Los planes no tienen icono propio; sin esto, en el riel colapsado su fila
 *  quedaba como un botón vacío e invisible. La inicial además los distingue
 *  entre sí, cosa que un icono genérico repetido no haría. */
function PlanAvatar({ name, isActivePlan }: { name: string; isActivePlan: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-5 items-center justify-center rounded-md text-[9px] font-bold tracking-tight',
        isActivePlan
          ? 'bg-primary/15 text-primary ring-1 ring-primary/30'
          : 'bg-sidebar-foreground/8 text-sidebar-foreground/70',
      )}
    >
      {planInitials(name)}
    </span>
  )
}

export function Sidebar({
  route,
  navigate,
  collapsed,
  onToggleCollapse,
  plans,
  activePlanId,
  dirtyPlanId,
  gyms,
  activeGymId,
  canAddPlan,
  canAddGym,
  onNewPlan,
  onNewGym,
}: {
  route: Route
  navigate: (r: Route) => void
  collapsed: boolean
  onToggleCollapse?: () => void
  plans: PlanSummary[]
  activePlanId: number | null
  dirtyPlanId: number | null
  gyms: Gym[]
  activeGymId: number | null
  canAddPlan: boolean
  canAddGym: boolean
  onNewPlan: () => void
  onNewGym: () => void
}) {
  const scope = routeScope(route)
  const me = useSession()
  const canManageUsers = me.role === 'admin' || me.role === 'entrenador'

  // Los planes se listan por espacio: el resto queda tras una fila atenuada para
  // que el sidebar no crezca sin control.
  const here = plans.filter((p) => p.gym_id === activeGymId || p.gym_id == null)
  const elsewhere = plans.filter((p) => p.gym_id != null && p.gym_id !== activeGymId)

  // Las subsecciones cuelgan del plan seleccionado, esté donde esté en la
  // lista; renderizarlas al final del grupo dejaba la línea de árbol colgando
  // del último plan aunque no fuera el abierto.
  const planRow = (p: PlanSummary) => (
    <Fragment key={p.id}>
      <SidebarItem
        label={p.name}
        icon={<PlanAvatar name={p.name} isActivePlan={p.id === activePlanId} />}
        active={scope === `plan:${p.id}`}
        collapsed={collapsed}
        dirty={dirtyPlanId === p.id}
        badge={p.id === activePlanId ? <Badge variant="brand">Activo</Badge> : undefined}
        onClick={() => navigate(planRoute(p.id))}
      />
      {route.k === 'plan' && route.id === p.id && (
        <SidebarSubList collapsed={collapsed}>
          <SidebarItem
            label="Días"
            icon={<CalendarDays />}
            active={route.sub === 'dias'}
            collapsed={collapsed}
            sub
            onClick={() => navigate(planRoute(route.id, 'dias'))}
          />
          <SidebarItem
            label="Objetivos"
            icon={<Target />}
            active={route.sub === 'objetivos'}
            collapsed={collapsed}
            sub
            onClick={() => navigate(planRoute(route.id, 'objetivos'))}
          />
        </SidebarSubList>
      )}
    </Fragment>
  )

  return (
    <nav className="flex h-full flex-col gap-1 overflow-y-auto p-2">
      {/* Expandido: marca + nombre + plegar. Colapsado: una sola celda — el
          logo es el botón de expandir (hover cambia a PanelLeftOpen). Evita el
          riel de 64px con logo chico + segundo botón apilados. */}
      {collapsed ? (
        onToggleCollapse ? (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="Expandir menú"
            title="Expandir menú"
            className="group relative mb-2 flex h-9 w-full items-center justify-center rounded-lg text-primary transition-colors hover:bg-sidebar-accent"
          >
            <Dumbbell className="size-5 transition-opacity group-hover:opacity-0 group-focus-visible:opacity-0" />
            <PanelLeftOpen className="absolute size-4 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" />
          </button>
        ) : (
          <div className="mb-2 flex h-9 items-center justify-center text-primary" aria-hidden>
            <Dumbbell className="size-5" />
          </div>
        )
      ) : (
        <div className="mb-2 flex items-center gap-2.5 px-1">
          <span
            aria-hidden
            className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary"
          >
            <Dumbbell className="size-4.5" />
          </span>
          <span className="min-w-0 flex-1 truncate text-[15px] font-semibold tracking-wide uppercase">
            Coach Fit
          </span>
          {onToggleCollapse && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Plegar menú"
              title="Plegar menú"
              onClick={onToggleCollapse}
            >
              {/* PanelLeft*, no chevron: el ← de «Volver» del header queda al
                  lado y con chevrons parecían la misma flecha mal cableada. */}
              <PanelLeftClose />
            </Button>
          )}
        </div>
      )}

      <SidebarGroup title="Entrenar" collapsed={collapsed}>
        <SidebarItem
          label="Hoy"
          icon={<Home />}
          active={scope === 'hoy'}
          collapsed={collapsed}
          onClick={() => navigate({ k: 'hoy' })}
        />
        <SidebarItem
          label="Consistencia"
          icon={<CalendarDays />}
          active={scope === 'consistencia'}
          collapsed={collapsed}
          onClick={() => navigate({ k: 'consistencia' })}
        />
        <SidebarItem
          label="Historial"
          icon={<NotebookPen />}
          active={scope === 'registrar'}
          collapsed={collapsed}
          onClick={() => navigate({ k: 'registrar' })}
        />
        <SidebarItem
          label="Coach"
          icon={<Bot />}
          active={scope === 'coach'}
          collapsed={collapsed}
          onClick={() => navigate({ k: 'coach' })}
        />
      </SidebarGroup>

      <SidebarGroup
        title="Planes"
        collapsed={collapsed}
        action={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Nuevo plan"
            title={canAddPlan ? 'Nuevo plan' : 'Has llegado al máximo de planes'}
            disabled={!canAddPlan}
            onClick={onNewPlan}
          >
            <Plus />
          </Button>
        }
      >
        {here.map(planRow)}
        {!collapsed && elsewhere.length > 0 && (
          <li className="px-2 pt-1">
            <details>
              <summary className="cursor-pointer text-xs text-muted-foreground">
                {elsewhere.length} {elsewhere.length === 1 ? 'plan' : 'planes'} en otros espacios
              </summary>
              <ul className="mt-1 space-y-0.5">{elsewhere.map(planRow)}</ul>
            </details>
          </li>
        )}
        {!collapsed && !plans.length && (
          <li className="px-2 py-1 text-xs text-muted-foreground">Aún no tienes planes.</li>
        )}
      </SidebarGroup>

      <SidebarGroup
        title="Espacios"
        collapsed={collapsed}
        action={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Nuevo espacio"
            title={canAddGym ? 'Nuevo espacio' : 'Has llegado al máximo de espacios'}
            disabled={!canAddGym}
            onClick={onNewGym}
          >
            <Plus />
          </Button>
        }
      >
        {gyms.map((g) => (
          <Fragment key={g.id}>
            <SidebarItem
              label={g.name}
              icon={<span aria-hidden>{gymIcon(g)}</span>}
              active={scope === `espacio:${g.id}`}
              collapsed={collapsed}
              badge={
                g.id === activeGymId ? (
                  <MapPin className="size-3.5 shrink-0 text-primary" aria-label="Espacio activo" />
                ) : undefined
              }
              onClick={() => navigate(espacioRoute(g.id))}
            />
            {route.k === 'espacio' && route.id === g.id && (
              <SidebarSubList collapsed={collapsed}>
                <SidebarItem
                  label="Inventario"
                  icon={<Dumbbell />}
                  active={route.sub === 'inventario'}
                  collapsed={collapsed}
                  sub
                  onClick={() => navigate(espacioRoute(route.id, 'inventario'))}
                />
                <SidebarItem
                  label="Biblioteca"
                  icon={<Library />}
                  active={route.sub === 'biblioteca'}
                  collapsed={collapsed}
                  sub
                  onClick={() => navigate(espacioRoute(route.id, 'biblioteca'))}
                />
              </SidebarSubList>
            )}
          </Fragment>
        ))}
      </SidebarGroup>

      <div className="mt-auto pt-3">
        <ul className="space-y-0.5">
          <SidebarItem
            label="Catálogo"
            icon={<Library />}
            active={scope === 'catalogo'}
            collapsed={collapsed}
            onClick={() => navigate({ k: 'catalogo' })}
          />
          {canManageUsers ? (
            <SidebarItem
              label="Usuarios"
              icon={<Users />}
              active={scope === 'usuarios'}
              collapsed={collapsed}
              onClick={() => navigate({ k: 'usuarios' })}
            />
          ) : null}
          <SidebarItem
            label="Ajustes"
            icon={<Settings />}
            active={scope === 'ajustes'}
            collapsed={collapsed}
            onClick={() => navigate({ k: 'ajustes' })}
          />
        </ul>
      </div>
    </nav>
  )
}
