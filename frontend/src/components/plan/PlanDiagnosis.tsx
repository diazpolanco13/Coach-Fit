import { useMemo } from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import type { Exercise, PlanDay } from '@/lib/api'
import { planDiagnosis } from '@/lib/diagnosis'
import type { MuscleVolume } from '@/lib/volume'

export function PlanDiagnosis({
  days,
  volumes,
  objective,
  exMap,
  equipment,
}: {
  days: PlanDay[]
  volumes: MuscleVolume[]
  objective: string | null
  exMap: Map<string, Exercise>
  /** Desajuste con el espacio del plan, si lo hay. */
  equipment?: { gaps: number; gymName: string | null }
}) {
  const diagnoses = useMemo(
    () => planDiagnosis(days, volumes, objective, exMap, equipment),
    [days, volumes, objective, exMap, equipment],
  )
  if (!diagnoses.length) return null

  return (
    <div className="space-y-1 border-t border-border px-3 py-2.5 text-xs">
      {diagnoses.map((d) => (
        <p
          key={d.text}
          className={
            d.tone === 'ok'
              ? 'flex items-start gap-1.5 text-success-strong'
              : 'flex items-start gap-1.5 text-warning-strong'
          }
        >
          {d.tone === 'ok' ? (
            <CheckCircle2 className="mt-px size-3.5 shrink-0" />
          ) : (
            <AlertTriangle className="mt-px size-3.5 shrink-0" />
          )}
          <span>{d.text}</span>
        </p>
      ))}
    </div>
  )
}
