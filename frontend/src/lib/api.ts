/** Contribución muscular de un ejercicio. `weight` es grueso (1 / 0.5 / 0.25);
 *  el volumen efectivo también multiplica por `Exercise.load`. */
export type Stimulus = {
  muscle: string
  region?: string | null
  role: 'primary' | 'secondary'
  weight: number
}

/** Los listados vienen "slim" (sin guias) para no bajar 2 MB en cada carga;
 *  `guide_es` solo llega al pedir el detalle con `api.exercise(id)`. */
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
  guide_es?: string[]
  guide_en?: string[]
  secondary_muscles?: string[]
  /** Porción del músculo primario: upper, mid, anti_extension… */
  target_region?: string | null
  stimulus?: Stimulus[]
  family_id?: string | null
  family_label_es?: string | null
  /** 1 principiante · 2 intermedio · 3 avanzado */
  difficulty?: 1 | 2 | 3
  /** Multiplicador de estímulo (~0.6 / 1.0 / 1.3). */
  load?: number
}

/** Un ejercicio prescrito dentro de un día del plan. `exercise` lo hidrata el
 *  servidor con el catálogo (slim); llega a `null` si el id ya no existe, para
 *  no perder la rutina en una reimportación del dataset. */
export type PlanItem = {
  exercise_id: string
  sets: number
  rep_min: number
  rep_max: number
  rest_seconds: number | null
  notes: string | null
  exercise: Exercise | null
}

/** Lo que se manda al guardar: el servidor ignora `exercise` y recalcula todo
 *  lo derivado. */
export type PlanItemIn = Omit<PlanItem, 'exercise'>

/** Un día tal y como se guarda en el plan. Deliberadamente sin los campos que
 *  `GET /api/week` añade al vuelo (`date`, `completed`, `volume_kg`): son de la
 *  semana en curso y persistirlos los dejaría congelados dentro de la rutina.
 *  Desde la v2 lo garantiza el servidor, que reconstruye el documento campo a
 *  campo al normalizarlo. */
export type PlanDay = {
  weekday: number
  label: string
  focus: string
  items: PlanItem[]
}

/** Un día del plan activo proyectado sobre la semana en curso. */
export type WeekDay = PlanDay & {
  date: string
  completed: boolean
  session_rpe: number | null
  volume_kg: number
  status: ProfileDayStatus
  planned_sets: number
  done_sets: number
  completion_pct: number
}

/** Resumen de una sesión guardada, sin las series. Es lo que devuelve
 *  `GET /api/sessions?start&end` para pintar calendarios y tiras de semana. */
export type DaySummary = {
  date: string
  completed: boolean
  focus?: string | null
  session_rpe?: number | null
  notes?: string | null
  volume_kg: number
  set_count: number
  avg_set_rpe: number | null
}

export type VolumeRange = { min: number; max: number }
export type MuscleGoal = VolumeRange & { muscle: string }

/** Objetivo de series semanales por músculo. La clave de `overrides` es la
 *  etiqueta canónica en español que produce `muscleES()`, la misma por la que
 *  agrupa `weeklyVolume()`. */
export type PlanGoals = { base: VolumeRange; overrides: MuscleGoal[] }

export type GymKind = 'hogar' | 'comercial' | 'outdoor' | 'temporal' | 'oficina'

/** Curación de un espacio. Solo se guardan los overrides: todo lo demás que el
 *  inventario permita es «disponible», que es el estado por defecto. */
export type Curation = { favorites: string[]; hidden: string[] }

export type Gym = {
  id: number
  name: string
  kind: GymKind
  icon: string | null
  color: string | null
  notes: string | null
  created_at: string
  updated_at: string
  equipment_count?: number
  favorite_count?: number
  hidden_count?: number
  /** En línea desde `GET /api/gyms`: el filtro de ejercicios lo necesita en
   *  todas las pantallas y así no hay un fetch por cambio de espacio. */
  equipment: UserEquipment[]
  curation: Curation
}

export type GymLibrary = {
  gym_id: number
  equipment_types: string[]
  allowed_equipment: string[]
  favorites: string[]
  hidden: string[]
  /** Favoritos cuyo equipo ya no permite el inventario. */
  orphan_favorites: string[]
  counts: { catalog: number; allowed: number; favorites: number; hidden: number }
}

