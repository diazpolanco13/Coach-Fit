import { useMemo, useState } from 'react'
import { Check, Dumbbell, Search } from 'lucide-react'
import type { Exercise, UserEquipment } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ExerciseCard } from '@/components/ExerciseCard'
import { availableEquipment, equipmentES } from '@/lib/equipment'
import { muscleES } from '@/lib/muscle'
import { cn } from '@/lib/utils'

const ROLES = [
  { id: 'todos', label: 'Todos' },
  { id: 'push', label: 'Empuje' },
  { id: 'pull', label: 'Tirón' },
  { id: 'legs', label: 'Piernas' },
  { id: 'core', label: 'Core' },
  { id: 'cardio', label: 'Cardio' },
]

const PAGE = 60

export function EjerciciosTab({
  exercises,
  equipment,
  equipmentUnlocks,
  onOpenExercise,
}: {
  exercises: Exercise[]
  equipment: UserEquipment[]
  equipmentUnlocks: Record<string, string[]>
  onOpenExercise: (ex: Exercise) => void
}) {
  const [role, setRole] = useState('todos')
  const [muscle, setMuscle] = useState('todos')
  const [equip, setEquip] = useState('todos')
  const [query, setQuery] = useState('')
  const [onlyMine, setOnlyMine] = useState(true)
  const [visible, setVisible] = useState(PAGE)

  const mine = useMemo(
    () => availableEquipment(equipment, equipmentUnlocks),
    [equipment, equipmentUnlocks],
  )

  const muscles = useMemo(() => {
    const set = new Set(exercises.map((e) => e.target).filter(Boolean))
    return [...set].sort((a, b) => muscleES(a).localeCompare(muscleES(b), 'es'))
  }, [exercises])

  const equipments = useMemo(() => {
    const set = new Set(exercises.map((e) => e.equipment).filter(Boolean))
    return [...set].sort((a, b) => equipmentES(a).localeCompare(equipmentES(b), 'es'))
  }, [exercises])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return exercises.filter((e) => {
      if (role !== 'todos' && e.role !== role) return false
      if (muscle !== 'todos' && e.target !== muscle) return false
      if (equip !== 'todos' && e.equipment !== equip) return false
      if (onlyMine && !mine.has(e.equipment)) return false
      if (q && !e.name_es.toLowerCase().includes(q) && !e.name.toLowerCase().includes(q)) return false
      return true
    })
  }, [exercises, role, muscle, equip, onlyMine, mine, query])

  // Cualquier cambio de filtro vuelve a empezar por la primera pagina.
  const resetting = (fn: () => void) => () => {
    fn()
    setVisible(PAGE)
  }

  return (
    <div>
      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="kicker">Biblioteca</div>
            <h1 className="font-heading text-3xl leading-tight font-extrabold">
              {filtered.length} {filtered.length === 1 ? 'ejercicio' : 'ejercicios'}
              {onlyMine && <span className="text-muted-foreground"> con tu equipo</span>}
            </h1>
          </div>
          <div className="flex overflow-hidden rounded-lg border border-border">
            {ROLES.map((f, i) => (
              <button
                key={f.id}
                type="button"
                onClick={resetting(() => setRole(f.id))}
                className={cn(
                  'px-3 py-2 text-sm transition-colors',
                  i > 0 && 'border-l border-border',
                  role === f.id ? 'bg-primary text-primary-foreground' : 'bg-transparent hover:bg-muted',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label>Buscar</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="press, sentadilla, curl…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setVisible(PAGE)
                }}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Músculo</Label>
            <Select
              value={muscle}
              onValueChange={(v) => {
                setMuscle(v)
                setVisible(PAGE)
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {muscles.map((m) => (
                  <SelectItem key={m} value={m}>
                    {muscleES(m)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Equipo</Label>
            <Select
              value={equip}
              onValueChange={(v) => {
                setEquip(v)
                setVisible(PAGE)
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {equipments.map((eq) => (
                  <SelectItem key={eq} value={eq}>
                    {equipmentES(eq)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Filtro</Label>
            {/* La etiqueta no cambia al alternar: si cambiaran texto y estilo a
                la vez no se sabe si el boton describe el estado actual o la
                accion. Fijo el texto y el estado lo dice el relleno + el check. */}
            <Button
              variant={onlyMine ? 'default' : 'outline'}
              aria-pressed={onlyMine}
              className="w-full gap-1.5"
              onClick={resetting(() => setOnlyMine((v) => !v))}
            >
              {onlyMine ? <Check /> : <Dumbbell />}
              Solo con mi equipo
            </Button>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Ningún ejercicio coincide. Prueba a quitar filtros o desactivar «Solo con mi equipo».
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {filtered.slice(0, visible).map((ex) => (
              <ExerciseCard key={ex.id} ex={ex} onOpen={onOpenExercise} />
            ))}
          </div>
          {visible < filtered.length && (
            <div className="mt-4 flex justify-center">
              <Button variant="outline" onClick={() => setVisible((v) => v + PAGE)}>
                Ver más ({filtered.length - visible} restantes)
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
