import { Ban, CheckCircle2 } from 'lucide-react'
import type { PlanItem } from '@/lib/api'
import { MediaImg } from '@/components/MediaImg'
import { Badge } from '@/components/ui/badge'
import { formatCardioPrescription, isEnduranceCardioItem } from '@/lib/cardio'
import { muscleES } from '@/lib/muscle'
import {
  PLAN_SECTION_BADGE,
  PLAN_SECTION_STYLE,
  PLAN_SECTIONS,
  resolveSection,
} from '@/lib/plan'
import { SKIP_REASON_LABEL, type ExerciseSkipsMap } from '@/lib/sessionCheckIn'
import {
  formatPlaylistLoad,
  setsDoneFor,
  type CompletedSet,
  type TrainingExercise,
} from '@/lib/training'
import { cn } from '@/lib/utils'

type Status = 'pending' | 'partial' | 'complete' | 'skipped'

function statusOf(
  done: number,
  planned: number,
  skipped: boolean,
  isCardio: boolean,
): Status {
  if (skipped) return 'skipped'
  if (isCardio) return done > 0 ? 'complete' : 'pending'
  if (done >= planned) return 'complete'
  if (done > 0) return 'partial'
  return 'pending'
}

function statusLabel(
  status: Status,
  done: number,
  planned: number,
  isCardio: boolean,
): string {
  if (status === 'skipped') return 'Omitido'
  if (isCardio) return status === 'complete' ? 'Hecho' : 'Pendiente'
  if (status === 'complete') return `${done}/${planned} · Hecho`
  if (status === 'partial') return `${done}/${planned} · En curso`
  return `${done}/${planned} series`
}