export type Plan = {
  id: number
  is_active: boolean
  created_at: string
  updated_at: string
  version: number
  name: string
  rest_seconds: number
  /** Cuánto cuenta una serie para un músculo secundario, 0–1. */
  indirect_weight: number
  /** Espacio al que pertenece. `gym` es null si no está anclado o si el espacio
   *  fue borrado; `gym_missing` distingue los dos casos. */
  gym: Gym | null
  gym_missing: boolean
  effective_gym_id: number | null
  objective: string | null
  goals: PlanGoals
  days: PlanDay[]
}

/** Fila del selector de planes: sin el detalle de ejercicios. */
export type PlanSummary = {
  id: number
  name: string
  gym_id: number | null
  objective: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  training_days: number
  exercise_count: number
  total_sets: number
  goals: PlanGoals
}

/** Cuerpo de escritura de un plan. */
export type PlanPayloadIn = {
  name?: string
  days?: Array<Omit<PlanDay, 'items'> & { items: PlanItemIn[] }>
  goals?: PlanGoals
  rest_seconds?: number
  indirect_weight?: number
  gym_id?: number | null
  objective?: string | null
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

export type BodyMetricPhoto = {
  id: number
  body_metric_id: number
  url: string
  original_name?: string | null
  content_type: string
  size_bytes: number
  sort_order: number
  created_at: string
}

export type BodyMetric = {
  id: number
  date: string
  measured_at?: string | null
  weight_kg?: number | null
  bmi?: number | null
  body_fat_pct?: number | null
  fat_mass_kg?: number | null
  muscle_pct?: number | null
  muscle_mass_kg?: number | null
  skeletal_muscle_pct?: number | null
  skeletal_muscle_kg?: number | null
  bone_pct?: number | null
  bone_mass_kg?: number | null
  protein_pct?: number | null
  protein_mass_kg?: number | null
  water_pct?: number | null
  water_mass_kg?: number | null
  lean_body_mass_kg?: number | null
  subcutaneous_fat_pct?: number | null
  visceral_fat?: number | null
  bmr_kcal?: number | null
  metabolic_age?: number | null
  whr?: number | null
  optimal_weight_kg?: number | null
  weight_level?: string | null
  body_type?: string | null
  notes?: string | null
  photos?: BodyMetricPhoto[]
}

export type BodyMetricInput = Partial<Omit<BodyMetric, 'id' | 'photos'>> & { date?: string }

/** Una lectura de la balanza sin fotos ni id, en orden ascendente. Es lo que
 *  devuelve `/api/metrics/body/series` para dibujar tendencias. */
export type BodyMetricPoint = Omit<BodyMetric, 'id' | 'photos' | 'weight_level' | 'body_type' | 'notes'>

/** Claves numéricas de una lectura: las que se pueden graficar. */
export type BodyMetricNumericKey = Exclude<keyof BodyMetricPoint, 'date' | 'measured_at'>

export type RenphoIntegration = {
  connected: boolean
  email_masked: string | null
  last_sync_at: string | null
  last_sync_status: string | null
  last_sync_detail: string | null
}

export type RenphoSyncResult = {
  imported: number
  fetched?: number
  dates: string[]
  latest: BodyMetric | null
  integration: RenphoIntegration
}

export type ProfileSex = 'masculino' | 'femenino' | 'otro'
export type ReminderChannel = 'whatsapp' | 'telegram' | 'ninguno'
export type ActivityLevel = 'sedentario' | 'ligero' | 'moderado' | 'alto' | 'atleta'

/** Datos de la persona. Los campos editables son todos opcionales: el perfil
 *  arranca vacío y se completa cuando hace falta. */
export type UserProfileFields = {
  full_name: string | null
  birth_date: string | null
  sex: ProfileSex | null
  height_cm: number | null
  email: string | null
  /** Formato internacional, `+584121234567`. */
  whatsapp_e164: string | null
  /** Sin `@`: el backend lo quita al guardar. */
  telegram_username: string | null
  telegram_chat_id: string | null
  timezone: string | null
  /** `HH:MM`. */
  reminder_time: string | null
  reminder_channel: ReminderChannel | null
  goal: string | null
  activity_level: ActivityLevel | null
  health_notes: string | null
}

export type UserProfile = UserProfileFields & {
  has_photo: boolean
  photo_url: string | null
  photo_content_type?: string | null
  photo_original_name?: string | null
  photo_size_bytes?: number | null
  updated_at?: string | null
  /** Derivada de `birth_date` en el servidor: una edad guardada se desfasa al
   *  día siguiente del cumpleaños. */
  age: number | null
}

/** El PATCH acepta cadenas vacías: vaciar un campo lo borra. */
export type UserProfileInput = Partial<Record<keyof UserProfileFields, string | number | null>>

export type ProfileDayStatus = 'completed' | 'bonus' | 'partial' | 'missed' | 'rest' | 'future'

export type ProfileCalendarDay = {
  date: string
  weekday: number
  planned: boolean
  completed: boolean
  status: ProfileDayStatus
  planned_sets: number
  done_sets: number
  completion_pct: number
  volume_kg: number
  focus: string | null
}

export type ProfileWeekDetail = {
  week_start: string
  planned_days: number
  completed_days: number
  missed_dates: string[]
  partial_dates: string[]
  debt_sets: number
  volume_kg: number
}

export type ProfileSummary = {
  window_days: number
  start: string
  end: string
  calendar: ProfileCalendarDay[]
  week_compare: {
    current: ProfileWeekDetail
    previous: ProfileWeekDetail
  }
  consistency: {
    planned_days: number
    completed_days: number
    completed_planned_days: number
    adherence_pct: number
    current_streak_days: number
  }
  volume: {
    total_volume_kg: number
    weeks: Array<{ week_start: string; planned_days: number; completed_days: number; volume_kg: number }>
  }
  composition: {
    latest: BodyMetric | null
    oldest: BodyMetric | null
    delta: { weight_kg: number | null; body_fat_pct: number | null; muscle_pct: number | null }
  }
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

/** Dolor/molestia por zona dentro de un ejercicio (`sore` | `pain`). */
export type ExerciseFeedbackMap = Record<string, Record<string, 'sore' | 'pain'>>

export type SessionDetail = {
  date: string
  completed: boolean
  focus?: string | null
  session_rpe?: number | null
  notes?: string | null
  mood?: string | null
  health?: string | null
  energy?: string | null
  exercise_feedback?: ExerciseFeedbackMap
  sets: SessionSet[]
}

export type MuscleCoverageItem = {
  muscle: string
  sessions: number
  volume_kg: number
  days_since_last: number | null
  pct: number
}

export type MuscleTrendItem = {
  muscle: string
  sessions: number
  volume_kg: number
  days_since_last: number | null
  trend_pct: number | null
  coverage_pct?: number
}

export type StrengthSummary = {
  volume_kg: number
  volume_change_pct: number | null
  sessions: number
  sessions_change: number
  pr_count: number
  active_groups: number
  total_groups: number
  stale_groups: number
}

export type StrengthExercise = {
  exercise_id: string
  name: string
  muscle: string
  sessions: number
  volume_kg: number
  window_max_weight: number | null
  all_time_max_weight: number | null
  last_date: string
}

export type StrengthPR = {
  exercise_id: string
  name: string
  date: string
  weight_kg: number
  reps: number | null
  previous_weight_kg: number | null
  improvement_kg: number | null
}

export type StrengthDashboard = {
  window_days: number
  start: string
  end: string
  summary: StrengthSummary
  muscle_groups: MuscleTrendItem[]
  weekly_volume: Array<{ week_start: string; sessions: number; volume_kg: number }>
  prs: StrengthPR[]
  exercises: StrengthExercise[]
}

export type StrengthExerciseHistory = {
  exercise_id: string
  exercise_name: string
  max_weight: number | null
  history: Array<{ date: string; max_weight: number; max_reps: number }>
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
  available_weights: number[]
}

export type Role = 'admin' | 'entrenador' | 'usuario'

/** Lo que el backend devuelve en `/api/auth/me` y en el login. Nunca incluye el
 *  hash de la contraseña: el servidor proyecta columnas explícitas. */
export type AuthUser = {
  id: number
  email: string
  full_name: string | null
  role: Role
  trainer_id: number | null
  must_change_password: boolean
  is_active: boolean
}

/** Una persona vista desde la pantalla de gestión. */
export type ManagedUser = AuthUser & {
  last_login_at: string | null
  created_at: string
}

/** El `detail` de FastAPI, en una frase.
 *
 *  Un 422 de validación llega como un array de objetos con `loc` y `msg`.
 *  Enseñarlo tal cual pone un muro de JSON delante de alguien que solo escribió
 *  mal un correo. */
function errorMessage(text: string, fallback: string): string {
  if (!text) return fallback
  try {
    const parsed = JSON.parse(text) as { detail?: unknown }
    const detail = parsed.detail
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail)) {
      const parts = detail
        .map((item) => {
          const entry = item as { msg?: string; loc?: unknown[] }
          const msg = (entry.msg || '').replace(/^Value error,\s*/, '')
          const field = Array.isArray(entry.loc) ? entry.loc[entry.loc.length - 1] : null
          if (!msg) return null
          return field && field !== 'body' ? `${field}: ${msg}` : msg
        })
        .filter(Boolean)
      if (parts.length) return parts.join(' · ')
    }
  } catch {
    // No era JSON: el texto plano ya es el mensaje.
  }
  return text
}

