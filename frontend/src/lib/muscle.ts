export function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

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

/** Etiquetas únicas y ordenadas, para el selector de músculos prioritarios.
 *  Es la deduplicación de MUSCLE_ES: varios valores del catálogo colapsan a la
 *  misma etiqueta, y la etiqueta es la clave real de los objetivos del plan.
 *
 *  Ojo al renombrar una etiqueta aquí: las prioridades ya guardadas quedarían
 *  huérfanas. `orphanGoals()` las saca a la superficie en el editor. */
export const MUSCLE_LABELS_ES: string[] = [...new Set(Object.values(MUSCLE_ES))].sort((a, b) =>
  a.localeCompare(b, 'es'),
)
