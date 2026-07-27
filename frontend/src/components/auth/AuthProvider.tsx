import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { api, setUnauthorizedHandler, setViewAs } from '@/lib/api'
import type { AuthUser } from '@/lib/api'
import { adoptLegacyKeys, setStorageScope } from '@/lib/settings'
import { AuthContext } from './AuthContext'
import type { AuthStatus, AuthValue } from './AuthContext'

function statusFor(user: AuthUser): AuthStatus {
  return user.must_change_password ? 'must_change' : 'authed'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('checking')
  const [user, setUser] = useState<AuthUser | null>(null)
  const [viewingUser, setViewingUser] = useState<AuthUser | null>(null)
  const [attempt, setAttempt] = useState(0)

  // `status` en un ref para poder consultarlo desde el handler de 401 sin
  // meterlo en las dependencias del efecto que lo registra.
  const statusRef = useRef(status)
  statusRef.current = status

  /** Ordena el scope del localStorage ANTES de publicar el usuario.
   *
   *  El orden importa y es frágil: las claves con ámbito se leen en
   *  inicializadores de `useState` durante el primer render (`AppShell` para la
   *  ruta, `useGyms` para el gimnasio, `useStrengthDashboard`, `useBodyTrends`).
   *  Si esto se moviera a un `useEffect` —que es exactamente lo que alguien
   *  «limpiaría» algún día— React ya habría renderizado con el scope anterior y
   *  se verían las preferencias del usuario de antes. */
  const adopt = useCallback((next: AuthUser | null) => {
    // La adopción va primero: copia las claves sin ámbito a las de este usuario
    // antes de que nadie lea ninguna con ámbito.
    if (next) adoptLegacyKeys(next.id)
    setStorageScope(next ? next.id : null)
    setUser(next)
  }, [])

  useEffect(() => {
    let cancelled = false
    // En StrictMode este efecto corre dos veces en desarrollo y /api/auth/me se
    // pide dos veces. Es un GET idempotente y `App` ya hace lo mismo con sus
    // nueve peticiones. Nada de useRef de "ya lo pedí": rompe Fast Refresh y no
    // arregla nada.
    api
      .me()
      .then(({ user: me }) => {
        if (cancelled) return
        adopt(me)
        setStatus(statusFor(me))
      })
      .catch((err: unknown) => {
        if (cancelled) return
        adopt(null)
        // Un 401 es la respuesta correcta a "¿hay sesión?", no un fallo. Solo un
        // error de red merece el estado 'error' y su banner de reintentar.
        const networkDown = err instanceof TypeError
        setStatus(networkDown ? 'error' : 'anon')
      })
    return () => {
      cancelled = true
    }
  }, [adopt, attempt])

  useEffect(() => {
    setUnauthorizedHandler(() => {
      // Idempotente: mientras el overlay esté arriba las peticiones de fondo
      // seguirán dando 401 en bucle y todas caen aquí.
      if (statusRef.current === 'expired' || statusRef.current === 'anon') return
      setStatus('expired')
    })
    return () => setUnauthorizedHandler(null)
  }, [])

  const login = useCallback(
    async (email: string, password: string) => {
      const { user: me } = await api.login(email, password)
      setViewingUser(null)
      setViewAs(null)
      adopt(me)
      setStatus(statusFor(me))
    },
    [adopt],
  )

  const changePassword = useCallback(
    async (current: string, next: string) => {
      const { user: me } = await api.changePassword(current, next)
      adopt(me)
      setStatus(statusFor(me))
    },
    [adopt],
  )

  const logout = useCallback(async () => {
    // Best-effort: si falla por red se cierra igual en local.
    try {
      await api.logout()
    } catch {
      // Sin red. Cerrar la sesión local es lo que la persona pidió.
    }
    setViewingUser(null)
    setViewAs(null)
    adopt(null)
    setStorageScope(null)
    setStatus('anon')
  }, [adopt])

  const retry = useCallback(() => {
    setStatus('checking')
    setAttempt((n) => n + 1)
  }, [])

  const enterViewAs = useCallback((target: AuthUser) => {
    setViewAs(target.id)
    setStorageScope(target.id)
    setViewingUser(target)
  }, [])

  const exitViewAs = useCallback(() => {
    setViewAs(null)
    setStorageScope(user ? user.id : null)
    setViewingUser(null)
  }, [user])

  const value = useMemo<AuthValue>(
    () => ({
      status,
      user,
      viewingUser,
      login,
      logout,
      changePassword,
      retry,
      enterViewAs,
      exitViewAs,
    }),
    [status, user, viewingUser, login, logout, changePassword, retry, enterViewAs, exitViewAs],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
