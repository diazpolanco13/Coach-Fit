import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import type { PlanSection } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PLAN_SECTION_BADGE } from '@/lib/plan'
import { cn } from '@/lib/utils'

/** Cabecera de bloque Calentamiento/Cardio/Fuerza con pliegue persistido. */
export function PlanSectionHeader({
  id,
  label,
  count,
  collapsed,
  onToggle,
  trailing,
  foldable = true,
  className,
}: {
  id: PlanSection
  label: string
  count?: number
  collapsed: boolean
  onToggle: () => void
  trailing?: ReactNode
  /** En edición del plan se deja abierto y sin chevron. */
  foldable?: boolean
  className?: string
}) {
  const canFold = foldable
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-2',
        !(canFold && collapsed) && 'mb-2',
        className,
      )}
    >
      {canFold ? (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!collapsed}
          aria-label={collapsed ? `Expandir ${label}` : `Plegar ${label}`}
          className="min-w-0 rounded-md text-left transition-opacity hover:opacity-90"
        >
          <Badge variant="outline" className={cn('font-medium', PLAN_SECTION_BADGE[id])}>
            {label}
            {count != null && count > 0 && (
              <span className="ml-1.5 font-normal opacity-70">{count}</span>
            )}
          </Badge>
        </button>
      ) : (
        <Badge variant="outline" className={cn('font-medium', PLAN_SECTION_BADGE[id])}>
          {label}
          {count != null && count > 0 && (
            <span className="ml-1.5 font-normal opacity-70">{count}</span>
          )}
        </Badge>
      )}
      <div className="flex shrink-0 items-center gap-0.5">
        {trailing}
        {canFold && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-7"
            aria-expanded={!collapsed}
            aria-label={collapsed ? `Expandir ${label}` : `Plegar ${label}`}
            onClick={(e) => {
              e.stopPropagation()
              onToggle()
            }}
          >
            <ChevronDown
              className={cn(
                'size-4 text-muted-foreground transition-transform',
                collapsed && '-rotate-90',
              )}
            />
          </Button>
        )}
      </div>
    </div>
  )
}