/** La sesión se cayó a mitad de uso. Se distingue de un error normal para que
 *  los ~20 `catch (e) => setError(e.message)` de `App.tsx` no pinten
 *  "Unauthorized" en el banner rojo a la vez que aparece la pantalla de login. */
export class SessionExpiredError extends Error {
  constructor() {
    super('La sesión ha caducado.')
    this.name = 'SessionExpiredError'
  }
}

let onUnauthorized: (() => void) | null = null

/** Lo llama `AuthProvider`, que es el único suscriptor. Vive a nivel de módulo y
 *  no en un contexto a propósito: tiene que sobrevivir al desmontaje del árbol
 *  de la app, que es justo lo que pasa cuando se cae la sesión. */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler
}

/** Id de la persona cuyos datos se están mirando, o null si son los propios.
 *  Mutable y **invisible para React**: cambiarlo va siempre acompañado de un
 *  cambio de estado que fuerce la recarga (`<App key={...}>`). */
let viewAsUserId: number | null = null

export function setViewAs(userId: number | null): void {
  viewAsUserId = userId
}

export function getViewAs(): number | null {
  return viewAsUserId
}

function viewAsHeader(): Record<string, string> {
  return viewAsUserId != null ? { 'X-Coachfit-View-As': String(viewAsUserId) } : {}
}

