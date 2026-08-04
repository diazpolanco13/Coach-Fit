import type {
  ExerciseFeedbackMap,
  ExerciseSkipsMap,
  PlanSection,
  PlanSummary,
  SessionSet,
  WeekDay,
} from '@/lib/api'
import { isEnduranceCardioItem, runForExercise, type CardioRun } from '@/lib/cardio'
import { dayOfMonth } from '@/lib/dates'
import { doneCountByExercise, planPosition } from '@/lib/hoy'
import { resolveSection } from '@/lib/plan'
import { hasExercisePain } from '@/lib/sessionCheckIn'
import { cn } from '@/lib/utils'

const INITIALS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

/** Exterior → interior: fuerza, cardio, calentamiento. */
const RING_ORDER: PlanSection[] = ['strength', 'cardio', 'warmup']

const RING_COLOR: Record<PlanSection, string> = {
  warmup: '#38bdf8', // sky-400 — mismo acento que el bloque Calentamiento
  cardio: '#f59e0b', // amber-500
  strength: '#34d399', // emerald-400 — contraste limpio con sky/ámbar
}

const RING_GEOM: Record<PlanSection, { r: number; sw: number }> = {
  strength: { r: 17.2, sw: 2.9 },
  cardio: { r: 12.4, sw: 2.9 },
  warmup: { r: 7.6, sw: 2.9 },
}

const VIEW = 40
const CX = VIEW / 2
const CY = VIEW / 2

function sectionPct(
  day: WeekDay,
  section: PlanSection,
  doneByEx: Record<string, number>,
  skips: ExerciseSkipsMap,
  feedback: ExerciseFeedbackMap,
  runs: CardioRun[],
): number | null {
  const items = day.items.filter((it) => resolveSection(it) === section)
  if (!items.length) return null

  // Día cerrado: anillos llenos aunque falte el detalle de series.
  if (day.status === 'completed' || day.status === 'bonus') return 100

  let planned = 0
  let done = 0
  for (const item of items) {
    const sets = Math.max(0, item.sets)
    planned += sets
    if (skips[item.exercise_id] || hasExercisePain(feedback, item.exercise_id)) {
      done += sets
      continue
    }
    if (isEnduranceCardioItem(item) && runForExercise(runs, day.date, item.exercise_id)) {
      done += sets
      continue
    }
    done += Math.min(sets, doneByEx[item.exercise_id] ?? 0)
  }
  if (!planned) return 0
  // Sin series cargadas aún: aproxima con el % del día para no pintar vacío.
  if (done === 0 && day.done_sets > 0 && day.status === 'partial') {
    return Math.max(0, Math.min(100, day.completion_pct))
  }
  return Math.round(Math.min(done / planned, 1) * 100)
}

function DayRings({
  day,
  sets,
  skips,
  feedback,
  runs,
}: {
  day: WeekDay
  sets: SessionSet[]
  skips: ExerciseSkipsMap
  feedback: ExerciseFeedbackMap
  runs: CardioRun[]
}) {
  const doneByEx = doneCountByExercise(sets)
  const pcts = RING_ORDER.map((section) => ({
    section,
    pct: sectionPct(day, section, doneByEx, skips, feedback, runs),
    ...RING_GEOM[section],
  })).filter((r) => r.pct != null) as Array<{
    section: PlanSection
    pct: number
    r: number
    sw: number
  }>

  if (!pcts.length) {
    return (
      <div className="relative mx-auto flex size-10 items-center justify-center">
        <span className="text-sm font-semibold tabular-nums text-muted-foreground/50">·</span>
      </div>
    )
  }

  return (
    <div className="relative mx-auto size-10">
      <svg className="absolute inset-0 size-10 -rotate-90" viewBox={`0 0 ${VIEW} ${VIEW}`} aria-hidden>
        {pcts.map(({ section, pct, r, sw }) => {
          const c = 2 * Math.PI * r
          const color = RING_COLOR[section]
          return (
            <g key={section}>
              <circle
                cx={CX}
                cy={CY}
                r={r}
                fill="none"
                stroke={color}
                strokeOpacity={0.18}
                strokeWidth={sw}
              />
              {pct > 0 && (
                <circle
                  cx={CX}
                  cy={CY}
                  r={r}
                  fill="none"
                  stroke={color}
                  strokeOpacity={1}
                  strokeWidth={sw}
                  strokeLinecap="round"
                  strokeDasharray={`${(pct / 100) * c} ${c}`}
                />
              )}
            </g>
          )
        })}
      </svg>
      <span className="relative z-10 flex size-full items-center justify-center text-xs font-semibold tabular-nums leading-none">
        {dayOfMonth(day.date)}
      </span>
    </div>
  )
}

export function WeekStrip({
  days,
  todayDate,
  selectedDate,
  plans,
  activeId,
  objective,
  onSelectDay,
  setsByDate = {},
  feedbackByDate = {},
  skipsByDate = {},
  metricsRuns = [],
}: {
  days: WeekDay[]
  todayDate: string | undefined
  /** Día que la tarjeta está mostrando; puede no ser hoy. */
  selectedDate?: string
  plans: PlanSummary[]
  activeId: number | null
  objective: string | null
  onSelectDay: (day: WeekDay) => void
  setsByDate?: Record<string, SessionSet[]>
  feedbackByDate?: Record<string, ExerciseFeedbackMap>
  skipsByDate?: Record<string, ExerciseSkipsMap>
  metricsRuns?: CardioRun[]
}) {
  const position = planPosition(plans, activeId)
  const kicker = [position, objective].filter(Boolean).join(' · ')

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <div className="kicker truncate">{kicker || 'Esta semana'}</div>
        <div className="shrink-0 text-xs text-muted-foreground">
          {days.filter((d) => d.status === 'completed').length}/
          {days.filter((d) => d.items.length).length} hechos
        </div>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1">
        {days.map((d) => {
          const isToday = d.date === todayDate
          const isSelected = d.date === (selectedDate ?? todayDate)
          const rest = !d.items.length
          return (
            <button
              key={d.date}
              type="button"
              onClick={() => onSelectDay(d)}
              title={`${d.label}${rest ? '' : ` · ${d.items.length} ej.`}`}
              className={cn(
                'rounded-lg px-0.5 py-1.5 text-center transition-colors hover:bg-muted/50',
                isSelected && 'bg-primary/10 ring-1 ring-primary',
                isToday && !isSelected && 'ring-1 ring-primary/40',
              )}
            >
              <div
                className={cn(
                  'mb-0.5 text-[11px] font-semibold',
                  isSelected || isToday ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                {INITIALS[d.weekday]}
              </div>
              <DayRings
                day={d}
                sets={setsByDate[d.date] ?? []}
                skips={skipsByDate[d.date] ?? {}}
                feedback={feedbackByDate[d.date] ?? {}}
                runs={metricsRuns}
              />
            </button>
          )
        })}
      </div>
      <div className="mt-2.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
        {(
          [
            ['warmup', 'Calentamiento'],
            ['cardio', 'Cardio'],
            ['strength', 'Fuerza'],
          ] as const
        ).map(([id, label]) => (
          <span key={id} className="inline-flex items-center gap-1">
            <span
              className="size-1.5 rounded-full"
              style={{ background: RING_COLOR[id] }}
            />
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}
