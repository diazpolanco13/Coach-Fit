export const MUSCLE_ES: Record<string, string> = {
  pectorals: 'Pecho',
  chest: 'Pecho',
  delts: 'Hombros',
  deltoids: 'Hombros',
  shoulders: 'Hombros',
  rhomboids: 'Romboides',
  back: 'Espalda',
  triceps: 'Tríceps',
  biceps: 'Bíceps',
  forearms: 'Antebrazos',
  lats: 'Dorsales',
  'upper back': 'Espalda alta',
  'lower back': 'Lumbar',
  traps: 'Trapecios',
  trapezius: 'Trapecios',
  glutes: 'Glúteos',
  quads: 'Cuádriceps',
  quadriceps: 'Cuádriceps',
  hamstrings: 'Isquios',
  calves: 'Gemelos',
  abs: 'Abdomen',
  core: 'Core',
  obliques: 'Oblicuos',
  'hip flexors': 'Flexores de cadera',
  'cardiovascular system': 'Cardio',
  // Añadidos con el catálogo completo (1324 ejercicios): el dataset usa 19
  // músculos objetivo y 40 secundarios, bastantes más que la selección de 41.
  spine: 'Lumbar',
  adductors: 'Aductores',
  abductors: 'Abductores',
  'inner thighs': 'Aductores',
  'serratus anterior': 'Serrato',
  'levator scapulae': 'Elevador escapular',
  abdominals: 'Abdomen',
  'lower abs': 'Abdomen bajo',
  'upper chest': 'Pecho superior',
  'latissimus dorsi': 'Dorsales',
  'rear deltoids': 'Deltoides posterior',
  'rotator cuff': 'Manguito rotador',
  brachialis: 'Braquial',
  soleus: 'Sóleo',
  shins: 'Tibiales',
  ankles: 'Tobillos',
  'ankle stabilizers': 'Estabilizadores del tobillo',
  feet: 'Pies',
  hands: 'Manos',
  wrists: 'Muñecas',
  'wrist extensors': 'Extensores de muñeca',
  'wrist flexors': 'Flexores de muñeca',
  'grip muscles': 'Agarre',
  groin: 'Ingle',
  sternocleidomastoid: 'Esternocleidomastoideo',
}

export const muscleES = (m: string) => MUSCLE_ES[m] || m

type MuscleSource = {
  target: string
  secondary_muscles?: string[]
  stimulus?: { muscle: string; role: 'primary' | 'secondary'; weight: number }[]
}

/** Músculos que aportan al radar (primario + secundarios), en ese orden.
 *  Usa `stimulus` si existe; si no, target + secondary_muscles. */
export function involvedMuscles(ex: MuscleSource): string[] {
  const out: string[] = []
  const push = (raw: string) => {
    const label = muscleES(raw)
    if (label && !out.includes(label)) out.push(label)
  }
  if (ex.stimulus?.length) {
    const primary = ex.stimulus.filter((s) => s.role === 'primary').sort((a, b) => b.weight - a.weight)
    const secondary = ex.stimulus
      .filter((s) => s.role === 'secondary')
      .sort((a, b) => b.weight - a.weight)
    for (const s of primary) push(s.muscle)
    for (const s of secondary) push(s.muscle)
    return out
  }
  if (ex.target) push(ex.target)
  for (const m of ex.secondary_muscles ?? []) push(m)
  return out
}

/** Orden anatómico de arriba hacia abajo. Las listas de avance no deben
 *  reordenarse al cambiar de día: el naranja se mueve, las filas no. */
export const MUSCLE_BODY_ORDER: readonly string[] = [
  'Esternocleidomastoideo',
  'Trapecios',
  'Elevador escapular',
  'Pecho',
  'Pecho superior',
  'Hombros',
  'Deltoides posterior',
  'Manguito rotador',
  'Dorsales',
  'Espalda alta',
  'Romboides',
  'Espalda',
  'Serrato',
  'Bíceps',
  'Braquial',
  'Tríceps',
  'Antebrazos',
  'Extensores de muñeca',
  'Flexores de muñeca',
  'Muñecas',
  'Agarre',
  'Manos',
  'Lumbar',
  'Core',
  'Abdomen',
  'Abdomen bajo',
  'Oblicuos',
  'Glúteos',
  'Flexores de cadera',
  'Cuádriceps',
  'Isquios',
  'Aductores',
  'Abductores',
  'Ingle',
  'Gemelos',
  'Sóleo',
  'Tibiales',
  'Tobillos',
  'Estabilizadores del tobillo',
  'Pies',
  'Cardio',
] as const

const BODY_RANK = new Map(MUSCLE_BODY_ORDER.map((label, i) => [label, i]))

/** Índice anatómico (menor = más arriba). Desconocidos al final, antes de Cardio. */
export function muscleBodyRank(muscle: string): number {
  return BODY_RANK.get(muscle) ?? MUSCLE_BODY_ORDER.length - 1
}

/** Etiquetas únicas y ordenadas, para el selector de músculos prioritarios.
 *  Es la deduplicación de MUSCLE_ES: varios valores del catálogo colapsan a la
 *  misma etiqueta, y la etiqueta es la clave real de los objetivos del plan.
 *
 *  Ojo al renombrar una etiqueta aquí: las prioridades ya guardadas quedarían
 *  huérfanas. `orphanGoals()` las saca a la superficie en el editor. */
export const MUSCLE_LABELS_ES: string[] = [...new Set(Object.values(MUSCLE_ES))].sort((a, b) =>
  a.localeCompare(b, 'es'),
)
