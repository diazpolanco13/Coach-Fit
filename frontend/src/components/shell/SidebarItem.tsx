import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function SidebarGroup({
  title,
  collapsed,
  children,
  action,
}: {
  title: string
  collapsed: boolean
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="mt-4 first:mt-0">
      {!collapsed && (
        <div className="mb-1 flex items-center justify-between gap-1 px-2">
          <span className="kicker">{title}</span>
          {action}
        </div>
      )}
      {collapsed && <div className="mx-2 mb-1 border-t border-sidebar-border" />}
      <ul className="space-y-0.5">{children}</ul>
    </div>
  )
}

export function SidebarItem({
  label,
  icon,
  active,
  collapsed,
  sub = false,
  badge,
  dirty = false,
  onClick,
}: {
  label: string
  icon?: ReactNode
  active: boolean
  collapsed: boolean
  /** Fila anidada: las subsecciones del plan o del espacio seleccionado. */
  sub?: boolean
  badge?: ReactNode
  /** Punto naranja: hay cambios sin guardar en este plan. No bloquea nada, solo
   *  lo hace visible desde cualquier pantalla. */
  dirty?: boolean
  onClick: () => void
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        // En el riel colapsado no hay etiqueta, así que el título nativo es la
        // única pista. No se añade una primitiva de tooltip solo para esto.
        title={collapsed ? label : undefined}
        aria-label={collapsed ? label : undefined}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex w-full items-center gap-2 rounded-lg px-2 text-left text-sm transition-colors',
          sub ? 'h-8 pl-8 text-[13px]' : 'h-9',
          collapsed && 'justify-center px-0',
          active
            ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
            : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
        )}
      >
        {icon && <span className="shrink-0 [&_svg]:size-4">{icon}</span>}
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1 truncate">{label}</span>
            {dirty && (
              <span
                aria-label="Cambios sin guardar"
                className="size-1.5 shrink-0 rounded-full bg-primary"
              />
            )}
            {badge}
          </>
        )}
      </button>
    </li>
  )
}
