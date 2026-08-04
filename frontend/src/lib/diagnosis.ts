import type { Exercise, PlanDay } from '@/lib/api'
import { resolveSection } from '@/lib/plan'
import { dayOrderConflicts } from '@/lib/sessionSafety'
import type { MuscleVolume } from '@/lib/volume'

export type Diagnosis = { tone: 'ok' | 'aviso'; text: string }

/** Ratio empuje/tirón que se considera equilibrado. Fuera de esta horquilla el
 *  plan está sesgado lo bastante como para avisar. */
const PUSH_PULL_MIN = 0.6
const PUSH_PULL_MAX = 1.7

const MAX_DIAGNOSES = 2

/** Lectura en una línea de si el plan es integral o está sesgado.
 *
 *  Todo se calcula en cliente con datos que ya están en pantalla: los roles
 *  vienen del catálogo y el volumen del panel. */
export function planDiagnosis(
  days: PlanDay[],
  volumes: MuscleVolume[],
  objective: string | null,
  exMap: Map<string, Exercise>,
  /** Ejercicios que el material del espacio del plan no permite, y el nombre
   *  del espacio. Va primero que cualquier otro aviso: un plan equilibradisimo
   *  que no puedes ejecutar donde entrenas es peor que uno sesgado. */
  equipment?: { gaps: number; gymName: string | null },
): Diagnosis[] {
  const byRole: Record<string, number> = { push: 0, pull: 0, legs: 0, core: 0, cardio: 0 }
  for (const day of days) {
    for (const item of day.items) {
      // El calentamiento no entra en el balance empuje/tirón ni en los avisos
      // de patrón: son estiramientos / activación, no el trabajo del día.
      if (resolveSection(item) === 'warmup') continue
      const ex = item.exercise ?? exMap.get(item.exercise_id)
      if (!ex) continue
      if (ex.role in byRole) byRole[ex.role] += item.sets
    }
  }
  const total = Object.values(byRole).reduce((a, b) => a + b, 0)
  if (!total) return []

  const programmed = new Set(volumes.filter((v) => v.programmed).map((v) => v.muscle))
  const out: Diagnosis[] = []
  const warn = (text: string) => out.length < MAX_DIAGNOSES && out.push({ tone: 'aviso', text })
  if (equipment && equipment.gaps > 0) {
    const where = equipment.gymName ? ` en ${equipment.gymName}` : ''
    warn(
      equipment.gaps === 1
        ? `1 ejercicio pide equipo que no hay${where}.`
        : `${equipment.gaps} ejercicios piden equipo que no hay${where}.`,
    )
  }
  const orderConflicts = days.reduce((n, day) => n + dayOrderConflicts(day, exMap).length, 0)
  if (orderConflicts > 0) {
    warn(
      orderConflicts === 1
        ? 'Hay 1 combinación de orden con riesgo de estabilizadores.'
        : `Hay ${orderConflicts} combinaciones de orden con riesgo de estabilizadores.`,
    )
  }

  // 1. Patrón ausente por completo.
  if (byRole.pull === 0 && byRole.push > 0) warn('Falta trabajo de tirón: sin dorsales ni espalda.')
  else if (byRole.push === 0 && byRole.pull > 0) warn('Falta trabajo de empuje: sin pecho ni hombros.')
  // 2. Desequilibrio de ratio.
  else if (byRole.push > 0 && byRole.pull > 0) {
    const ratio = byRole.push / byRole.pull
    if (ratio > PUSH_PULL_MAX)
      warn(`Demasiado empuje frente a tirón (${byRole.push} vs ${byRole.pull} series).`)
    else if (ratio < PUSH_PULL_MIN)
      warn(`Demasiado tirón frente a empuje (${byRole.pull} vs ${byRole.push} series).`)
  }

  // 3. Tren inferior.
  if (byRole.legs === 0) warn('Tren inferior sin trabajo.')
  else if (programmed.has('Cuádriceps') && !programmed.has('Isquios') && !programmed.has('Glúteos'))
    warn('Tren inferior incompleto: cuádriceps sin isquios ni glúteos.')

  // 4. Contradicción con la intención declarada.
  if (objective === 'Enfoque torso' && byRole.legs / total > 0.3)
    warn('Más piernas de las que pide un enfoque torso.')
  if (objective === 'Enfoque piernas' && byRole.legs / total < 0.45)
    warn('Pocas piernas para un enfoque de tren inferior.')
  if (objective === 'Carrera 10k' && byRole.cardio === 0)
    warn('Objetivo de carrera sin ninguna sesión de cardio programada.')

  // 5. Huecos de región dentro de un grupo que sí está programado.
  for (const v of volumes) {
    if (!v.programmed || !v.regions.length) continue
    if (v.muscle === 'Pecho') {
      const labels = new Set(v.regions.map((r) => r.region))
      if (!labels.has('superior')) warn('Pecho sin trabajo de porción superior.')
    } else if (v.muscle === 'Abdomen') {
      const labels = new Set(v.regions.map((r) => r.region))
      if (
        (labels.has('superior') || labels.has('inferior') || labels.has('oblicuos')) &&
        !labels.has('anti-extensión')
      ) {
        warn('Abdomen sin anti-extensión (plancha / rueda).')
      }
    } else if (v.muscle === 'Hombros') {
      const labels = new Set(v.regions.map((r) => r.region))
      if (labels.has('anterior') && !labels.has('posterior'))
        warn('Hombros: mucho anterior sin trabajo posterior.')
    }
  }

  return out.length ? out : [{ tone: 'ok', text: 'Plan integral: todos los patrones cubiertos.' }]
}
