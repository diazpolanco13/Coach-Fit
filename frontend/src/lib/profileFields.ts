/** Los campos del perfil: qué se pide, cómo se pinta y cómo se convierte en
 *  payload. Fuera del componente para que la pantalla se ocupe solo de la vista.
 *
 *  Las validaciones de verdad viven en el servidor (`UserProfileIn`). Aquí solo
 *  hay pistas de formato: duplicar las reglas en el cliente garantizaría que un
 *  día discrepen y que algo válido se rechace antes de salir.
 */
import type { UserProfile, UserProfileFields, UserProfileInput } from '@/lib/api'

export type ProfileFieldKey = keyof UserProfileFields

type Option = { value: string; label: string }

export type ProfileFieldDef = {
  key: ProfileFieldKey
  label: string
  hint?: string
  placeholder?: string
  /** Ocupa la fila entera. */
  wide?: boolean
} & (
  | { kind: 'text' | 'email' | 'tel' | 'date' | 'time'; inputMode?: 'text' | 'numeric' | 'tel'; step?: never }
  | { kind: 'number'; inputMode?: 'numeric' | 'decimal'; step?: string }
  | { kind: 'select'; options: Option[]; inputMode?: never; step?: never }
)

export const SEX_OPTIONS: Option[] = [
  { value: 'masculino', label: 'Masculino' },
  { value: 'femenino', label: 'Femenino' },
  { value: 'otro', label: 'Otro' },
]

export const CHANNEL_OPTIONS: Option[] = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'ninguno', label: 'Ninguno' },
]

export const ACTIVITY_OPTIONS: Option[] = [
  { value: 'sedentario', label: 'Sedentario' },
  { value: 'ligero', label: 'Ligero' },
  { value: 'moderado', label: 'Moderado' },
  { value: 'alto', label: 'Alto' },
  { value: 'atleta', label: 'Atleta' },
]

export type ProfileSection = {
  key: string
  title: string
  description: string
  fields: ProfileFieldDef[]
}

export const PROFILE_SECTIONS: ProfileSection[] = [
  {
    key: 'identidad',
    title: 'Identidad',
    description: 'La edad se calcula sola desde la fecha de nacimiento. La altura sirve para estimar el IMC cuando la balanza no lo trae.',
    fields: [
      { key: 'full_name', label: 'Nombre', kind: 'text', placeholder: 'Nombre y apellido' },
      { key: 'birth_date', label: 'Fecha de nacimiento', kind: 'date' },
      { key: 'sex', label: 'Sexo', kind: 'select', options: SEX_OPTIONS },
      {
        key: 'height_cm',
        label: 'Altura',
        kind: 'number',
        inputMode: 'decimal',
        step: '0.5',
        placeholder: 'cm',
      },
    ],
  },
  {
    key: 'contacto',
    title: 'Contacto',
    description: 'Dónde localizarte. Nada de esto sale de tu servidor.',
    fields: [
      { key: 'email', label: 'Correo', kind: 'email', placeholder: 'tu@correo.com' },
      {
        key: 'whatsapp_e164',
        label: 'WhatsApp',
        kind: 'tel',
        inputMode: 'tel',
        placeholder: '+584121234567',
        hint: 'Formato internacional, con el prefijo del país.',
      },
      {
        key: 'telegram_username',
        label: 'Usuario de Telegram',
        kind: 'text',
        placeholder: '@usuario',
        hint: 'El @ se quita al guardar.',
      },
      {
        key: 'telegram_chat_id',
        label: 'Chat ID de Telegram',
        kind: 'text',
        inputMode: 'numeric',
        placeholder: '123456789',
        hint: 'Numérico. Hace falta para que un bot pueda escribirte primero.',
      },
    ],
  },
  {
    key: 'avisos',
    title: 'Avisos',
    description: 'Preparado para los mensajes automáticos. Todavía no se envía nada.',
    fields: [
      {
        key: 'timezone',
        label: 'Zona horaria',
        kind: 'text',
        placeholder: 'America/Caracas',
        hint: 'Sin ella, un recordatorio a las 7:00 llega a la hora del servidor.',
      },
      { key: 'reminder_time', label: 'Hora del recordatorio', kind: 'time' },
      { key: 'reminder_channel', label: 'Canal preferido', kind: 'select', options: CHANNEL_OPTIONS },
    ],
  },
  {
    key: 'entrenamiento',
    title: 'Contexto de entrenamiento',
    description: 'Lo que el Coach necesita saber sin tener que deducirlo del historial.',
    fields: [
      { key: 'goal', label: 'Objetivo actual', kind: 'text', placeholder: 'Recomposición, bajar a 72 kg…', wide: true },
      { key: 'activity_level', label: 'Nivel de actividad', kind: 'select', options: ACTIVITY_OPTIONS },
      {
        key: 'health_notes',
        label: 'Lesiones o limitaciones',
        kind: 'text',
        placeholder: 'Hombro derecho, evitar press militar…',
        wide: true,
      },
    ],
  },
]

export const PROFILE_FIELDS: ProfileFieldDef[] = PROFILE_SECTIONS.flatMap((section) => section.fields)

/** Borrador: todo texto, porque son inputs. */
export type ProfileDraft = Record<ProfileFieldKey, string>

export function draftFromProfile(profile: UserProfile | null): ProfileDraft {
  const draft = {} as ProfileDraft
  for (const field of PROFILE_FIELDS) {
    const value = profile?.[field.key]
    draft[field.key] = value == null ? '' : String(value)
  }
  return draft
}

/** Solo lo que cambió respecto al perfil cargado. Mandar el formulario entero
 *  haría que un campo que el servidor normalizó (`@carlos` → `carlos`) se
 *  reescribiera en cada guardado. */
export function profilePatch(draft: ProfileDraft, profile: UserProfile | null): UserProfileInput {
  const patch: UserProfileInput = {}

  for (const field of PROFILE_FIELDS) {
    const next = draft[field.key].trim()
    const current = profile?.[field.key]
    const currentText = current == null ? '' : String(current)
    if (next === currentText) continue
    // Vaciar un campo lo borra; el servidor trata la cadena vacía como null.
    patch[field.key] = field.kind === 'number' && next ? Number(next) : next
  }

  return patch
}
