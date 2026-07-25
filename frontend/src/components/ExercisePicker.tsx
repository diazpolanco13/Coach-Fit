import { useMemo, useState } from 'react'
import { Check, Dumbbell, Plus, Search } from 'lucide-react'
import type { Exercise, UserEquipment } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MediaImg } from '@/components/MediaImg'
import { availableEquipment, equipmentES } from '@/lib/equipment'
import { muscleES } from '@/lib/muscle'

const ROLES = [
  { id: 'todos', label: 'Todos' },
  { id: 'push', label: 'Empuje' },
  { id: 'pull', label: 'Tirón' },
  { id: 'legs', label: 'Piernas' },
  { id: 'core', label: 'Core' },
]

const LIMIT = 40

export function ExercisePicker({
  open,
  dayLabel,
  exercises,
  equipment,
  equipmentUnlocks,
  alreadyIn,
  onPick,
  onClose,
}: {
  open: boolean
  dayLabel: string
  exercises: Exercise[]
  equipment: UserEquipment[]
  equipmentUnlocks: Record<string, string[]>
  /** Ids ya presentes en el día: se marcan para no añadirlos dos veces. */
  alreadyIn: string[]
  onPick: (ex: Exercise) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [role, setRole] = useState('todos')
  const [muscle, setMuscle] = useState('todos')
  const [onlyMine, setOnlyMine] = useState(true)

  const mine = useMemo(
    () => availableEquipment(equipment, equipmentUnlocks),
    [equipment, equipmentUnlocks],
  )

  const muscles = useMemo(() => {
    const set = new Set(exercises.map((e) => e.target).filter(Boolean))
    return [...set].sort((a, b) => muscleES(a).localeCompare(muscleES(b), 'es'))
  }, [exercises])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    return exercises.filter((e) => {
      if (role !== 'todos' && e.role !== role) return false
      if (muscle !== 'todos' && e.target !== muscle) return false
      if (onlyMine && !mine.has(e.equipment)) return false
      if (q && !e.name_es.toLowerCase().includes(q) && !e.name.toLowerCase().includes(q)) return false
      return true
    })
  }, [exercises, role, muscle, onlyMine, mine, query])

  const inDay = useMemo(() => new Set(alreadyIn), [alreadyIn])

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl border-t-4 border-t-primary">
        <DialogHeader>
          <DialogTitle>Añadir ejercicio</DialogTitle>
          <DialogDescription>{dayLabel}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 p-4 pt-0">
          <div className="flex flex-wrap gap-2">
            {ROLES.map((f) => (
              <Button
                key={f.id}
                size="sm"
                variant={role === f.id ? 'default' : 'outline'}
                onClick={() => setRole(f.id)}
              >
                {f.label}
              </Button>
            ))}
          </div>

          <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Buscar…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <Select value={muscle} onValueChange={setMuscle}>
              <SelectTrigger className="sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los músculos</SelectItem>
                {muscles.map((m) => (
                  <SelectItem key={m} value={m}>
                    {muscleES(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant={onlyMine ? 'default' : 'outline'}
              aria-pressed={onlyMine}
              className="gap-1.5"
              onClick={() => setOnlyMine((v) => !v)}
            >
              {onlyMine ? <Check /> : <Dumbbell />}
              Mi equipo
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            {results.length} {results.length === 1 ? 'resultado' : 'resultados'}
            {results.length > LIMIT && ` · mostrando los primeros ${LIMIT}, afina la búsqueda`}
          </p>

          <div className="max-h-[46vh] space-y-1 overflow-auto">
            {results.slice(0, LIMIT).map((ex) => {
              const added = inDay.has(ex.id)
              return (
                <button
                  key={ex.id}
                  type="button"
                  disabled={added}
                  onClick={() => onPick(ex)}
                  className="flex w-full items-center gap-3 rounded-lg border border-transparent p-1.5 text-left transition-colors hover:border-border hover:bg-muted/60 disabled:opacity-50 disabled:hover:border-transparent disabled:hover:bg-transparent"
                >
                  <div className="size-11 shrink-0 overflow-hidden rounded-md border bg-white">
                    <MediaImg image={ex.image} gif={ex.gif} alt={ex.name_es} className="h-full w-full object-contain" />
                  </div>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{ex.name_es}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {muscleES(ex.target)} · {equipmentES(ex.equipment)}
                    </span>
                  </span>
                  {added ? (
                    <Badge variant="brand" className="shrink-0">
                      <Check className="size-3" /> Añadido
                    </Badge>
                  ) : (
                    <Plus className="size-4 shrink-0 text-primary" />
                  )}
                </button>
              )
            })}
            {!results.length && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nada coincide. Prueba a quitar filtros o desactivar «Mi equipo».
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
