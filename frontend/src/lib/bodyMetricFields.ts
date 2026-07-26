/** Las lecturas de la balanza, definidas una sola vez.
 *
 *  Tres pantallas necesitan la misma lista — el formulario de alta, el editor
 *  del historial y las gráficas de tendencias — y tenerla escrita tres veces
 *  garantiza que un día no coincidan: un campo nuevo aparece en el formulario y
 *  no en la gráfica, o la unidad dice `kg` en un sitio y `%` en otro.
 */
import type { BodyMetricNumericKey } from '@/lib/api'

/** Hacia dónde es «mejor» que vaya la métrica. `null` = ni bien ni mal: el peso
 *  sube en una recomposición y baja en un déficit, y ninguna de las dos cosas es
 *  un logro por sí sola. */
export type Direction = 'up' | 'down' | null

export type BodyField = {
  key: BodyMetricNumericKey
  label: string
  /** Sufijo visible. Vacío en los índices sin unidad (IMC, WHR, visceral). */
  unit: string
  /** Decimales con los que se muestra y se escribe. */
  digits: number
  better: Direction
  /** Texto del input cuando está vacío. Por defecto, la unidad. */
  placeholder?: string
  /** Línea corta bajo el título de la tarjeta de tendencias. */
  hint?: string
}

export type BodyFieldGroup = {
  title: string
  description: string
  /** El grupo que se ve siempre en el formulario; el resto va plegado. */
  primary?: boolean
  fields: BodyField[]
}

/** Las 21 lecturas numéricas que exporta la balanza, agrupadas como se leen:
 *  primero lo que se mira a diario, luego el detalle. */
export const BODY_FIELD_GROUPS: BodyFieldGroup[] = [
  {
    title: 'Lo que se mira a diario',
    description: 'Las seis cifras que aparecen en cada medición del historial.',
    primary: true,
    fields: [
      { key: 'weight_kg', label: 'Peso', unit: 'kg', digits: 2, better: null },
      { key: 'body_fat_pct', label: 'Grasa corporal', unit: '%', digits: 1, better: 'down' },
      { key: 'muscle_pct', label: 'Músculo', unit: '%', digits: 1, better: 'up' },
      { key: 'water_pct', label: 'Agua corporal', unit: '%', digits: 1, better: 'up' },
      {
        key: 'visceral_fat',
        label: 'Grasa visceral',
        unit: '',
        digits: 0,
        better: 'down',
        placeholder: 'Nivel',
        hint: 'Índice de la balanza. Bajo 10 se considera rango normal.',
      },
      { key: 'bmr_kcal', label: 'Tasa metabólica basal', unit: 'kcal', digits: 0, better: null },
    ],
  },
  {
    title: 'Masas en kilos',
    description: 'La misma composición en kg. Separa un cambio real de un cambio de porcentaje por peso.',
    fields: [
      { key: 'fat_mass_kg', label: 'Masa grasa', unit: 'kg', digits: 2, better: 'down' },
      { key: 'muscle_mass_kg', label: 'Masa muscular', unit: 'kg', digits: 2, better: 'up' },
      { key: 'skeletal_muscle_kg', label: 'Masa muscular esquelética', unit: 'kg', digits: 2, better: 'up' },
      { key: 'lean_body_mass_kg', label: 'Peso corporal sin grasa', unit: 'kg', digits: 2, better: 'up' },
      { key: 'protein_mass_kg', label: 'Masa proteica', unit: 'kg', digits: 2, better: 'up' },
      { key: 'water_mass_kg', label: 'Masa de agua corporal', unit: 'kg', digits: 2, better: 'up' },
      { key: 'bone_mass_kg', label: 'Masa ósea', unit: 'kg', digits: 2, better: null },
    ],
  },
  {
    title: 'Porcentajes de detalle',
    description: 'Reparto fino de la composición. Se mueven poco y despacio.',
    fields: [
      { key: 'skeletal_muscle_pct', label: 'Músculo esquelético', unit: '%', digits: 1, better: 'up' },
      { key: 'protein_pct', label: 'Proteína', unit: '%', digits: 1, better: 'up' },
      { key: 'bone_pct', label: 'Óseo', unit: '%', digits: 1, better: null },
      { key: 'subcutaneous_fat_pct', label: 'Grasa subcutánea', unit: '%', digits: 1, better: 'down' },
    ],
  },
  {
    title: 'Índices derivados',
    description: 'Cifras que la balanza calcula a partir del resto y de tu perfil.',
    fields: [
      { key: 'bmi', label: 'IMC', unit: '', digits: 1, better: null },
      { key: 'metabolic_age', label: 'Edad metabólica', unit: 'años', digits: 0, better: 'down' },
      { key: 'whr', label: 'WHR (cintura-cadera)', unit: '', digits: 2, better: 'down' },
      { key: 'optimal_weight_kg', label: 'Peso óptimo', unit: 'kg', digits: 2, better: null },
    ],
  },
]

export const BODY_FIELDS: BodyField[] = BODY_FIELD_GROUPS.flatMap((group) => group.fields)

export const BODY_FIELD_KEYS: BodyMetricNumericKey[] = BODY_FIELDS.map((field) => field.key)

/** Campos de texto de la lectura. La balanza los clasifica ella misma, pero la
 *  tabla los guarda y una lectura escrita a mano puede querer completarlos. */
export const BODY_TEXT_FIELDS = [
  { key: 'weight_level', label: 'Nivel de peso', placeholder: 'Sobrepeso, Normal…' },
  { key: 'body_type', label: 'Tipo de cuerpo', placeholder: 'Ligeramente por encima…' },
] as const

export type BodyTextKey = (typeof BODY_TEXT_FIELDS)[number]['key']

/** El `step` del input sale de los decimales: dos listas que decían lo mismo
 *  eran dos listas que podían discrepar. */
export function stepFor(digits: number): string {
  return digits <= 0 ? '1' : `0.${'0'.repeat(digits - 1)}1`
}

export function placeholderFor(field: BodyField): string {
  return field.placeholder ?? field.unit
}
