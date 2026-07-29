import { LayoutGrid, List } from 'lucide-react'
import { Button } from '@/components/ui/button'

/** Dos iconos (rejilla / lista). El activo va en `secondary` — mismo patrón
 *  que TrainingMode, Historial y Hoy. */
export function ViewToggle({
  view,
  onChange,
  size = 'md',
}: {
  view: 'cards' | 'list'
  onChange: (next: 'cards' | 'list') => void
  /** `sm` = size-8 (historial); `md` = size-9 (sesión). */
  size?: 'sm' | 'md'
}) {
  const box = size === 'sm' ? 'size-8' : 'size-9'
  const icon = size === 'sm' ? 'size-3.5' : 'size-4'
  return (
    <div className="flex items-center gap-0.5">
      <Button
        type="button"
        variant={view === 'cards' ? 'secondary' : 'ghost'}
        size="icon"
        className={box}
        aria-label="Vista tarjetas"
        aria-pressed={view === 'cards'}
        onClick={() => onChange('cards')}
      >
        <LayoutGrid className={icon} />
      </Button>
      <Button
        type="button"
        variant={view === 'list' ? 'secondary' : 'ghost'}
        size="icon"
        className={box}
        aria-label="Vista lista"
        aria-pressed={view === 'list'}
        onClick={() => onChange('list')}
      >
        <List className={icon} />
      </Button>
    </div>
  )
}