export function SessionExercisePlaylist({
  exs,
  log,
  skips,
  items,
  onSelect,
}: {
  exs: TrainingExercise[]
  log: CompletedSet[]
  skips: ExerciseSkipsMap
  items: PlanItem[]
  onSelect: (index: number) => void
}) {
  const itemById = new Map(items.map((it) => [it.exercise_id, it]))
  const sections = PLAN_SECTIONS.map(({ id, label }) => ({
    id,
    label,
    entries: exs
      .map((e, index) => ({ e, index }))
      .filter(({ e }) => {
        const planItem = itemById.get(e.exercise_id)
        return resolveSection(planItem ?? {}) === id
      }),
  })).filter((s) => s.entries.length > 0)

  return (
    <div className="flex flex-col gap-3 pt-1 pl-1">
      {sections.map(({ id, label: sectionLabel, entries }) => (
        <section
          key={id}
          className={cn('rounded-xl border p-2.5 sm:p-3', PLAN_SECTION_STYLE[id])}
        >
          <div className="mb-2.5">
            <Badge
              variant="outline"
              className={cn('font-medium', PLAN_SECTION_BADGE[id])}
            >
              {sectionLabel}
              <span className="ml-1.5 font-normal opacity-70">{entries.length}</span>
            </Badge>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3">
            {entries.map(({ e, index: i }) => {
              const done = setsDoneFor(e.exercise_id, log)
              const skipped = Boolean(skips[e.exercise_id])
              const planItem = itemById.get(e.exercise_id)
              const isCardio = Boolean(planItem && isEnduranceCardioItem(planItem))
              const status = statusOf(done, e.sets, skipped, isCardio)
              const label = statusLabel(status, done, e.sets, isCardio)
              const detail =
                isCardio && planItem
                  ? formatCardioPrescription(planItem)
                  : formatPlaylistLoad(e, log, planItem)
              const muscle = e.target ? muscleES(e.target) : ''
              const pct =
                !isCardio && !skipped && e.sets > 0
                  ? Math.min(100, Math.round((done / e.sets) * 100))
                  : status === 'complete'
                    ? 100
                    : 0

              return (
                <button
                  key={e.exercise_id}
                  type="button"
                  onClick={() => onSelect(i)}
                  style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }}
                  className={cn(
                    'animate-in fade-in-0 slide-in-from-bottom-2 duration-300',
                    'flex gap-3 rounded-xl border p-2.5 text-left transition-[transform,colors,border-color,background-color]',
                    'active:scale-[0.98] touch-manipulation',
                    status === 'complete' &&
                      'border-primary/45 bg-primary/10 hover:border-primary/60 hover:bg-primary/15',
                    status === 'skipped' &&
                      'border-amber-500/40 bg-amber-500/10 hover:border-amber-500/55 hover:bg-amber-500/15',
                    status === 'partial' &&
                      'border-amber-500/40 bg-amber-500/10 hover:border-amber-500/55 hover:bg-amber-500/15',
                    status === 'pending' &&
                      'border-border/70 bg-card hover:border-primary/35 hover:bg-muted/40',
                  )}
                >
                  <div className="relative shrink-0 self-start">
                    <div
                      className={cn(
                        'size-16 overflow-hidden rounded-lg border bg-white sm:size-[4.5rem]',
                        status === 'pending' ? 'border-border' : 'border-border/60',
                        status === 'skipped' && 'opacity-70',
                      )}
                    >
                      <MediaImg
                        image={e.image}
                        gif={e.gif}
                        alt=""
                        className="h-full w-full object-contain p-1"
                      />
                    </div>
                    <div
                      className={cn(
                        'absolute -top-1.5 -left-1.5 z-10 flex size-6 items-center justify-center rounded-full border text-[11px] font-semibold tabular-nums shadow-sm',
                        status === 'complete' &&
                          'border-primary/50 bg-primary text-primary-foreground',
                        status === 'skipped' &&
                          'border-amber-500/50 bg-amber-500 text-white',
                        status === 'partial' &&
                          'border-amber-500/50 bg-amber-500 text-white',
                        status === 'pending' &&
                          'border-border bg-background text-muted-foreground',
                      )}
                    >
                      {i + 1}
                    </div>
                  </div>

                  <div className="min-w-0 flex-1 py-0.5">
                    <div className="flex items-start gap-1.5">
                      <div
                        className={cn(
                          'min-w-0 flex-1 text-sm font-medium leading-snug line-clamp-2',
                          status === 'pending' ? 'text-foreground/90' : 'text-foreground',
                        )}
                      >
                        {e.name_es}
                      </div>
                      {status === 'complete' && (
                        <CheckCircle2
                          className="mt-0.5 size-4 shrink-0 text-primary"
                          aria-hidden
                        />
                      )}
                      {status === 'skipped' && (
                        <Ban
                          className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400"
                          aria-hidden
                        />
                      )}
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs tabular-nums">
                      <span
                        className={cn(
                          'font-medium',
                          status === 'complete' && 'text-primary',
                          (status === 'partial' || status === 'skipped') &&
                            'text-amber-700 dark:text-amber-400',
                          status === 'pending' && 'text-muted-foreground',
                        )}
                      >
                        {label}
                      </span>
                      {muscle && status !== 'skipped' && (
                        <span className="truncate text-muted-foreground">{muscle}</span>
                      )}
                    </div>

                    <div
                      className={cn(
                        'mt-0.5 truncate text-xs',
                        status === 'skipped'
                          ? 'text-amber-700/80 dark:text-amber-400/80'
                          : 'text-muted-foreground',
                      )}
                    >
                      {status === 'skipped' && skips[e.exercise_id]
                        ? SKIP_REASON_LABEL[skips[e.exercise_id]]
                        : detail}
                    </div>

                    {!isCardio && status !== 'skipped' && e.sets > 0 && (
                      <div
                        className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
                        aria-hidden
                      >
                        <div
                          className={cn(
                            'h-full rounded-full transition-[width] duration-300 ease-out',
                            status === 'complete' && 'bg-primary',
                            status === 'partial' && 'bg-amber-500',
                            status === 'pending' && 'bg-muted-foreground/25',
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
