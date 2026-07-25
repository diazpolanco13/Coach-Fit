import { Check, Info, Plus } from 'lucide-react'
import type { Exercise } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MediaImg } from '@/components/MediaImg'
import {
  DIFFICULTY_ES,
  exerciseDifficulty,
  exerciseLoad,
  loadDots,
  muscleRegionLabel,
  recommendedInFamily,
  type Experience,
} from '@/lib/anatomy'
import { equipmentES } from '@/lib/equipment'
import { muscleES } from '@/lib/muscle'
import { cn } from '@/lib/utils'

function LoadDots({ load }: { load: number }) {
  const n = loadDots(load)
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`Carga ${n} de 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          className={cn('size-1.5 rounded-full', i < n ? 'bg-primary' : 'bg-muted-foreground/25')}
        />
      ))}
    </span>
  )
}

export function ExerciseFamilyCard({
  label,
  members,
  experience,
  alreadyIn,
  disabled,
  onAdd,
  onOpenGuide,
}: {
  label: string
  members: Exercise[]
  experience: Experience
  alreadyIn: Set<string>
  disabled?: boolean
  onAdd: (ex: Exercise) => void
  onOpenGuide: (ex: Exercise) => void
}) {
  const recommended = recommendedInFamily(members, experience)
  const head = recommended
  const subtitle = muscleRegionLabel(muscleES(head.target), head.target_region)

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-2">
      <div className="mb-1.5 flex items-start gap-2 px-0.5">
        <button
          type="button"
          onClick={() => onOpenGuide(head)}
          aria-label={`Ver guía de ${label}`}
          className="size-11 shrink-0 overflow-hidden rounded-md border bg-white"
        >
          <MediaImg image={head.image} gif={head.gif} alt={label} className="h-full w-full object-contain" />
        </button>
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="truncate text-sm font-medium">{label}</div>
          <div className="truncate text-xs text-muted-foreground">
            {subtitle} · {members.length} variantes
          </div>
        </div>
      </div>

      <ul className="space-y-0.5">
        {members.map((ex) => {
          const diff = exerciseDifficulty(ex)
          const added = alreadyIn.has(ex.id)
          const isRec = ex.id === recommended.id
          return (
            <li
              key={ex.id}
              className={cn(
                'flex items-center gap-2 rounded-md px-1.5 py-1',
                isRec && 'bg-primary/10',
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    {DIFFICULTY_ES[diff]}
                  </span>
                  {isRec && (
                    <Badge variant="brand" className="h-5 px-1.5 text-[10px]">
                      Recomendado
                    </Badge>
                  )}
                </div>
                <div className="truncate text-sm">{ex.name_es}</div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="truncate">{equipmentES(ex.equipment)}</span>
                  <LoadDots load={exerciseLoad(ex)} />
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Ver guía de ${ex.name_es}`}
                className="shrink-0 text-muted-foreground"
                onClick={() => onOpenGuide(ex)}
              >
                <Info />
              </Button>
              {added ? (
                <Badge variant="brand" className="shrink-0">
                  <Check className="size-3" /> Añadido
                </Badge>
              ) : (
                <Button
                  size="icon-sm"
                  aria-label={`Añadir ${ex.name_es}`}
                  disabled={disabled}
                  className="shrink-0"
                  onClick={() => onAdd(ex)}
                >
                  <Plus />
                </Button>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
