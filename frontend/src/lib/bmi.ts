/** IMC estimado con la altura del perfil.
 *
 *  La balanza manda el IMC en sus propias lecturas, pero una medición escrita a
 *  mano se queda sin él y deja huecos en la gráfica. Con la altura guardada el
 *  hueco se puede rellenar al pintar — sin escribirlo en la base, para no
 *  mezclar lo que midió la balanza con lo que dedujo la app.
 */
import type { BodyMetricPoint } from '@/lib/api'

export function estimateBmi(weightKg: number | null | undefined, heightCm: number | null | undefined): number | null {
  if (weightKg == null || heightCm == null) return null
  if (!Number.isFinite(weightKg) || !Number.isFinite(heightCm) || heightCm <= 0) return null
  const meters = heightCm / 100
  const bmi = weightKg / (meters * meters)
  return Number.isFinite(bmi) ? Number(bmi.toFixed(1)) : null
}

/** Copia del historial con los huecos de IMC rellenos. Solo toca los nulos: un
 *  IMC que vino de la balanza se respeta aunque no cuadre con la altura. */
export function withEstimatedBmi(
  history: BodyMetricPoint[],
  heightCm: number | null | undefined,
): { history: BodyMetricPoint[]; estimated: number } {
  if (heightCm == null) return { history, estimated: 0 }

  let estimated = 0
  const filled = history.map((reading) => {
    if (reading.bmi != null) return reading
    const bmi = estimateBmi(reading.weight_kg, heightCm)
    if (bmi == null) return reading
    estimated += 1
    return { ...reading, bmi }
  })

  return estimated ? { history: filled, estimated } : { history, estimated: 0 }
}

/** Franja de la OMS. Es la que enseña la balanza y la que espera cualquiera que
 *  mire el número. */
export function bmiCategory(bmi: number | null | undefined): string | null {
  if (bmi == null || !Number.isFinite(bmi)) return null
  if (bmi < 18.5) return 'Bajo peso'
  if (bmi < 25) return 'Normal'
  if (bmi < 30) return 'Sobrepeso'
  return 'Obesidad'
}