/** Cinturón local del modo «ver como». El backend también lo rechaza; esto falla
 *  antes de tocar la red y con un mensaje que se lee, en vez de un 403 mudo que
 *  alguien acabaría «arreglando» en el servidor. */
function assertReadOnly(method: string | undefined): void {
  if (viewAsUserId != null && method && method !== 'GET') {
    throw new Error(
      'Modo solo lectura: no se puede escribir mientras ves los datos de otra persona.',
    )
  }
}

async function handle<T>(res: Response, path: string): Promise<T> {
  // Los 401 de /api/auth/* NO son "sesión caducada": una contraseña mal tecleada
  // es un 401 de /login, y el 401 de /me al arrancar *es* la respuesta "no hay
  // sesión". El prefijo del path los excluye sin plomería extra.
  if (res.status === 401 && !path.startsWith('/api/auth/')) {
    onUnauthorized?.()
    throw new SessionExpiredError()
  }
  if (!res.ok) {
    throw new Error(errorMessage(await res.text(), res.statusText))
  }
  return res.json() as Promise<T>
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  assertReadOnly(init?.method)
  const res = await fetch(path, {
    // Hoy es el valor por defecto de fetch, o sea un no-op. Se pone explícito
    // como contrato: el día que la API viva en otro origen hará falta 'include'
    // Y cambiar el CORS del backend, que está en allow_credentials=False a
    // propósito (ver el comentario de main.py).
    credentials: 'same-origin',
    ...init,
    // `headers` va DESPUÉS del spread. Antes iba delante y `...init` lo pisaba
    // con las cabeceras crudas del llamante; funcionaba de casualidad porque el
    // único llamante con cabeceras es importBodyCsv, que justamente quiere
    // sobrescribir el Content-Type. Con X-Coachfit-View-As en la mezcla, ese
    // orden borraría la cabecera y el CSV se importaría en la cuenta equivocada.
    headers: {
      'Content-Type': 'application/json',
      ...viewAsHeader(),
      ...(init?.headers || {}),
    },
  })
  return handle<T>(res, path)
}

async function formReq<T>(path: string, body: FormData, method: 'POST' | 'PUT' = 'POST'): Promise<T> {
  assertReadOnly(method)
  // Sin Content-Type: lo pone el navegador con el boundary del multipart.
  const res = await fetch(path, {
    method,
    body,
    credentials: 'same-origin',
    headers: viewAsHeader(),
  })
  return handle<T>(res, path)
}

