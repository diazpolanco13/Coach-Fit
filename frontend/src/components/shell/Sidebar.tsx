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
  Target,
  TrendingUp,
} from 'lucide-react'
import type { Gym, PlanSummary } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SidebarGroup, SidebarItem } from '@/components/shell/SidebarItem'
import { gymIcon } from '@/lib/gym'
import { espacioRoute, planRoute, routeScope, type Route } from '@/lib/nav'
import { cn } from '@/lib/utils'

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

  const planRow = (p: PlanSummary) => (
    <SidebarItem
      key={p.id}
      label={p.name}
      active={scope === `plan:${p.id}`}
      collapsed={collapsed}
      dirty={dirtyPlanId === p.id}
      badge={p.id === activePlanId ? <Badge variant="brand">Activo</Badge> : undefined}
      onClick={() => navigate(planRoute(p.id))}
    />
  )

  return (
    <nav className="flex h-full flex-col gap-1 overflow-y-auto p-2">
      <div className={cn('mb-2 flex items-center gap-2 px-1', collapsed && 'justify-center')}>
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
        {route.k === 'plan' && (
          <>
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
          </>
        )}
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
          <SidebarItem
            key={g.id}
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
        ))}
        {route.k === 'espacio' && (
          <>
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
          </>
        )}
      </SidebarGroup>

      <SidebarGroup title="Progreso" collapsed={collapsed}>
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
