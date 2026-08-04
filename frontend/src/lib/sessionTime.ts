/** Hora local HH:MM. */
export function formatClock(date = new Date()): string {
  const h = date.getHours()
  const m = date.getMinutes()
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Minutos → `1h 30m` / `30m`. */
export function formatDuration(min: number | null | undefined): string {
  if (min == null || min <= 0) return ''
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  if (h <= 0) return `${m}m`
  if (m <= 0) return `${h}h`
  return `${h}h ${m}m`
}

/** `1:30`, `90`, `1h30` → minutos; null si no parsea. */
export function parseDurationInput(raw: string): number | null {
  const s = raw.trim().toLowerCase().replace(/\s+/g, '')
  if (!s) return null
  if (/^\d+$/.test(s)) {
    const n = Number(s)
    return n >= 1 && n <= 600 ? n : null
  }
  const hm = s.match(/^(\d{1,2}):([0-5]\d)$/)
  if (hm) {
    const n = Number(hm[1]) * 60 + Number(hm[2])
    return n >= 1 && n <= 600 ? n : null
  }
  const labeled = s.match(/^(\d{1,2})h(?:(\d{1,2})m?)?$/)
  if (labeled) {
    const n = Number(labeled[1]) * 60 + Number(labeled[2] || 0)
    return n >= 1 && n <= 600 ? n : null
  }
  const onlyM = s.match(/^(\d{1,3})m$/)
  if (onlyM) {
    const n = Number(onlyM[1])
    return n >= 1 && n <= 600 ? n : null
  }
  return null
}

/** Minutos → valor de input `H:MM` (p. ej. `1:30`). */
export function durationToInput(min: number | null | undefined): string {
  if (min == null || min <= 0) return ''
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  return `${h}:${String(m).padStart(2, '0')}`
}

export function formatSessionSchedule(
  startedAt: string | null | undefined,
  durationMin: number | null | undefined,
): string | null {
  const parts: string[] = []
  if (startedAt) parts.push(startedAt)
  const dur = formatDuration(durationMin)
  if (dur) parts.push(dur)
  return parts.length ? parts.join(' · ') : null
}
