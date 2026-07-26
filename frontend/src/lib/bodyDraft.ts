/** El borrador de una medición: todo texto, porque son inputs.
 *
 *  Vive fuera del formulario para que el estado (App) y el payload de la API no
 *  dependan de un componente para saber qué campos existen.
 */
import type { BodyMetricInput, BodyMetricNumericKey } from '@/lib/api'
import { BODY_FIELD_KEYS, BODY_TEXT_FIELDS, type BodyTextKey } from '@/lib/bodyMetricFields'
import { toISO } from '@/lib/dates'

export type ProfileBodyDraft = { date: string; measured_at: string; notes: string } & Record<
  BodyMetricNumericKey | BodyTextKey,
  string
>

export function emptyBodyDraft(date = toISO(new Date())): ProfileBodyDraft {
  const draft = { date, measured_at: '', notes: '' } as ProfileBodyDraft
  for (const key of BODY_FIELD_KEYS) draft[key] = ''
  for (const field of BODY_TEXT_FIELDS) draft[field.key] = ''
  return draft
}

/** Un campo vacío se omite del payload en vez de mandarse como 0: la balanza no
 *  midió una masa ósea de cero kilos, simplemente no la midió. */
export function draftToPayload(draft: ProfileBodyDraft): BodyMetricInput {
  const payload: BodyMetricInput = { date: draft.date }

  if (draft.measured_at.trim()) payload.measured_at = draft.measured_at.trim()
  if (draft.notes.trim()) payload.notes = draft.notes.trim()

  for (const key of BODY_FIELD_KEYS) {
    const raw = draft[key].trim()
    if (!raw) continue
    const value = Number(raw)
    if (Number.isFinite(value)) payload[key] = value
  }

  for (const field of BODY_TEXT_FIELDS) {
    const raw = draft[field.key].trim()
    if (raw) payload[field.key] = raw
  }

  return payload
}
