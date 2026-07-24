import { useState } from 'react'
import type { Exercise } from '@/lib/api'
import { ExerciseCard } from '@/components/ExerciseCard'
import { cn } from '@/lib/utils'

const FILTERS = [
  { id: 'todos', label: 'Todos' },
  { id: 'push', label: 'Empuje' },
  { id: 'pull', label: 'Tirón' },
  { id: 'legs', label: 'Piernas' },
  { id: 'core', label: 'Core' },
]

export function EjerciciosTab({
  exercises,
  onOpenExercise,
}: {
  exercises: Exercise[]
  onOpenExercise: (ex: Exercise) => void
}) {
  const [filter, setFilter] = useState('todos')
  const filtered = filter === 'todos' ? exercises : exercises.filter((e) => e.role === filter)

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="kicker">Biblioteca</div>
          <h1 className="font-heading text-3xl leading-tight font-extrabold">
            {filtered.length} ejercicios para tu equipo
          </h1>
        </div>
        <div className="flex overflow-hidden rounded-lg border border-border">
          {FILTERS.map((f, i) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                'px-3.5 py-2 text-sm transition-colors',
                i > 0 && 'border-l border-border',
                filter === f.id ? 'bg-primary text-primary-foreground' : 'bg-transparent hover:bg-muted',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {filtered.map((ex) => (
          <ExerciseCard key={ex.id} ex={ex} onOpen={onOpenExercise} />
        ))}
      </div>
    </div>
  )
}
