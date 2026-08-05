/** Catálogo de cardio de resistencia: kind, superficie e intención de sesión.
 *
 *  Distinto del role `cardio` del catálogo: burpees / mountain climbers siguen
 *  midiendo en series×reps. Solo carrera, caminata, bici, etc. usan `runs`.
 */

import type { Exercise, PlanItem } from '@/lib/api'

export const CARDIO_KINDS = [
  { id: 'caminata', label: 'Caminata' },
  { id: 'carrera_libre', label: 'Carrera libre' },
  { id: 'senderismo', label: 'Senderismo' },
  { id: 'hiit', label: 'HIIT' },
] as const

export const CARDIO_SURFACES = [
  { id: 'aire_libre', label: 'Aire libre' },
  { id: 'caminadora', label: 'Caminadora' },
] as const

/**
 * Intención (`session_type`) por `kind`.
 * IDs estables (API/DB); labels solo UI.
 */
export const CARDIO_SESSION_TYPES = {
  carrera_libre: [
    { id: 'rodaje_suave', label: 'Rodaje suave' },
    { id: 'tempo_umbral', label: 'Tempo / Umbral' },
    { id: 'series_intervalos', label: 'Series / Intervalos' },
    { id: 'fartlek', label: 'Fartlek' },
    { id: 'tirada_larga', label: 'Tirada larga' },
    { id: 'recuperacion', label: 'Recuperación' },
    { id: 'hill_repeats', label: 'Hill repeats / Pendientes' },
    { id: 'prueba_ritmo', label: 'Prueba de ritmo' },
    { id: 'otro', label: 'Otro' },
  ],
  caminata: [
    { id: 'caminata_normal', label: 'Caminata normal' },
    { id: 'caminata_recuperacion', label: 'Caminata de recuperación' },
    { id: 'caminata_pendiente', label: 'Caminata en pendiente' },
    { id: 'caminata_rucking', label: 'Caminata con peso / Rucking' },
    { id: 'otro', label: 'Otro' },
  ],
  senderismo: [
    { id: 'senderismo_normal', label: 'Senderismo normal' },
    { id: 'senderismo_desnivel', label: 'Senderismo con desnivel' },
    { id: 'otro', label: 'Otro' },
  ],
  hiit: [{ id: 'series_intervalos', label: 'Series / Intervalos' }],
} as const

export const CARDIO_SESSION_TYPE_DEFAULTS = {
  carrera_libre: 'rodaje_suave',
  caminata: 'caminata_normal',
  senderismo: 'senderismo_normal',
  hiit: 'series_intervalos',
} as const

export type CardioKind = (typeof CARDIO_KINDS)[number]['id']
export type CardioSurface = (typeof CARDIO_SURFACES)[number]['id']
export type CardioSessionType = (typeof CARDIO_SESSION_TYPES)[CardioKind][number]['id']

export type CardioRun = {
  id: number
  date: string
  exercise_id?: string | null
  kind?: CardioKind | null
  surface?: CardioSurface | null
  session_type?: string | null
  distance_km: number
  duration_min?: number
  pace_min_per_km?: number
  rpe?: number | null
  notes?: string | null
}

export const CARDIO_NOTES_MAX = 280

/** Metcons del catálogo con role=cardio que siguen midiendo en series. */
const METCON_RE =
  /\b(burpee|climber|jack|hop|jump|crawl|swing|tijera|salto|astride|skater|oso|empuje a carrera|rueda carrera|short stride|rodilla|espalda y adelante|ski escalon|star salto|semi sentadilla|ski.?erg)\b/i

/** Metcons / máquinas que no aportan hard sets musculares (solo eje Cardio). */
const MUSCLE_NEUTRAL_METCON_RE =
  /\b(ski.?erg|astride|puente\s*-\s*escalador|mountain.?climber|escalador cruce)\b/i

export function isEnduranceCardio(
  ex: Pick<Exercise, 'role' | 'name_es' | 'name' | 'equipment'> | null | undefined,
): boolean {
  if (!ex || ex.role !== 'cardio') return false
  const blob = `${ex.name_es} ${ex.name} ${ex.equipment}`
  return !METCON_RE.test(blob)
}

