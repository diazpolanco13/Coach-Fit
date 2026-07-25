import { Home, Menu, NotebookPen } from 'lucide-react'
import { routeScope, type Route } from '@/lib/nav'
import { cn } from '@/lib/utils'

/** Exactamente tres destinos, y hay que resistir un cuarto para siempre.
 *
 *  Hoy y Registrar se usan a mitad de serie, con una mano: obligarlos a pasar
 *  por el drawer son dos toques y una trampa de foco cada vez. Todo lo demás
 *  vive detrás de «Menú». */
export function MobileBottomBar({
  route,
  navigate,
  onOpenMenu,
}: {
  route: Route
  navigate: (r: Route) => void
  onOpenMenu: () => void
}) {
  const scope = routeScope(route)
  const item = (label: string, icon: React.ReactNode, active: boolean, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] transition-colors',
        active ? 'text-primary' : 'text-muted-foreground',
      )}
    >
      <span className="[&_svg]:size-5">{icon}</span>
      {label}
    </button>
  )

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex h-14 border-t border-border bg-background pb-[env(safe-area-inset-bottom)] md:hidden">
      {item('Hoy', <Home />, scope === 'hoy', () => navigate({ k: 'hoy' }))}
      {item('Registrar', <NotebookPen />, scope === 'registrar', () => navigate({ k: 'registrar' }))}
      {item('Menú', <Menu />, false, onOpenMenu)}
    </div>
  )
}
