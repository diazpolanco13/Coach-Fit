import type { Experience } from '@/lib/anatomy'

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
  return localStorage.getItem(ROUTE_KEY)
}

export function setLastRoute(key: string): void {
  localStorage.setItem(ROUTE_KEY, key)
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
  const n = Number(localStorage.getItem(GYM_KEY))
  return Number.isInteger(n) && n > 0 ? n : null
}

export function setActiveGymId(id: number | null): void {
  if (id == null) localStorage.removeItem(GYM_KEY)
  else localStorage.setItem(GYM_KEY, String(id))
}

// --- Nivel de experiencia (guía de variantes) -----------------------------

const EXPERIENCE_KEY = 'coachfit.experience'

export function getExperience(): Experience {
  const raw = localStorage.getItem(EXPERIENCE_KEY)
  if (raw === 'beginner' || raw === 'intermediate' || raw === 'advanced') return raw
  return 'beginner'
}

export function setExperience(level: Experience): void {
  localStorage.setItem(EXPERIENCE_KEY, level)
}
