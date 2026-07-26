import { useCallback, useEffect, useRef, useState } from 'react'
import { api, type StrengthDashboard, type StrengthExerciseHistory } from '@/lib/api'

export type StrengthWindow = 14 | 28 | 56

const WINDOW_KEY = 'coachfit-strength-window'
const EXERCISE_KEY = 'coachfit-strength-exercise'
const WINDOWS: StrengthWindow[] = [14, 28, 56]

function storedWindow(): StrengthWindow {
  const value = Number(localStorage.getItem(WINDOW_KEY))
  return WINDOWS.includes(value as StrengthWindow) ? (value as StrengthWindow) : 28
}

/** Estado remoto y preferencias de la vista de fuerza, aislados del App root. */
export function useStrengthDashboard() {
  const [days, setDaysState] = useState<StrengthWindow>(storedWindow)
  const [dashboard, setDashboard] = useState<StrengthDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(
    () => localStorage.getItem(EXERCISE_KEY),
  )
  const [history, setHistory] = useState<StrengthExerciseHistory | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const dashboardRequest = useRef(0)
  const historyRequest = useRef(0)
  const historyCache = useRef(new Map<string, StrengthExerciseHistory>())

  const loadDashboard = useCallback(async () => {
    const request = ++dashboardRequest.current
    setLoading(true)
    setError('')
    try {
      const result = await api.strengthDashboard(days)
      if (request === dashboardRequest.current) setDashboard(result)
      return result
    } catch (cause) {
      if (request === dashboardRequest.current) {
        setError(String((cause as Error).message || cause))
      }
      return null
    } finally {
      if (request === dashboardRequest.current) setLoading(false)
    }
  }, [days])

  const loadHistory = useCallback(async (exerciseId: string, force = false) => {
    const cached = historyCache.current.get(exerciseId)
    if (cached && !force) {
      setHistory(cached)
      setHistoryError('')
      return cached
    }

    const request = ++historyRequest.current
    setHistoryLoading(true)
    setHistoryError('')
    try {
      const result = await api.dashboardExerciseHistory(exerciseId)
      historyCache.current.set(exerciseId, result)
      if (request === historyRequest.current) setHistory(result)
      return result
    } catch (cause) {
      if (request === historyRequest.current) {
        setHistory(null)
        setHistoryError(String((cause as Error).message || cause))
      }
      return null
    } finally {
      if (request === historyRequest.current) setHistoryLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  useEffect(() => {
    const exercises = dashboard?.exercises ?? []
    if (!exercises.length) {
      setSelectedExerciseId(null)
      setHistory(null)
      localStorage.removeItem(EXERCISE_KEY)
      return
    }
    if (selectedExerciseId && exercises.some((item) => item.exercise_id === selectedExerciseId)) return
    const next = (exercises.find((item) => item.all_time_max_weight != null) ?? exercises[0]).exercise_id
    setSelectedExerciseId(next)
    localStorage.setItem(EXERCISE_KEY, next)
  }, [dashboard, selectedExerciseId])

  useEffect(() => {
    if (!selectedExerciseId) return
    loadHistory(selectedExerciseId)
  }, [loadHistory, selectedExerciseId])

  const setDays = useCallback((value: StrengthWindow) => {
    setDaysState(value)
    localStorage.setItem(WINDOW_KEY, String(value))
  }, [])

  const selectExercise = useCallback((exerciseId: string) => {
    setSelectedExerciseId(exerciseId)
    localStorage.setItem(EXERCISE_KEY, exerciseId)
  }, [])

  const refresh = useCallback(async () => {
    historyCache.current.clear()
    const tasks: Promise<unknown>[] = [loadDashboard()]
    if (selectedExerciseId) tasks.push(loadHistory(selectedExerciseId, true))
    await Promise.all(tasks)
  }, [loadDashboard, loadHistory, selectedExerciseId])

  return {
    days,
    setDays,
    dashboard,
    loading,
    error,
    refresh,
    selectedExerciseId,
    selectExercise,
    history,
    historyLoading,
    historyError,
  }
}
