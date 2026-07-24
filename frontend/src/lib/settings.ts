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
