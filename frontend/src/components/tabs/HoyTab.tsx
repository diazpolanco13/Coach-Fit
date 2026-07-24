import type { Exercise, MuscleCoverageItem, WeekDay, WeekLoad } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { CheckCircle2 } from 'lucide-react'
import { CoachPanel } from '@/components/CoachPanel'
import { ExerciseRow } from '@/components/ExerciseRow'
import { MuscleCoveragePanel } from '@/components/MuscleCoveragePanel'
import { StatRow } from '@/components/StatRow'

export function HoyTab({
  load,
  days,
  todayDay,
  coverage,
  onOpenExercise,
  onMarkDay,
  onGoRegister,
  onGoDashboard,
  coachNotes,
  onNotesChange,
  onAsk,
  busy,
  advice,
  adviceSource,
}: {
  load: WeekLoad | null
  days: WeekDay[]
  todayDay: WeekDay | undefined
  coverage: MuscleCoverageItem[]
  onOpenExercise: (ex: Exercise) => void
  onMarkDay: (day: WeekDay, completed: boolean) => void
  onGoRegister: (day: WeekDay) => void
  onGoDashboard: () => void
  coachNotes: string
  onNotesChange: (v: string) => void
  onAsk: () => void
  busy: boolean
  advice: string
  adviceSource: string
}) {
  const trainingDaysPlanned = days.filter((d) => d.exercise_ids.length > 0).length

  return (
    <div className="space-y-4">
      {load && (
        <StatRow
          items={[
            { label: 'Días esta semana', value: String(load.training_days), suffix: `/ ${trainingDaysPlanned || 0}` },
            { label: 'Volumen', value: Math.round(load.total_volume_kg).toLocaleString('es'), suffix: 'kg' },
            { label: 'RPE medio', value: load.avg_session_rpe != null ? String(load.avg_session_rpe) : '—' },
            { label: 'Carrera', value: String(load.run_distance_km), suffix: 'km' },
          ]}
        />
      )}

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardContent className="space-y-3 pt-6">
            <div className="kicker">
              {todayDay?.date} · {todayDay?.completed ? 'completado' : 'pendiente'}
            </div>
            <h1 className="text-3xl leading-tight font-heading font-extrabold">{todayDay?.label || 'Hoy'}</h1>

            {todayDay?.exercises?.length ? (
              <div>
                {todayDay.exercises.map((ex) => (
                  <ExerciseRow key={ex.id} ex={ex} onOpen={onOpenExercise} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Día de descanso o sin ejercicios planificados.</p>
            )}

            {todayDay && (
              <div className="flex gap-2 pt-2">
                <Button
                  variant={todayDay.completed ? 'secondary' : 'default'}
                  className="gap-2"
                  onClick={() => onMarkDay(todayDay, !todayDay.completed)}
                >
                  <CheckCircle2 className="size-4" />
                  {todayDay.completed ? 'Desmarcar día' : 'Marcar entrenado'}
                </Button>
                <Button variant="outline" onClick={() => onGoRegister(todayDay)}>
                  Registrar series
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <CoachPanel
            coachNotes={coachNotes}
            onNotesChange={onNotesChange}
            onAsk={onAsk}
            busy={busy}
            advice={advice}
            adviceSource={adviceSource}
          />
          <Card>
            <CardContent className="p-0">
              <MuscleCoveragePanel groups={coverage} onSeeMore={onGoDashboard} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
