import type { Exercise, MuscleCoverageItem, WeekDay, WeekLoad } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { CheckCircle2, Play } from 'lucide-react'
import { CoachPanel } from '@/components/CoachPanel'
import { ExerciseRow } from '@/components/ExerciseRow'
import { MuscleCoveragePanel } from '@/components/MuscleCoveragePanel'
import { StatRow } from '@/components/StatRow'

export function HoyTab({
  load,
  days,
  todayDay,
  planName,
  coverage,
  onOpenExercise,
  onMarkDay,
  onGoRegister,
  onGoTrain,
  onGoFuerza,
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
  /** Con varios planes guardados, saber cuál está corriendo importa. */
  planName: string
  coverage: MuscleCoverageItem[]
  onOpenExercise: (ex: Exercise) => void
  onMarkDay: (day: WeekDay, completed: boolean) => void
  onGoRegister: (day: WeekDay) => void
  onGoTrain: (day: WeekDay) => void
  onGoFuerza: () => void
  coachNotes: string
  onNotesChange: (v: string) => void
  onAsk: () => void
  busy: boolean
  advice: string
  adviceSource: string
}) {
  const trainingDaysPlanned = days.filter((d) => d.items.length > 0).length
  const todayItems = todayDay?.items ?? []

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
            {planName && <p className="text-sm text-muted-foreground">Plan activo: {planName}</p>}

            {todayItems.length ? (
              <div>
                {todayItems.map(
                  (item, i) =>
                    item.exercise && (
                      <ExerciseRow
                        key={`${item.exercise_id}-${i}`}
                        ex={item.exercise}
                        onOpen={onOpenExercise}
                        suffix={`${item.sets}×${item.rep_min}–${item.rep_max}`}
                      />
                    ),
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Día de descanso o sin ejercicios planificados.</p>
            )}

            {todayDay && (
              <div className="flex flex-wrap gap-2 pt-2">
                {!!todayItems.length && (
                  <Button className="gap-2" onClick={() => onGoTrain(todayDay)}>
                    <Play className="size-4" />
                    Empezar entrenamiento
                  </Button>
                )}
                <Button
                  variant={todayItems.length ? 'outline' : 'default'}
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
              <MuscleCoveragePanel groups={coverage} onSeeMore={onGoFuerza} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
