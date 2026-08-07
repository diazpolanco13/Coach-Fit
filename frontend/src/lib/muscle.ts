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

/**
 * Color fijo por etiqueta ES (misma clave que `muscleES` / objetivos).
 * Misma clase para primario y secundario: la señal es «aparece en el día».
 * Tonos por zona anatómica para distinguir al escanear sin chocar vecinos.
 */
const MUSCLE_TONE: Record<string, string> = {
  Esternocleidomastoideo: 'text-stone-700 dark:text-stone-300',
  Trapecios: 'text-violet-700 dark:text-violet-400',
  'Elevador escapular': 'text-violet-600 dark:text-violet-300',
  Pecho: 'text-rose-700 dark:text-rose-400',
  'Pecho superior': 'text-rose-600 dark:text-rose-300',
  Hombros: 'text-amber-700 dark:text-amber-400',
  'Deltoides posterior': 'text-orange-700 dark:text-orange-400',
  'Manguito rotador': 'text-orange-600 dark:text-orange-300',
  Dorsales: 'text-blue-700 dark:text-blue-400',
  'Espalda alta': 'text-sky-700 dark:text-sky-400',
  Romboides: 'text-sky-600 dark:text-sky-300',
  Espalda: 'text-indigo-700 dark:text-indigo-400',
  Serrato: 'text-indigo-600 dark:text-indigo-300',
  Bíceps: 'text-cyan-700 dark:text-cyan-400',
  Braquial: 'text-cyan-600 dark:text-cyan-300',
  Tríceps: 'text-fuchsia-700 dark:text-fuchsia-400',
  Antebrazos: 'text-pink-700 dark:text-pink-400',
  'Extensores de muñeca': 'text-pink-600 dark:text-pink-300',
  'Flexores de muñeca': 'text-pink-600 dark:text-pink-300',
  Muñecas: 'text-pink-500 dark:text-pink-300',
  Agarre: 'text-pink-500 dark:text-pink-300',
  Manos: 'text-pink-500 dark:text-pink-300',
  Lumbar: 'text-yellow-700 dark:text-yellow-400',
  Core: 'text-lime-700 dark:text-lime-400',
  Abdomen: 'text-lime-600 dark:text-lime-300',
  'Abdomen bajo': 'text-lime-600 dark:text-lime-300',
  Oblicuos: 'text-lime-700 dark:text-lime-400',
  Glúteos: 'text-emerald-700 dark:text-emerald-400',
  'Flexores de cadera': 'text-emerald-600 dark:text-emerald-300',
  Cuádriceps: 'text-teal-700 dark:text-teal-400',
  Isquios: 'text-green-700 dark:text-green-400',
  Aductores: 'text-teal-600 dark:text-teal-300',
  Abductores: 'text-green-600 dark:text-green-300',
  Ingle: 'text-teal-600 dark:text-teal-300',
  Gemelos: 'text-emerald-600 dark:text-emerald-300',
  Sóleo: 'text-emerald-600 dark:text-emerald-300',
  Tibiales: 'text-green-600 dark:text-green-300',
  Tobillos: 'text-green-600 dark:text-green-300',
  'Estabilizadores del tobillo': 'text-green-600 dark:text-green-300',
  Pies: 'text-green-600 dark:text-green-300',
  Cardio: 'text-amber-600 dark:text-amber-300',
}

/** Clase Tailwind de color para una etiqueta de músculo en español. */
export function muscleToneClass(label: string): string {
  return MUSCLE_TONE[label] ?? 'text-muted-foreground'
}
