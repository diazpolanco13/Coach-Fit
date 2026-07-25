import { ChevronRight } from 'lucide-react'
import type { Crumb } from '@/lib/breadcrumbs'
import { cn } from '@/lib/utils'

export function Breadcrumbs({
  crumbs,
  onNavigate,
  className,
}: {
  crumbs: Crumb[]
  onNavigate: (route: NonNullable<Crumb['route']>) => void
  className?: string
}) {
  if (!crumbs.length) return null

  return (
    <nav aria-label="Migas de pan" className={cn('min-w-0', className)}>
      <ol className="flex min-w-0 items-center gap-1 text-sm">
        {crumbs.map((crumb, i) => {
          const last = i === crumbs.length - 1
          return (
            <li key={`${crumb.label}-${i}`} className="flex min-w-0 items-center gap-1">
              {i > 0 && (
                <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/70" aria-hidden />
              )}
              {last || !crumb.route ? (
                <span
                  className={cn(
                    'truncate',
                    last ? 'font-medium text-foreground' : 'text-muted-foreground',
                  )}
                  aria-current={last ? 'page' : undefined}
                >
                  {crumb.label}
                </span>
              ) : (
                <button
                  type="button"
                  className="truncate text-muted-foreground transition-colors hover:text-foreground"
                  onClick={() => onNavigate(crumb.route!)}
                >
                  {crumb.label}
                </button>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
