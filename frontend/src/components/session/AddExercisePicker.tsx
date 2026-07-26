import { useMemo, useState } from 'react'
import { Plus, Search, X } from 'lucide-react'
import type { Exercise } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MediaImg } from '@/components/MediaImg'
import { useData } from '@/components/shell/DataContext'
import { availableEquipment } from '@/lib/equipment'
import { ALL, EMPTY_FILTER, filterExercises, muscleOptions } from '@/lib/exerciseFilter'
import { muscleES } from '@/lib/muscle'
import { cn } from '@/lib/utils'

const MAX_RESULTS = 24

/** Selector para añadir un ejercicio suelto a la sesión del día.
 *
 *  Reutiliza `filterExercises` en lugar de filtrar a mano: así el «solo con mi
 *  material» significa exactamente lo mismo aquí que en la biblioteca y en el
 *  editor de planes, incluidos los desbloqueos de equipo.
 */
export function AddExercisePicker({
  /** Ya presentes en la sesión: se marcan para no añadirlos dos veces. */
  present,
  onAdd,
  onClose,
}: {
  present: Set<string>
  onAdd: (ex: Exercise) => void
  onClose: () => void
}) {
  const { exercises, activeEquipment, equipmentUnlocks } = useData()
  const [query, setQuery] = useState('')
  const [muscle, setMuscle] = useState<string>(ALL)

  const mine = useMemo(
    () => availableEquipment(activeEquipment, equipmentUnlocks),
    [activeEquipment, equipmentUnlocks],
  )
  const muscles = useMemo(() => muscleOptions(exercises), [exercises])
  const results = useMemo(
    () => filterExercises(exercises, { ...EMPTY_FILTER, query, muscle }, mine).slice(0, MAX_RESULTS),
    [exercises, query, muscle, mine],
  )

  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar ejercicio…"
            className="pl-8"
            aria-label="Buscar ejercicio para añadir"
          />
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar el buscador">
          <X className="size-4" />
        </Button>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {[ALL, ...muscles].slice(0, 13).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMuscle(m)}
            className={cn(
              'rounded-full border px-2.5 py-1 text-xs transition-colors',
              muscle === m
                ? 'border-primary bg-primary/10 font-medium text-primary'
                : 'text-muted-foreground hover:border-primary/50',
            )}
          >
            {m === ALL ? 'Todos' : muscleES(m)}
          </button>
        ))}
      </div>

      {results.length ? (
        <div className="mt-3 grid max-h-72 grid-cols-2 gap-2 overflow-auto sm:grid-cols-3">
          {results.map((ex) => {
            const already = present.has(ex.id)
            return (
              <button
                key={ex.id}
                type="button"
                disabled={already}
                onClick={() => onAdd(ex)}
                className={cn(
                  'flex items-center gap-2 rounded-lg border p-2 text-left transition-colors',
                  already ? 'opacity-50' : 'hover:border-primary/60 hover:bg-muted/60',
                )}
              >
                <div className="size-10 shrink-0 rounded border bg-muted/40">
                  <MediaImg
                    image={ex.image}
                    gif={ex.gif}
                    alt={ex.name_es}
                    className="h-full w-full object-contain"
                  />
                </div>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-xs font-medium">{ex.name_es}</span>
                  <span className="text-[11px] text-muted-foreground">{muscleES(ex.target)}</span>
                </span>
                {!already && <Plus className="size-3.5 shrink-0 text-muted-foreground" />}
              </button>
            )
          })}
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          Nada con ese filtro y el material de este espacio.
        </p>
      )}
    </div>
  )
}
