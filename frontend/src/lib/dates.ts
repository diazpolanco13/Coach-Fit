/** Fechas ISO `YYYY-MM-DD` tratadas como días del calendario **local**.
 *
 *  `new Date('2026-07-26')` se parsea como medianoche UTC. En Caracas (UTC-4)
 *  eso son las 20:00 del día 25, así que `getDay()` devuelve el día anterior y
 *  cualquier cuenta de «qué toca hoy» se corre una casilla parte de la tarde.
 *  Todo lo de este módulo parte la cadena a mano y construye fechas locales
 *  para que ese desfase no exista.
 */

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function toISO(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${m}-${d}`
}

export function addDays(iso: string, days: number): string {
  const d = parseISO(iso)
  d.setDate(d.getDate() + days)
  return toISO(d)
}

/** 0 = lunes, igual que el `weekday` de los días del plan (que lo produce
 *  `date.weekday()` de Python). `getDay()` cuenta desde el domingo. */
export function weekdayOf(iso: string): number {
  return (parseISO(iso).getDay() + 6) % 7
}

export function startOfWeek(iso: string): string {
  return addDays(iso, -weekdayOf(iso))
}

/** Las siete fechas de la semana que contiene `iso`, de lunes a domingo. */
export function weekDates(iso: string): string[] {
  const monday = startOfWeek(iso)
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}

/** Días entre `iso` y `today`: negativo pasado, 0 hoy, positivo futuro. */
export function daysFrom(iso: string, today: string): number {
  return Math.round((parseISO(iso).getTime() - parseISO(today).getTime()) / 86_400_000)
}

const RELATIVE: Record<number, string> = {
  [-2]: 'Anteayer',
  [-1]: 'Ayer',
  0: 'Hoy',
  1: 'Mañana',
  2: 'Pasado mañana',
}

/** «Ayer», «Hoy», «Mañana»… o null si queda demasiado lejos para que un nombre
 *  relativo diga más que la fecha. */
export function relativeLabel(iso: string, today: string): string | null {
  return RELATIVE[daysFrom(iso, today)] ?? null
}

const LONG = new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'long' })
const SHORT = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' })
const CLOCK_DATE = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' })
const CLOCK_TIME = new Intl.DateTimeFormat('es', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/** «Lunes, 27 de julio». */
export function longLabel(iso: string): string {
  return capitalize(LONG.format(parseISO(iso)))
}

/** «27 jul». */
export function shortLabel(iso: string): string {
  return SHORT.format(parseISO(iso)).replace('.', '')
}

/** «Hoy · 28 jul» o, si no hay etiqueta relativa, «Lunes, 28 de julio». */
export function dayHeading(iso: string, today: string): string {
  const rel = relativeLabel(iso, today)
  return rel ? `${rel} · ${shortLabel(iso)}` : longLabel(iso)
}

export function dayOfMonth(iso: string): number {
  return parseISO(iso).getDate()
}

/** Fecha corta para el reloj de cabecera: «28 jul». */
export function formatClockDate(date: Date): string {
  return CLOCK_DATE.format(date).replace('.', '')
}

/** Hora local 24 h: «23:15». */
export function formatClockTime(date: Date): string {
  return CLOCK_TIME.format(date)
}
