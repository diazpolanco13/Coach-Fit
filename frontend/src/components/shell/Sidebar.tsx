import {
  Activity,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Dumbbell,
  Home,
  Library,
  MapPin,
  NotebookPen,
  Plus,
  Settings,
  UserRound,
  Target,
  TrendingUp,
} from 'lucide-react'
import { Fragment } from 'react'
import type { Gym, PlanSummary } from '@/lib/api'
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
      <div
        className={cn(
          'mb-2 flex items-center gap-2 px-1',
          // Apilado en el riel: logo y botón lado a lado no caben en 64px sin
          // estrujarse.
          collapsed && 'flex-col gap-1 px-0',
        )}
      >
        <Dumbbell className="size-5 shrink-0 text-primary" />
        {!collapsed && (
          <span className="flex-1 truncate text-sm font-semibold tracking-wide uppercase">
            Coach Fit
          </span>
        )}
        {onToggleCollapse && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={collapsed ? 'Expandir menú' : 'Plegar menú'}
            onClick={onToggleCollapse}
          >
            {collapsed ? <ChevronRight /> : <ChevronLeft />}
          </Button>
        )}
      </div>

      <SidebarGroup title="Entrenar" collapsed={collapsed}>
        <SidebarItem
          label="Hoy"
          icon={<Home />}
          active={scope === 'hoy'}
          collapsed={collapsed}
          onClick={() => navigate({ k: 'hoy' })}
        />
        <SidebarItem
          label="Registrar"
          icon={<NotebookPen />}
          active={scope === 'registrar'}
          collapsed={collapsed}
          onClick={() => navigate({ k: 'registrar' })}
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

      <SidebarGroup title="Progreso" collapsed={collapsed}>
        <SidebarItem
          label="Perfil"
          icon={<UserRound />}
          active={scope === 'perfil'}
          collapsed={collapsed}
          onClick={() => navigate({ k: 'perfil' })}
        />
        <SidebarItem
          label="Fuerza"
          icon={<TrendingUp />}
          active={scope === 'fuerza'}
          collapsed={collapsed}
          onClick={() => navigate({ k: 'fuerza' })}
        />
        <SidebarItem
          label="Cardio"
          icon={<Activity />}
          active={scope === 'cardio'}
          collapsed={collapsed}
          onClick={() => navigate({ k: 'cardio' })}
        />
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
