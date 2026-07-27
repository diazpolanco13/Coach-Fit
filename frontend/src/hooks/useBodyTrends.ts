import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api, type BodyMetricPoint } from '@/lib/api'
import { latestPeriodOffset, periodFor, TREND_RANGES, type TrendRange } from '@/lib/bodyTrends'
import { toISO } from '@/lib/dates'
import { scopedKey } from '@/lib/settings'

const RANGE_KEY = 'coachfit-trend-range'

function storedRange(): TrendRange {
  const value = localStorage.getItem(scopedKey(RANGE_KEY))
  return TREND_RANGES.some((range) => range.k === value) ? (value as TrendRange) : 'M'
}

/** Serie completa del historial corporal más el periodo que se está mirando.
 *
 *  La serie se pide una sola vez: son ~20 números por lectura, sin fotos, y
 *  todas las tarjetas dibujan sobre el mismo array. Paginarla obligaría a que
 *  cada tarjeta esperase páginas distintas y los ejes bailarían al cargar. */
export function useBodyTrends() {
  const [history, setHistory] = useState<BodyMetricPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [range, setRangeState] = useState<TrendRange>(storedRange)
  const [offset, setOffset] = useState(0)
  const request = useRef(0)
  const anchor = useMemo(() => toISO(new Date()), [])

  const load = useCallback(async () => {
    const current = ++request.current
    setLoading(true)
    setError('')
    try {
      const result = await api.bodyMetricSeries()
      if (current !== request.current) return
      setHistory(result.items)
      setOffset(latestPeriodOffset(result.items, storedRange(), anchor))
    } catch (cause) {
      if (current === request.current) setError(String((cause as Error).message || cause))
    } finally {
      if (current === request.current) setLoading(false)
    }
  }, [anchor])

  useEffect(() => {
    void load()
  }, [load])

  /** Al cambiar de rango se salta al periodo con lecturas más reciente: abrir
   *  «S» en una semana sin pesarse mostraría todas las tarjetas vacías. */
  const setRange = useCallback(
    (next: TrendRange) => {
      setRangeState(next)
      localStorage.setItem(scopedKey(RANGE_KEY), next)
      setOffset(latestPeriodOffset(history, next, anchor))
    },
    [history, anchor],
  )

  const period = useMemo(() => periodFor(range, anchor, offset), [range, anchor, offset])

  /** No hay «siguiente» más allá del periodo actual ni «anterior» más atrás de
   *  la primera lectura: las flechas se apagan en vez de pasear por el vacío. */
  const canGoNext = range !== 'TODO' && offset < 0
  const canGoPrev = useMemo(() => {
    if (range === 'TODO' || !history.length) return false
    const previous = periodFor(range, anchor, offset - 1)
    return !previous.end || previous.end >= history[0].date
  }, [range, anchor, offset, history])

  return {
    history,
    loading,
    error,
    reload: load,
    range,
    setRange,
    period,
    canGoPrev,
    canGoNext,
    goPrev: () => setOffset((current) => current - 1),
    goNext: () => setOffset((current) => Math.min(0, current + 1)),
  }
}
