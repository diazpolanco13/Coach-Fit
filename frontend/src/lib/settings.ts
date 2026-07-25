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

function readNumber(key: string, fallback: number): number {
  const raw = localStorage.getItem(key)
  const n = raw ? Number(raw) : NaN
  return Number.isFinite(n) && n > 0 ? n : fallback
}

export function getVolumeRange(): { min: number; max: number } {
  const min = readNumber(VOLUME_MIN_KEY, DEFAULT_VOLUME_MIN)
  const max = readNumber(VOLUME_MAX_KEY, DEFAULT_VOLUME_MAX)
  // Si el usuario cruza los topes, el mínimo cede: un máximo por debajo del
  // mínimo dejaría todos los músculos en rojo a la vez.
  return min >= max ? { min: Math.max(1, max - 1), max } : { min, max }
}

export function setVolumeRange(min: number, max: number): void {
  localStorage.setItem(VOLUME_MIN_KEY, String(min))
  localStorage.setItem(VOLUME_MAX_KEY, String(max))
}
