/** Audio + vibración del temporizador de descanso entre series. */

const REST_START_SRC = '/sounds/rest-start.ogg'
const REST_END_SRC = '/sounds/rest-end.ogg'

/** Segundos finales en los que suena rest-end.ogg (duración del clip). */
export const REST_END_LEAD_SECONDS = 3

/** Pulso corto al empezar el descanso. */
const VIBRATE_START: number[] = [100, 50, 100]
/** Un tick por segundo en la cuenta atrás final (bolsillo). */
const VIBRATE_TICK: number[] = [90]
/** Al saltar el descanso fuera de la cuenta atrás. */
const VIBRATE_SKIP: number[] = [220, 80, 220]

let startAudio: HTMLAudioElement | null = null
let endAudio: HTMLAudioElement | null = null
let wakeLock: WakeLockSentinel | null = null
let wantWakeLock = false

function ensureAudio(src: string): HTMLAudioElement {
  const audio = new Audio(src)
  audio.preload = 'auto'
  return audio
}

function vibrate(pattern: number[]): void {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    /* Vibration API no disponible o bloqueada. */
  }
}

async function play(audio: HTMLAudioElement | null, offset = 0): Promise<void> {
  if (!audio) return
  try {
    audio.currentTime = offset
    await audio.play()
  } catch {
    /* Autoplay bloqueado (p. ej. sin gesto previo). */
  }
}

function stop(audio: HTMLAudioElement | null): void {
  if (!audio) return
  try {
    audio.pause()
    audio.currentTime = 0
  } catch {
    /* ignore */
  }
}

async function acquireWakeLock(): Promise<void> {
  wantWakeLock = true
  if (!('wakeLock' in navigator)) return
  try {
    if (wakeLock && !wakeLock.released) return
    wakeLock = await navigator.wakeLock.request('screen')
    wakeLock.addEventListener('release', () => {
      wakeLock = null
    })
  } catch {
    /* Permiso denegado, batería baja, etc. */
  }
}

async function releaseWakeLock(): Promise<void> {
  wantWakeLock = false
  const lock = wakeLock
  wakeLock = null
  if (!lock || lock.released) return
  try {
    await lock.release()
  } catch {
    /* ya liberado */
  }
}

function onVisibilityChange(): void {
  if (document.visibilityState === 'visible' && wantWakeLock) {
    void acquireWakeLock()
  }
}

let listeningVisibility = false

function ensureVisibilityListener(): void {
  if (listeningVisibility || typeof document === 'undefined') return
  document.addEventListener('visibilitychange', onVisibilityChange)
  listeningVisibility = true
}

/** Precarga ambos clips; llamar desde un gesto del usuario (completar serie). */
export function prepareRestCues(): void {
  if (!startAudio) startAudio = ensureAudio(REST_START_SRC)
  if (!endAudio) endAudio = ensureAudio(REST_END_SRC)
  ensureVisibilityListener()
}

export function cueRestStart(): void {
  prepareRestCues()
  stop(endAudio)
  void play(startAudio)
  vibrate(VIBRATE_START)
  void acquireWakeLock()
}

/**
 * Arranca rest-end.ogg sincronizado con los segundos que quedan.
 * Si quedan menos de 3 s (descanso corto), salta al offset correcto.
 */
export function cueRestEndWarning(secondsLeft: number): void {
  prepareRestCues()
  const left = Math.max(1, Math.min(REST_END_LEAD_SECONDS, Math.ceil(secondsLeft)))
  const offset = REST_END_LEAD_SECONDS - left
  void play(endAudio, offset)
  vibrate(VIBRATE_TICK)
}

/** Vibración por cada segundo de la cuenta atrás (tras el arranque del aviso). */
export function cueRestEndTick(): void {
  vibrate(VIBRATE_TICK)
}

/** Cancela el aviso si el usuario alarga el descanso (+30 s). */
export function cancelRestEndWarning(): void {
  stop(endAudio)
}

/** Cierra el descanso: libera wake lock; si se saltó antes del aviso, vibra. */
export function cueRestFinished(opts?: { earlySkip?: boolean }): void {
  stop(endAudio)
  if (opts?.earlySkip) vibrate(VIBRATE_SKIP)
  void releaseWakeLock()
}

/** Liberar wake lock al salir del modo entrenamiento. */
export function stopRestCues(): void {
  stop(endAudio)
  stop(startAudio)
  void releaseWakeLock()
}
