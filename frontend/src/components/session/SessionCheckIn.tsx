import { CompactScaleBar } from '@/components/session/CompactScaleBar'
import {
  DEFAULT_ENERGY,
  DEFAULT_HEALTH,
  DEFAULT_MOOD,
  ENERGY_SCALE,
  HEALTH_SCALE,
  MOOD_SCALE,
  scaleIndex,
  type EnergyId,
  type HealthId,
  type MoodId,
} from '@/lib/sessionCheckIn'

/** Ánimo / salud / energía: barras con «bien» a la izquierda (default).
 *  Solo se toca cuando algo va mal. */
export function SessionCheckIn({
  mood,
  health,
  energy,
  onMood,
  onHealth,
  onEnergy,
}: {
  mood: MoodId | null
  health: HealthId | null
  energy: EnergyId | null
  onMood: (v: MoodId) => void
  onHealth: (v: HealthId) => void
  onEnergy: (v: EnergyId) => void
}) {
  const moodI = scaleIndex(MOOD_SCALE, mood, DEFAULT_MOOD)
  const healthI = scaleIndex(HEALTH_SCALE, health, DEFAULT_HEALTH)
  const energyI = scaleIndex(ENERGY_SCALE, energy, DEFAULT_ENERGY)

  return (
    <div className="space-y-1.5">
      <CompactScaleBar
        id="checkin-mood"
        label="Ánimo"
        value={moodI}
        max={MOOD_SCALE.length - 1}
        valueLabel={MOOD_SCALE[moodI]!.label}
        onChange={(i) => onMood(MOOD_SCALE[i]!.id)}
      />
      <CompactScaleBar
        id="checkin-health"
        label="Salud"
        value={healthI}
        max={HEALTH_SCALE.length - 1}
        valueLabel={HEALTH_SCALE[healthI]!.label}
        onChange={(i) => onHealth(HEALTH_SCALE[i]!.id)}
      />
      <CompactScaleBar
        id="checkin-energy"
        label="Energía"
        value={energyI}
        max={ENERGY_SCALE.length - 1}
        valueLabel={ENERGY_SCALE[energyI]!.label}
        onChange={(i) => onEnergy(ENERGY_SCALE[i]!.id)}
      />
    </div>
  )
}
