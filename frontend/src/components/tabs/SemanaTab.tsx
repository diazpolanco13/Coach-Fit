import type { Exercise, WeekDay } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { CalendarDays, Play } from 'lucide-react'
import { MediaImg } from '@/components/MediaImg'

export function SemanaTab({
  planName,
  days,
  onOpenExercise,
  onMarkDay,
  onGoRegister,
  onGoTrain,
}: {
  planName: string
  days: WeekDay[]
  onOpenExercise: (ex: Exercise) => void
  onMarkDay: (day: WeekDay, completed: boolean) => void
  onGoRegister: (day: WeekDay) => void
  onGoTrain: (day: WeekDay) => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <CalendarDays className="size-5 text-primary" />
        <h2 className="text-xl font-semibold">{planName}</h2>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {days.map((day) => {
          const isRest = !day.exercises.length
          const thumbs = day.exercises.slice(0, 4)
          const moreCount = day.exercises.length > 4 ? day.exercises.length - 4 : 0
          return (
            <Card key={day.date} className={day.completed ? 'ring-primary/40' : ''}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="kicker">{day.date}</div>
                    <div className="font-heading text-lg font-extrabold">{day.label}</div>
                  </div>
                  {day.completed ? (
                    <Badge variant="brand">Hecho</Badge>
                  ) : (
                    <Badge variant="outline">{isRest ? 'Cardio · descanso' : 'Pendiente'}</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {isRest ? (
                  <p className="text-sm text-muted-foreground">
                    {day.label.toLowerCase().includes('carrera')
                      ? 'Sal a trotar suave 20–30 min.'
                      : 'Recupera: dormir también entrena.'}
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {thumbs.map((ex) => (
                      <button
                        key={ex.id}
                        type="button"
                        onClick={() => onOpenExercise(ex)}
                        className="size-12 overflow-hidden rounded-md border bg-white"
                      >
                        <MediaImg image={ex.image} gif={ex.gif} alt={ex.name_es} className="h-full w-full object-contain" />
                      </button>
                    ))}
                    {moreCount > 0 && (
                      <div className="flex size-12 items-center justify-center rounded-md border text-sm font-medium text-muted-foreground">
                        +{moreCount}
                      </div>
                    )}
                  </div>
                )}
                <div className="text-xs text-muted-foreground">
                  {isRest
                    ? null
                    : `${day.exercises.length} ejercicios${
                        day.volume_kg ? ` · ${Math.round(day.volume_kg)} kg · RPE ${day.session_rpe}` : ' · 3 series por ejercicio'
                      }`}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => onMarkDay(day, !day.completed)}>
                    {day.completed ? 'Desmarcar' : 'Marcar'}
                  </Button>
                  {!!day.exercises.length && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => onGoRegister(day)}>
                        Registrar
                      </Button>
                      <Button size="sm" className="gap-1.5" onClick={() => onGoTrain(day)}>
                        <Play className="size-3.5" />
                        Entrenar
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
