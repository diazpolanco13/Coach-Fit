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
}: {
  days: PlanDay[]
  volumes: MuscleVolume[]
  objective: string | null
  exMap: Map<string, Exercise>
}) {
  const diagnoses = useMemo(
    () => planDiagnosis(days, volumes, objective, exMap),
    [days, volumes, objective, exMap],
  )
  if (!diagnoses.length) return null

  return (
    <div className="space-y-1 border-t border-border px-3 py-2.5 text-xs">
      {diagnoses.map((d) => (
        <p
          key={d.text}
          className={
            d.tone === 'ok'
              ? 'flex items-start gap-1.5 text-emerald-600 dark:text-emerald-400'
              : 'flex items-start gap-1.5 text-amber-600 dark:text-amber-400'
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