/** Estiramiento pasivo por nombre (catálogo viejo sin counts_as_hypertrophy). */
export function isPassiveStretch(
  ex: Pick<Exercise, 'name_es' | 'name' | 'counts_as_hypertrophy'> | null | undefined,
): boolean {
  if (!ex) return false
  if (ex.counts_as_hypertrophy === false) return true
  const blob = `${ex.name_es} ${ex.name}`.toLowerCase()
  return /\b(stretch|estiramiento)\b/.test(blob)
}

/** Ski erg, jumps, escaladores: series de sesión sí, hipertrofia muscular no. */
export function isMuscleNeutralMetcon(
  ex: Pick<Exercise, 'name_es' | 'name' | 'id'> | null | undefined,
): boolean {
  if (!ex) return false
  const blob = `${ex.id} ${ex.name_es} ${ex.name}`
  return MUSCLE_NEUTRAL_METCON_RE.test(blob)
}

/** ¿Aporta hard sets a músculos (no solo eje Cardio)? */
export function contributesMuscleHypertrophy(
  ex: Pick<Exercise, 'name_es' | 'name' | 'counts_as_hypertrophy' | 'role' | 'equipment' | 'id'> | null | undefined,
): boolean {
  if (!ex) return false
  if (ex.counts_as_hypertrophy === false) return false
  if (isPassiveStretch(ex)) return false
  if (isMuscleNeutralMetcon(ex)) return false
  return true
}

export function isEnduranceCardioItem(item: Pick<PlanItem, 'exercise' | 'cardio_kind'>): boolean {
  if (item.cardio_kind) return true
  return isEnduranceCardio(item.exercise)
}

export function inferCardioKind(ex: Pick<Exercise, 'name_es' | 'name'>): CardioKind {
  const n = `${ex.name_es} ${ex.name}`.toLowerCase()
  if (/caminata|walk|elliptical|stepmill/.test(n)) return 'caminata'
  if (/senderismo|hike|trail/.test(n)) return 'senderismo'
  if (/hiit|interval/.test(n)) return 'hiit'
  return 'carrera_libre'
}

export function inferCardioSurface(
  ex: Pick<Exercise, 'id' | 'name_es' | 'name' | 'equipment'>,
): CardioSurface {
  const blob = `${ex.id} ${ex.name_es} ${ex.name} ${ex.equipment}`.toLowerCase()
  if (/treadmill|elliptical|stepmill|stationary|bike|bicicleta|equipment|0684|3666|2141|2311|0798|2138|2331/.test(blob)) {
    return 'caminadora'
  }
  return 'aire_libre'
}

export function defaultSessionType(kind: CardioKind): CardioSessionType {
  return CARDIO_SESSION_TYPE_DEFAULTS[kind]
}

export function sessionTypesFor(kind: CardioKind) {
  return CARDIO_SESSION_TYPES[kind]
}

/** Prescripción al añadir cardio del catálogo al plan. */
export function defaultCardioPlanFields(ex: Exercise): Pick<
  PlanItem,
  'sets' | 'rep_min' | 'rep_max' | 'rest_seconds' | 'cardio_kind' | 'cardio_surface' | 'session_type' | 'target_km' | 'target_min'
> {
  const kind = inferCardioKind(ex)
  return {
    sets: 1,
    rep_min: 1,
    rep_max: 1,
    rest_seconds: null,
    cardio_kind: kind,
    cardio_surface: inferCardioSurface(ex),
    session_type: defaultSessionType(kind),
    target_km: null,
    target_min: null,
  }
}

export function formatCardioPrescription(
  item: Pick<PlanItem, 'cardio_kind' | 'cardio_surface' | 'session_type' | 'target_km' | 'target_min' | 'exercise'>,
): string {
  const kind = item.cardio_kind ?? (item.exercise ? inferCardioKind(item.exercise) : null)
  const parts = [
    cardioKindLabel(kind),
    cardioSessionTypeLabel(kind, item.session_type) || null,
    cardioSurfaceLabel(item.cardio_surface) || null,
    item.target_km != null ? `${item.target_km} km` : null,
    item.target_min != null ? `${item.target_min} min` : null,
  ].filter(Boolean)
  return parts.join(' · ') || 'Cardio'
}