export const api = {
  catalog: () =>
    req<{
      exercises: Exercise[]
      equipment_unlocks: Record<string, string[]>
    }>('/api/catalog'),
  week: () =>
    req<{
      plan: Omit<Plan, 'id' | 'days'> & { id: number | null; days: WeekDay[] }
      load: WeekLoad
      plans: PlanSummary[]
      active_id: number | null
    }>('/api/week'),
  plans: () =>
    req<{ plans: PlanSummary[]; active_id: number | null; max_plans: number }>('/api/plans'),
  plan: (id: number) => req<Plan>(`/api/plans/${id}`),
  createPlan: (body: PlanPayloadIn & { name: string; activate?: boolean }) =>
    req<Plan>('/api/plans', { method: 'POST', body: JSON.stringify(body) }),
  /** Reemplazo completo: manda siempre el documento entero. */
  putPlan: (id: number, body: PlanPayloadIn & { name: string }) =>
    req<Plan>(`/api/plans/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  /** Parcial: lo que no venga se conserva. */
  patchPlan: (id: number, body: PlanPayloadIn) =>
    req<Plan>(`/api/plans/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  duplicatePlan: (id: number, name?: string) =>
    req<Plan>(`/api/plans/${id}/duplicate`, { method: 'POST', body: JSON.stringify({ name }) }),
  activatePlan: (id: number) =>
    req<{ plans: PlanSummary[]; active_id: number | null; max_plans: number }>(
      `/api/plans/${id}/activate`,
      { method: 'POST' },
    ),
  deletePlan: (id: number) =>
    req<{ deleted: number | null; plans: PlanSummary[]; active_id: number | null }>(
      `/api/plans/${id}`,
      { method: 'DELETE' },
    ),
  gyms: () =>
    req<{ gyms: Gym[]; effective_gym_id: number | null; max_gyms: number }>('/api/gyms'),
  createGym: (body: { name: string; kind?: GymKind; icon?: string | null; notes?: string | null }) =>
    req<Gym>('/api/gyms', { method: 'POST', body: JSON.stringify(body) }),
  patchGym: (
    id: number,
    body: { name?: string; kind?: GymKind; icon?: string | null; notes?: string | null },
  ) => req<Gym>(`/api/gyms/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  duplicateGym: (id: number, name?: string) =>
    req<Gym>(`/api/gyms/${id}/duplicate`, { method: 'POST', body: JSON.stringify({ name }) }),
  deleteGym: (id: number, reassignTo?: number) =>
    req<{
      deleted: number
      plans_orphaned: number[]
      plans_reassigned: number[]
      gyms: Gym[]
      effective_gym_id: number | null
    }>(`/api/gyms/${id}${reassignTo ? `?reassign_to=${reassignTo}` : ''}`, { method: 'DELETE' }),
  addGymEquipment: (
    id: number,
    body: { name: string; equipment_type: string; weight_kg?: number | null; quantity?: number },
  ) => req<UserEquipment>(`/api/gyms/${id}/equipment`, { method: 'POST', body: JSON.stringify(body) }),
  deleteGymEquipment: (id: number, equipmentId: number) =>
    req(`/api/gyms/${id}/equipment/${equipmentId}`, { method: 'DELETE' }),
  gymLibrary: (id: number) => req<GymLibrary>(`/api/gyms/${id}/library`),
  markExercise: (id: number, exerciseId: string, state: 'favorito' | 'disponible' | 'oculto') =>
    req<GymLibrary & { exercise_id: string; state: string }>(
      `/api/gyms/${id}/library/${exerciseId}`,
      { method: 'PUT', body: JSON.stringify({ state }) },
    ),
  session: (day: string) => req<SessionDetail>(`/api/sessions/${day}`),
  /** Resúmenes por día de un rango (máx. 62 días), sin las series. Para la tira
   *  de la semana del navegador de fechas. */
  sessionsRange: (start: string, end: string) =>
    req<{ start: string; end: string; sessions: DaySummary[] }>(
      `/api/sessions?start=${start}&end=${end}`,
    ),
  saveSession: (body: {
    date: string
    focus?: string
    completed: boolean
    session_rpe?: number | null
    notes?: string
    mood?: string | null
    health?: string | null
    energy?: string | null
    exercise_feedback?: ExerciseFeedbackMap
    sets: SessionSet[]
    /** Qué pasa con los ejercicios que ya estaban registrados ese día y no van
     *  en `sets`. `replace` (por defecto en el servidor) los borra: solo puede
     *  usarlo quien tenga la sesión entera en pantalla. `merge` los conserva y
     *  reescribe únicamente los ejercicios que manda. */
    mode?: 'replace' | 'merge'
  }) => req('/api/sessions', { method: 'POST', body: JSON.stringify(body) }),
  toggleDay: (day: string, completed: boolean) =>
    req(`/api/sessions/${day}/toggle?completed=${completed}`, { method: 'POST' }),
  bodyMetrics: (opts?: { limit?: number; offset?: number }) => {
    const limit = opts?.limit ?? 20
    const offset = opts?.offset ?? 0
    return req<{
      items: BodyMetric[]
      total: number
      limit: number
      offset: number
      has_more: boolean
    }>(`/api/metrics/body?limit=${limit}&offset=${offset}`)
  },
  bodyMetricSeries: () =>
    req<{ items: BodyMetricPoint[]; total: number; fields: string[] }>('/api/metrics/body/series'),
  addBody: (body: BodyMetricInput) =>
    req<BodyMetric>('/api/metrics/body', { method: 'POST', body: JSON.stringify(body) }),
  addBodyWithPhotos: (body: BodyMetricInput, photos: File[]) => {
    const form = new FormData()
    form.append('payload', JSON.stringify(body))
    photos.forEach((photo) => form.append('photos', photo))
    return formReq<BodyMetric>('/api/metrics/body/with-photos', form)
  },
  addBodyPhotos: (metricId: number, photos: File[]) => {
    const form = new FormData()
    photos.forEach((photo) => form.append('photos', photo))
    return formReq<BodyMetric>(`/api/metrics/body/${metricId}/photos`, form)
  },
  updateBody: (metricId: number, body: BodyMetricInput) =>
    req<BodyMetric>(`/api/metrics/body/${metricId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  replaceBodyPhoto: (photoId: number, photo: File) => {
    const form = new FormData()
    form.append('photo', photo)
    return formReq<BodyMetric>(`/api/metrics/body/photos/${photoId}`, form, 'PUT')
  },
  deleteBodyPhoto: (photoId: number) =>
    req<BodyMetric>(`/api/metrics/body/photos/${photoId}`, { method: 'DELETE' }),
  importBodyCsv: (csvText: string) =>
    req<{ imported: number; dates: string[]; latest: BodyMetric | null }>('/api/metrics/body/import', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: csvText,
    }),
  getRenphoIntegration: () => req<RenphoIntegration>('/api/integrations/renpho'),
  connectRenpho: (body: { email: string; password: string }) =>
    req<RenphoIntegration>('/api/integrations/renpho', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  disconnectRenpho: () =>
    req<RenphoIntegration>('/api/integrations/renpho', { method: 'DELETE' }),
  syncRenpho: () =>
    req<RenphoSyncResult>('/api/integrations/renpho/sync', { method: 'POST' }),
  profileSummary: (days = 28) => req<ProfileSummary>(`/api/profile/summary?days=${days}`),
  profile: () => req<UserProfile>('/api/profile'),
  updateProfile: (body: UserProfileInput) =>
    req<UserProfile>('/api/profile', { method: 'PATCH', body: JSON.stringify(body) }),
  setProfilePhoto: (photo: File) => {
    const form = new FormData()
    form.append('photo', photo)
    return formReq<UserProfile>('/api/profile/photo', form, 'PUT')
  },
  deleteProfilePhoto: () => req<UserProfile>('/api/profile/photo', { method: 'DELETE' }),
  runs: () =>
    req<
      Array<{
        id: number
        date: string
        distance_km: number
        duration_min?: number
        pace_min_per_km?: number
        rpe?: number
        notes?: string
      }>
    >('/api/metrics/runs'),
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
  coachLatest: () => req<{ advice?: string; source?: string; created_at?: string }>('/api/coach/latest'),
  /** Series hechas por ejercicio en la semana. Se agrupan por músculo en el
   *  cliente con `weeklyVolume()`, la misma función que mide el plan. */
  weeklySets: (weekStart?: string) =>
    req<{ week_start: string; week_end: string; sets: Record<string, number>; total_sets: number }>(
      weekStart ? `/api/dashboard/weekly-sets?week_start=${weekStart}` : '/api/dashboard/weekly-sets',
    ),
  getEquipment: () => req<UserEquipment[]>('/api/equipment'),
  addEquipment: (body: { name: string; equipment_type: string; weight_kg?: number | null; quantity?: number }) =>
    req<UserEquipment>('/api/equipment', { method: 'POST', body: JSON.stringify(body) }),
  deleteEquipment: (id: number) => req(`/api/equipment/${id}`, { method: 'DELETE' }),
  exercise: (id: string) => req<Exercise>(`/api/exercises/${id}`),
  suggestExercises: (muscle_group?: string) =>
    req<{ equipment_available: string[]; total_exercises: number; exercises: Exercise[] }>(
      `/api/exercises/suggestions${muscle_group ? `?muscle_group=${muscle_group}` : ''}`,
    ),
  suggestProgression: (body: {
    exercise_id: string
    reps: number
    weight_kg: number
    session_rpe: number
    /** Espacio donde se entrena ahora: la escalera de mancuernas depende de él. */
    gym_id?: number
  }) =>
    req<ProgressionSuggestion>('/api/progression-suggest', { method: 'POST', body: JSON.stringify(body) }),
  dashboardVolume: (weekStart?: string) =>
    req<Record<string, number>>(
      `/api/dashboard/volume-by-muscle${weekStart ? `?week_start=${weekStart}` : ''}`,
    ),
  dashboardFrequency: (weekStart?: string) =>
    req<{ frequency: Record<string, number>; exercises: Record<string, { name: string }> }>(
      `/api/dashboard/exercise-frequency${weekStart ? `?week_start=${weekStart}` : ''}`,
    ),
  dashboardExerciseHistory: (exerciseId: string) =>
    req<StrengthExerciseHistory>(`/api/dashboard/exercise-history/${exerciseId}`),
  strengthDashboard: (days = 28) =>
    req<StrengthDashboard>(`/api/dashboard/strength?days=${days}`),
  muscleCoverage: (days = 14) =>
    req<{ window_days: number; groups: MuscleCoverageItem[] }>(`/api/dashboard/muscle-coverage?days=${days}`),
  muscleTrends: (days = 28) =>
    req<{ window_days: number; groups: MuscleTrendItem[]; stale_count: number }>(
      `/api/dashboard/muscle-trends?days=${days}`,
    ),
  prsThisMonth: (month?: string) =>
    req<{ month: string; pr_count: number }>(`/api/dashboard/prs${month ? `?month=${month}` : ''}`),

  // --- Sesión ---------------------------------------------------------------
  // La cookie es HttpOnly: el frontend NO puede leerla. El único modo de saber
  // si hay sesión es preguntar por `me()`, y el estado va en el código HTTP
  // (200 con usuario, 401 sin él), nunca en un `{user: null}`.
  me: () => req<{ user: AuthUser }>('/api/auth/me'),
  login: (email: string, password: string) =>
    req<{ user: AuthUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  /** Fuera de `req()` porque responde 204 sin cuerpo y `res.json()` reventaría.
   *  Quien lo llama lo trata como best-effort: si falla por red se cierra igual
   *  en local — a quien pulsa «cerrar sesión» en un móvil compartido no se le
   *  puede decir que no. */
  logout: () => fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }),
  changePassword: (current_password: string, new_password: string) =>
    req<{ user: AuthUser }>('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ current_password, new_password }),
    }),

  // --- Personas -------------------------------------------------------------
  users: () => req<{ users: ManagedUser[] }>('/api/users'),
  /** `temporary_password` se devuelve UNA sola vez y no es recuperable: la UI la
   *  enseña con botón de copiar y el aviso de que no se volverá a mostrar. */
  createUser: (body: {
    email: string
    full_name?: string | null
    role?: Role
    trainer_id?: number | null
  }) =>
    req<{ user: ManagedUser; temporary_password: string }>('/api/users', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  patchUser: (
    id: number,
    body: Partial<Pick<ManagedUser, 'email' | 'full_name' | 'role' | 'trainer_id' | 'is_active'>>,
  ) => req<{ user: ManagedUser }>(`/api/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  resetUserPassword: (id: number) =>
    req<{ temporary_password: string }>(`/api/users/${id}/reset-password`, { method: 'POST' }),
  setUserActive: (id: number, active: boolean) =>
    req<{ user: ManagedUser }>(`/api/users/${id}/${active ? 'activate' : 'deactivate'}`, {
      method: 'POST',
    }),
}
