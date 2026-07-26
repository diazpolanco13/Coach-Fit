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
      {collapsed && <div className="mx-2 mb-1.5 border-t border-sidebar-border" />}
      <ul className="space-y-0.5">{children}</ul>
    </div>
  )
}

/** Subsecciones agrupadas bajo su padre (Días/Objetivos, Inventario/Biblioteca).
 *
 *  Expandido: línea de árbol a la izquierda, en vez de sangría plana.
 *  Colapsado: banda con fondo sutil, para que los iconos hijos no se lean como
 *  ítems de primer nivel del riel. */
export function SidebarSubList({
  collapsed,
  children,
}: {
  collapsed: boolean
  children: ReactNode
}) {
  return (
    <li>
      <ul
        className={cn(
          'space-y-0.5',
          collapsed
            ? 'mx-1 my-0.5 rounded-lg bg-sidebar-accent/50 py-0.5'
            : 'my-0.5 ml-4 border-l border-sidebar-border pl-2',
        )}
      >
        {children}
      </ul>
    </li>
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
          'relative flex w-full items-center gap-2 rounded-lg px-2 text-left text-sm transition-colors',
          sub ? 'h-8 text-[13px]' : 'h-9',
          collapsed && 'justify-center px-0',
          active
            ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
            : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
        )}
      >
        {icon && (
          <span
            className={cn(
              'flex shrink-0 items-center justify-center [&_svg]:size-4',
              sub && collapsed && 'opacity-80 [&_svg]:size-3.5',
            )}
          >
            {icon}
          </span>
        )}
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
        {collapsed && dirty && (
          <span
            aria-label="Cambios sin guardar"
            className="absolute top-1 right-1.5 size-1.5 rounded-full bg-primary"
          />
        )}
      </button>
    </li>
  )
}