export function formatCardioDone(run: Pick<CardioRun, 'kind' | 'session_type' | 'surface' | 'distance_km' | 'duration_min' | 'pace_min_per_km'>): string {
  const parts = [
    cardioKindLabel(run.kind),
    cardioSessionTypeLabel(run.kind, run.session_type) || null,
    `${run.distance_km} km`,
    run.duration_min != null ? `${run.duration_min} min` : null,
    run.pace_min_per_km != null ? `${formatPace(run.pace_min_per_km)} /km` : null,
  ].filter(Boolean)
  return parts.join(' · ')
}

export function runForExercise(
  runs: CardioRun[],
  date: string,
  exerciseId: string,
): CardioRun | undefined {
  return runs.find((r) => r.date === date && r.exercise_id === exerciseId)
}

export function cardioKindLabel(kind?: string | null): string {
  return CARDIO_KINDS.find((k) => k.id === kind)?.label ?? 'Cardio'
}

export function cardioSurfaceLabel(surface?: string | null): string {
  return CARDIO_SURFACES.find((s) => s.id === surface)?.label ?? ''
}

export function cardioSessionTypeLabel(kind?: string | null, sessionType?: string | null): string {
  if (!sessionType) return ''
  if (kind && kind in CARDIO_SESSION_TYPES) {
    const opts = CARDIO_SESSION_TYPES[kind as CardioKind]
    const hit = opts.find((o) => o.id === sessionType)
    if (hit) return hit.label
  }
  for (const opts of Object.values(CARDIO_SESSION_TYPES)) {
    const hit = opts.find((o) => o.id === sessionType)
    if (hit) return hit.label
  }
  return sessionType
}

