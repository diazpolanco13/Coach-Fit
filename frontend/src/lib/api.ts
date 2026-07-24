export type Exercise = {
  id: string
  name: string
  name_es: string
  role: string
  body_part: string
  target: string
  equipment: string
  image: string | null
  gif: string | null
  guide_es: string[]
  secondary_muscles?: string[]
}

export type WeekDay = {
  weekday: number
  label: string
  focus: string
  exercise_ids: string[]
  exercises: Exercise[]
  date: string
  completed: boolean
  session_rpe: number | null
  volume_kg: number
}

export type WeekLoad = {
  week_start: string
  week_end: string
  training_days: number
  total_volume_kg: number
  total_sets: number
  avg_session_rpe: number | null
  avg_set_rpe: number | null
  run_distance_km: number
  run_count: number
  strain_index: number
}

export type SessionSet = {
  exercise_id: string
  set_index: number
  reps?: number | null
  weight_kg?: number | null
  rpe?: number | null
  done?: boolean
  notes?: string | null
}

export type UserEquipment = {
  id: number
  name: string
  equipment_type: string
  weight_kg?: number | null
  quantity: number
  created_at: string
}

export type ProgressionSuggestion = {
  exercise_id: string
  exercise_name: string
  current: { reps: number; weight_kg: number; rpe: number }
  recommendation: string
  next_weight_kg: number
  next_reps: number
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    ...init,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || res.statusText)
  }
  return res.json() as Promise<T>
}

export const api = {
  catalog: () => req<{ exercises: Exercise[]; equipment_profile: Record<string, unknown> }>('/api/catalog'),
  week: () => req<{ plan: { name: string; days: WeekDay[] }; load: WeekLoad }>('/api/week'),
  session: (day: string) =>
    req<{ date: string; completed: boolean; focus?: string; session_rpe?: number; notes?: string; sets: SessionSet[] }>(
      `/api/sessions/${day}`,
    ),
  saveSession: (body: {
    date: string
    focus?: string
    completed: boolean
    session_rpe?: number | null
    notes?: string
    sets: SessionSet[]
  }) => req('/api/sessions', { method: 'POST', body: JSON.stringify(body) }),
  toggleDay: (day: string, completed: boolean) =>
    req(`/api/sessions/${day}/toggle?completed=${completed}`, { method: 'POST' }),
  bodyMetrics: () => req<Array<{ id: number; date: string; weight_kg: number; notes?: string }>>('/api/metrics/body'),
  addBody: (body: { date?: string; weight_kg: number; notes?: string }) =>
    req('/api/metrics/body', { method: 'POST', body: JSON.stringify(body) }),
  runs: () =>
    req<Array<{ id: number; date: string; distance_km: number; duration_min?: number; rpe?: number; notes?: string }>>(
      '/api/metrics/runs',
    ),
  addRun: (body: {
    date?: string
    distance_km: number
    duration_min?: number
    rpe?: number
    notes?: string
  }) => req('/api/metrics/runs', { method: 'POST', body: JSON.stringify(body) }),
  coachAdvise: (notes?: string) =>
    req<{ advice: string; source: string; load: WeekLoad; today: WeekDay | null }>('/api/coach/advise', {
      method: 'POST',
      body: JSON.stringify({ notes }),
    }),
  coachLatest: () => req<{ advice?: string; source?: string }>('/api/coach/latest'),
  getEquipment: () => req<UserEquipment[]>('/api/equipment'),
  addEquipment: (body: { name: string; equipment_type: string; weight_kg?: number | null; quantity?: number }) =>
    req<UserEquipment>('/api/equipment', { method: 'POST', body: JSON.stringify(body) }),
  deleteEquipment: (id: number) => req(`/api/equipment/${id}`, { method: 'DELETE' }),
  suggestExercises: (muscle_group?: string) =>
    req<{ equipment_available: string[]; total_exercises: number; exercises: Exercise[] }>(
      `/api/exercises/suggestions${muscle_group ? `?muscle_group=${muscle_group}` : ''}`,
    ),
  suggestProgression: (body: { exercise_id: string; reps: number; weight_kg: number; session_rpe: number }) =>
    req<ProgressionSuggestion>('/api/progression-suggest', { method: 'POST', body: JSON.stringify(body) }),
}
