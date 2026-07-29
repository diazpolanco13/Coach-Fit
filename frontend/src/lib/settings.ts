import type { Experience } from '@/lib/anatomy'

/* ─────────────────────────────────────────────────────────────────────────────
   Ámbito por usuario.

   No todas las claves lo llevan. Las de dispositivo —el temporizador de
   descanso, el sidebar plegado— son de este navegador y no de quien lo usa;
   compartirlas es lo correcto. Las que describen a la persona —dónde estaba,
   en qué gimnasio, qué ejercicio miraba— sí, o dos usuarios en el mismo
   navegador se pisan las preferencias.

   Y las dos claves legacy de volumen NO se tocan bajo ningún concepto: la
   migración de `usePlans` las busca por su nombre exacto y las borra cuando el
   servidor acepta el plan. Prefijarlas haría que dejara de encontrarlas en
   silencio y el rango que el usuario ya eligió no llegaría nunca a su plan.
   ──────────────────────────────────────────────────────────────────────────── */

let scope: string | null = null

/** Lo llama `AuthProvider` justo ANTES de publicar el usuario, nunca desde un
 *  efecto: las claves con ámbito se leen en inicializadores de `useState`
 *  durante el primer render. */
export function setStorageScope(userId: number | null): void {
  scope = userId == null ? null : `u${userId}`
}

/** Sufijo y no prefijo, para que el namespace `coachfit` siga siendo greppable
 *  y un barrido por `startsWith('coachfit')` lo siga encontrando todo. */
function scoped(key: string): string {
  return scope ? `${key}::${scope}` : key
}

const REST_SECONDS_KEY = 'coachfit.restSeconds'
const DEFAULT_REST_SECONDS = 90

export function getRestSeconds(): number {
  const raw = localStorage.getItem(REST_SECONDS_KEY)
  const n = raw ? Number(raw) : NaN
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_REST_SECONDS
}

export function setRestSeconds(seconds: number): void {
  localStorage.setItem(REST_SECONDS_KEY, String(seconds))
}

const REST_TIMER_ENABLED_KEY = 'coachfit.restTimerEnabled'

/** Si está apagado, al completar una serie no se entra en la fase de descanso. */
export function getRestTimerEnabled(): boolean {
  const raw = localStorage.getItem(REST_TIMER_ENABLED_KEY)
  return raw !== '0'
}

export function setRestTimerEnabled(on: boolean): void {
  localStorage.setItem(REST_TIMER_ENABLED_KEY, on ? '1' : '0')
}

export type SessionViewPref = 'focus' | 'list'
/** Vista del historial (RegistrarScreen): tarjetas o filas. Independiente de
 *  la vista de la sesión guiada (`SessionViewPref`). */
export type HistorialViewPref = 'cards' | 'list'
export type AfterSetPref = 'next' | 'stay' | 'strip'
export type CheckInPref = 'always' | 'touched' | 'skip'

const SESSION_VIEW_KEY = 'coachfit.sessionView'
const HISTORIAL_VIEW_KEY = 'coachfit.historialView'
const AFTER_SET_KEY = 'coachfit.afterSet'
const CHECK_IN_KEY = 'coachfit.checkIn'

export function getSessionView(): SessionViewPref {
  const raw = localStorage.getItem(SESSION_VIEW_KEY)
  return raw === 'list' ? 'list' : 'focus'
}

export function setSessionView(view: SessionViewPref): void {
  localStorage.setItem(SESSION_VIEW_KEY, view)
}

export function getHistorialView(): HistorialViewPref {
  const raw = localStorage.getItem(HISTORIAL_VIEW_KEY)
  return raw === 'list' ? 'list' : 'cards'
}

export function setHistorialView(view: HistorialViewPref): void {
  localStorage.setItem(HISTORIAL_VIEW_KEY, view)
}

export function getAfterSet(): AfterSetPref {
  const raw = localStorage.getItem(AFTER_SET_KEY)
  if (raw === 'stay' || raw === 'strip') return raw
  return 'next'
}

export function setAfterSet(pref: AfterSetPref): void {
  localStorage.setItem(AFTER_SET_KEY, pref)
}

export function getCheckInPref(): CheckInPref {
  const raw = localStorage.getItem(CHECK_IN_KEY)
  if (raw === 'touched' || raw === 'skip') return raw
  return 'always'
}

export function setCheckInPref(pref: CheckInPref): void {
  localStorage.setItem(CHECK_IN_KEY, pref)
}

const VOLUME_MIN_KEY = 'coachfit.volumeMin'
const VOLUME_MAX_KEY = 'coachfit.volumeMax'
// Rango habitual en la literatura de hipertrofia: por debajo de ~10 series
// semanales por músculo cuesta progresar y por encima de ~20 el retorno cae.
const DEFAULT_VOLUME_MIN = 10
const DEFAULT_VOLUME_MAX = 20