/** min/km decimal → "5:42" */
export function formatPace(minPerKm: number): string {
  const totalSec = Math.round(minPerKm * 60)
  const m = Math.floor(totalSec / 60)
  const s = Math.abs(totalSec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Contexto al abrir la ficha desde un ítem del plan (o un run). */
export type CardioGuideContext = {
  kind?: CardioKind | null
  session_type?: string | null
  surface?: CardioSurface | null
  target_km?: number | null
  target_min?: number | null
  notes?: string | null
}

/** Guías por intención. Sustituyen el texto genérico del catálogo («trotar en el lugar»). */
const CARDIO_GUIDES: Record<string, string[]> = {
  rodaje_suave: [
    'Calienta 5 minutos andando o trotando muy suave hasta que la respiración se active.',
    'Corre a ritmo conversacional: podrías hablar en frases cortas sin jadear. Si no, baja el ritmo.',
    'Mantén postura erguida, mirada al frente y cadencia relajada; aterriza debajo de la cadera.',
    'Si el plan indica distancia o tiempo, cúmplelo sin acelerar al final: el objetivo es acumular kilómetros fáciles.',
    'Enfría 3–5 minutos caminando y estira suave gemelos, isquios y cadera.',
  ],
  tempo_umbral: [
    'Calienta 8–10 minutos suave hasta sudar un poco; no empieces frío al ritmo tempo.',
    'El tramo tempo es «cómodamente duro»: respiración exigente, pero sostenible 15–25 minutos sin sprint.',
    'Controla el ritmo desde el primer minuto; si sales demasiado rápido, el final se rompe.',
    'Entre bloques (si hay), recupera trotando muy fácil o caminando hasta bajar el pulso.',
    'Termina con 5 minutos de trote suave o caminata. Anota cómo se sintió el ritmo para la próxima.',
  ],
  series_intervalos: [
    'Calienta 10 minutos fácil + 2–3 aceleraciones cortas (strides) de 15–20 s con recuperación total.',
    'Cada serie: acelera con intención (más rápido que el ritmo de 5K o según la nota del plan) y mantén la forma.',
    'Entre series recupera el tiempo indicado (caminando o trote muy suave). La recuperación cuenta: no la acortes.',
    'Si no puedes completar la serie con técnica decente, alarga la recuperación o baja un poco la intensidad.',
    'Tras la última serie, enfría 5–8 minutos fácil. Bebe agua y anota sensaciones / RPE.',
  ],
  fartlek: [
    'Sal a ritmo fácil 8–10 minutos. El fartlek mezcla cambios de ritmo «a sensación», no a cronómetro rígido.',
    'Alterna tramos más vivos (hasta un árbol, una farola, 30–90 s) con tramos suaves de recuperación.',
    'Los tramos fuertes no son sprint a muerte: ritmo alegre que puedas repetir varias veces.',
    'Juega con el terreno (subidas cortas, rectas). Escucha el cuerpo más que el reloj.',
    'Cierra con 5 minutos muy suaves. Debe dejarte fatigado pero no destrozado.',
  ],
  tirada_larga: [
    'Empieza más lento de lo que crees: los primeros km son calentamiento de la tirada.',
    'Ritmo conversacional o apenas por encima. Hidrátate si pasas de 40–45 minutos.',
    'Rompe mentalmente la distancia en tramos (p. ej. cada km o cada 10 min) sin acelerar «porque ya queda poco».',
    'Si hace falta, inserta 1 minuto caminando cada cierto tiempo; terminar es más importante que el ego.',
    'Enfría caminando y come/bebe algo en la hora siguiente. Anota km, tiempo y cómo te sentiste.',
  ],
  recuperacion: [
    'Esto no es entrenamiento duro: el objetivo es moverse y favorecer la recuperación.',
    'Trote muy suave o caminata viva; si dudas, camina. La respiración debe ser cómoda todo el rato.',
    'Duración corta o media según el plan; no alargues «porque te sientes bien».',
    'Evita cuestas exigentes y cambios de ritmo. Relaja hombros y brazos.',
    'Al terminar deberías sentirte mejor que al empezar, no más castigado.',
  ],
  hill_repeats: [
    'Calienta 10 minutos en llano. Busca una cuesta moderada (no un muro) donde puedas subir corriendo.',
    'Sube con zancada corta, tronco ligeramente inclinado y brazos activos. No mires los pies.',
    'Baja caminando o trotando muy suave: la bajada es recuperación, no otra serie.',
    'Repite el número de series del plan. Si la forma se rompe, para o acorta la cuesta.',
    'Enfría 5–8 minutos en llano. Estira flexores de cadera y gemelos.',
  ],
  prueba_ritmo: [
    'Descansa bien el día previo. Calienta 10–15 min suave + 2 strides cortos.',
    'La prueba es a ritmo de objetivo (p. ej. ritmo 5K): constante desde el primer km, sin salida disparada.',
    'Divide mentalmente la distancia; revisa el ritmo al km 1–2 y ajústalo si vas pasado.',
    'Mantén técnica aunque duela al final: cadencia y postura antes que «esprintar destrozado».',
    'Anota tiempo total, ritmo medio y sensaciones. Enfría 5–10 minutos caminando.',
  ],
  caminata_normal: [
    'Camina a paso firme y natural. Postura erguida, brazos sueltos.',
    'Ritmo en el que puedas conversar con comodidad. Usa el tiempo o km del plan como tope.',
    'En pendiente, acorta el paso; no fuerces zancadas largas.',
    'Si usas caminadora, 0–3 % de inclinación suele bastar para una caminata normal.',
    'Termina relajando gemelos y cadera 1–2 minutos.',
  ],
  caminata_recuperacion: [
    'Paseo fácil: prioridad recuperación, no quemar calorías.',
    'Ritmo lento-moderado, terreno preferiblemente llano. Puedes parar a estirar si quieres.',
    'Respira por la nariz si te sale natural; no busques fatiga.',
    'Duración según plan; si estás muy cargado, acorta o sustitúyelo por descanso total.',
    'Al acabar deberías sentirte suelto, no cansado.',
  ],
  caminata_pendiente: [
    'Elige cuesta moderada o inclinación 4–8 % en caminadora.',
    'Paso corto, apoyo completo del pie, sin inclinarte en exceso sobre la barra.',
    'Mantén ritmo sostenible; las manos ayudan el balanceo, no tiran del cuerpo.',
    'Baja o reduce inclinación si aparecen dolor de gemelos o lumbar.',
    'Enfría 3–5 minutos en llano.',
  ],
  caminata_rucking: [
    'Usa mochila o chaleco bien ceñido; el peso cerca del tronco, no colgando.',
    'Empieza con carga moderada (p. ej. 5–10 % del peso corporal) y paso firme.',
    'Postura alta: evita arquear la lumbar. En cuestas, acorta zancada.',
    'Si el peso te obliga a inclinarte o cojear, bájalos. Calidad > kilos.',
    'Al terminar, estira flexores y espalda; anota carga y km.',
  ],
  senderismo_normal: [
    'Calzado con buen agarre. Ritmo de caminata sostenida, no carrera.',
    'Usa bastones si el terreno lo pide. Bebe agua en rutas largas.',
    'En bajadas controla la velocidad; no frenes solo de talón.',
    'Respeta el desnivel del plan: el tiempo importa más que «correr el sendero».',
    'Al acabar, revisa pies (rozaduras) y estira cadera/gemelos.',
  ],
  senderismo_desnivel: [
    'Prioriza el desnivel positivo: subidas constantes con paso corto y respiración rítmica.',
    'En bajadas técnicas, flexiona rodillas y baja el centro de gravedad; no corras si no dominas el terreno.',
    'Descansa brevemente en miradores si sube el pulso demasiado; no es una carrera.',
    'Hidratación y snack ligero si pasas de ~60 minutos.',
    'Anota desnivel aproximado y cómo se sintieron rodillas/tobillos.',
  ],
  otro: [
    'Define antes el objetivo de esta sesión (fácil, fuerte, técnica) y ajústate a la nota del plan.',
    'Calienta 5–10 minutos suaves hasta activar respiración y articulaciones.',
    'Ejecuta el bloque principal con buena forma; si la técnica falla, baja intensidad.',
    'Respeta distancia/tiempo prescritos; no improvises un segundo bloque duro.',
    'Enfría y anota qué hiciste para poder repetirlo o ajustarlo la próxima semana.',
  ],
}

const GENERIC_RUN_GUIDE = [
  'Calienta 5–10 minutos andando o trotando suave hasta notar el cuerpo listo.',
  'Corre con postura erguida y ritmo adecuado al objetivo del día (fácil, tempo o series).',
  'Si el plan indica intención (rodaje, intervalos, tirada…), síguela: no todas las carreras son iguales.',
  'Escucha el cuerpo: dolor agudo → para; fatiga normal de entrenamiento → ajusta ritmo, no abandones a la ligera.',
  'Enfría caminando unos minutos y anota km, tiempo y sensaciones.',
]

export function cardioGuideSteps(ctx?: CardioGuideContext | null): string[] {
  const session = ctx?.session_type || (ctx?.kind ? defaultSessionType(ctx.kind) : null)
  const base = (session && CARDIO_GUIDES[session]) || GENERIC_RUN_GUIDE
  const steps = [...base]
  const extras: string[] = []
  if (ctx?.surface === 'caminadora') {
    extras.push(
      'En caminadora: no te cuelgues de la consola; mira al frente. Empieza sin inclinación y súbela solo si el plan lo pide.',
    )
  } else if (ctx?.surface === 'aire_libre') {
    extras.push('Al aire libre: elige ruta segura y visible; adapta el ritmo al viento y al terreno.')
  }
  if (ctx?.target_km != null || ctx?.target_min != null) {
    const bits = [
      ctx.target_km != null ? `${ctx.target_km} km` : null,
      ctx.target_min != null ? `${ctx.target_min} min` : null,
    ].filter(Boolean)
    extras.push(`Objetivo de esta sesión: ${bits.join(' / ')}.`)
  }
  if (ctx?.notes?.trim()) {
    extras.push(`Nota del plan: ${ctx.notes.trim()}`)
  }
  return extras.length ? [...steps, ...extras] : steps
}

export function cardioGuideTitle(ctx?: CardioGuideContext | null, fallback = 'Cardio'): string {
  const kind = cardioKindLabel(ctx?.kind)
  const intent = cardioSessionTypeLabel(ctx?.kind, ctx?.session_type)
  if (intent) return `${kind} · ${intent}`
  if (ctx?.kind) return kind
  return fallback
}

