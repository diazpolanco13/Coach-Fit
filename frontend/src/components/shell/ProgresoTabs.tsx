import {
  Activity,
  CalendarDays,
  ChartSpline,
  Images,
  TrendingUp,
  UserRound,
} from 'lucide-react'
import { PROGRESO_TABS, type ProgresoTab, type Route } from '@/lib/nav'
import { cn } from '@/lib/utils'

const ICONS: Record<ProgresoTab, React.ReactNode> = {
  perfil: <UserRound className="size-4" />,
  tendencias: <ChartSpline className="size-4" />,
  mediciones: <Images className="size-4" />,
  fuerza: <TrendingUp className="size-4" />,
  cardio: <Activity className="size-4" />,
  consistencia: <CalendarDays className="size-4" />,
}

/** Pestañas de la vista de la persona. Cada una navega a su ruta — no cambian
 *  un estado interno — para que atrás, las migas y el enlace directo se sigan
 *  comportando igual que antes de agruparlas. */
export function ProgresoTabs({
  route,
  onNavigate,
}: {
  route: Route
  onNavigate: (route: Route) => void
}) {
  return (
    <div
      role="tablist"
      aria-label="Secciones del progreso"
      className="mb-4 flex gap-1 overflow-x-auto rounded-xl border border-border bg-muted/40 p-1"
    >
      {PROGRESO_TABS.map((tab) => {
        const active = route.k === tab.k
        return (
          <button
            key={tab.k}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => !active && onNavigate({ k: tab.k })}
            className={cn(
              'inline-flex flex-1 shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5',
              'text-sm font-medium whitespace-nowrap transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {ICONS[tab.k]}
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