/** El rango de volumen vivía aquí y ahora pertenece al plan, porque cada plan
 *  tiene el suyo (uno de piernas no busca el mismo volumen de pecho que uno de
 *  empuje). Estas dos funciones existen solo para la migración: leen lo que el
 *  usuario ya había elegido y lo borran una vez el servidor lo ha aceptado.
 *
 *  Borrar en dos pasos es deliberado: si la escritura falla, las claves siguen
 *  ahí y se reintenta en la siguiente carga, en vez de resetear el 10/20 del
 *  usuario en silencio. */
export function peekLegacyVolumeRange(): { min: number; max: number } | null {
  const raw = [localStorage.getItem(VOLUME_MIN_KEY), localStorage.getItem(VOLUME_MAX_KEY)]
  const [min, max] = raw.map((v) => (v ? Number(v) : NaN))
  if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max <= 0) return null
  // Misma tolerancia al cruce que tenía getVolumeRange.
  return min >= max ? { min: Math.max(1, max - 1), max } : { min, max }
}

export function clearLegacyVolumeRange(): void {
  localStorage.removeItem(VOLUME_MIN_KEY)
  localStorage.removeItem(VOLUME_MAX_KEY)
}

export const DEFAULT_VOLUME = { min: DEFAULT_VOLUME_MIN, max: DEFAULT_VOLUME_MAX }

// --- Preferencias de navegación, por dispositivo ---------------------------

const ROUTE_KEY = 'coachfit.route'
const SIDEBAR_KEY = 'coachfit.sidebarCollapsed'
const GYM_KEY = 'coachfit.gymId'

export function getLastRoute(): string | null {
  return localStorage.getItem(scoped(ROUTE_KEY))
}

export function setLastRoute(key: string): void {
  localStorage.setItem(scoped(ROUTE_KEY), key)
}

export function getSidebarCollapsed(): boolean {
  return localStorage.getItem(SIDEBAR_KEY) === '1'
}

export function setSidebarCollapsed(collapsed: boolean): void {
  localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0')
}

/** El espacio activo es preferencia de cliente, no estado de servidor: hacerlo
 *  servidor significa una escritura por cada cambio y una carrera con el ancla
 *  del plan. */
export function getActiveGymId(): number | null {
  const n = Number(localStorage.getItem(scoped(GYM_KEY)))
  return Number.isInteger(n) && n > 0 ? n : null
}

export function setActiveGymId(id: number | null): void {
  if (id == null) localStorage.removeItem(scoped(GYM_KEY))
  else localStorage.setItem(scoped(GYM_KEY), String(id))
}

// --- Nivel de experiencia (guía de variantes) -----------------------------

const EXPERIENCE_KEY = 'coachfit.experience'

export function getExperience(): Experience {
  const raw = localStorage.getItem(scoped(EXPERIENCE_KEY))
  if (raw === 'beginner' || raw === 'intermediate' || raw === 'advanced') return raw
  return 'beginner'
}

export function setExperience(level: Experience): void {
  localStorage.setItem(scoped(EXPERIENCE_KEY), level)
}

// --- Claves con ámbito de otros módulos -----------------------------------

/** Los hooks que se guardan su propia clave (`useStrengthDashboard`,
 *  `useBodyTrends`) la pasan por aquí en vez de tocar `localStorage` directo. */
export function scopedKey(key: string): string {
  return scoped(key)
}

/** Claves que pasan a tener ámbito. `restSeconds`, `sidebarCollapsed` y las dos
 *  legacy de volumen quedan fuera a propósito. */
const PER_USER_KEYS = [
  ROUTE_KEY,
  GYM_KEY,
  EXPERIENCE_KEY,
  'coachfit-strength-window',
  'coachfit-strength-exercise',
  'coachfit-trend-range',
]

const ADOPTED_KEY = 'coachfit.adopted' // global a propósito: pasa una sola vez

/** Copia las preferencias que quedaron sin ámbito a las del primer usuario que
 *  entre en este navegador.
 *
 *  Sin esto, quien ya usaba la app a diario entra con su cuenta nueva y se
 *  encuentra los valores por defecto. No es pérdida de datos —todo lo de verdad
 *  está en el servidor— pero es un «la app se ha olvidado de mí» bien visible.
 *
 *  Los originales NO se borran en esta versión: un rollback del despliegue con
 *  las claves ya borradas le dejaría las preferencias en blanco de verdad. Se
 *  borrarán en una versión posterior, cuando esto esté asentado. */
export function adoptLegacyKeys(userId: number): void {
  if (localStorage.getItem(ADOPTED_KEY)) return
  localStorage.setItem(ADOPTED_KEY, String(userId))
  for (const key of PER_USER_KEYS) {
    const legacy = localStorage.getItem(key)
    const target = `${key}::u${userId}`
    if (legacy != null && localStorage.getItem(target) == null) {
      localStorage.setItem(target, legacy)
    }
  }
}
