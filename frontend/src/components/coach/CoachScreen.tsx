import { CoachPanel } from '@/components/CoachPanel'
import { daysSince, freshnessLabel } from '@/lib/hoy'

/** El coach vive aquí y no en Hoy porque su trabajo es proponer LA SEMANA, que
 *  es planificación, no «qué hago ahora». En Hoy además engañaba: la propuesta
 *  es una foto congelada en `coach_notes` y sus cifras contradecían al contador
 *  de la semana que tenía justo encima, sin nada que avisara de que estaba
 *  vieja. De ahí que la antigüedad se muestre siempre. */
export function CoachScreen({
  coachNotes,
  onNotesChange,
  onAsk,
  busy,
  advice,
  adviceSource,
  adviceCreatedAt,
}: {
  coachNotes: string
  onNotesChange: (v: string) => void
  onAsk: () => void
  busy: boolean
  advice: string
  adviceSource: string
  adviceCreatedAt?: string
}) {
  const freshness = advice ? freshnessLabel(daysSince(adviceCreatedAt)) : null

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-3xl leading-tight font-extrabold">Coach</h1>
        <p className="text-sm text-muted-foreground">
          Propone la semana a partir de tu carga, tu material y tus planes guardados.
        </p>
      </div>
      <CoachPanel
        coachNotes={coachNotes}
        onNotesChange={onNotesChange}
        onAsk={onAsk}
        busy={busy}
        advice={advice}
        adviceSource={adviceSource}
        freshness={freshness}
      />
    </div>
  )
}
