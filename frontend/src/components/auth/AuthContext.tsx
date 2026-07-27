import { createContext, useContext } from 'react'
import type { AuthUser } from '@/lib/api'

/**
 * Estado de la sesión. Vive por ENCIMA de `App`, no dentro: `DataContext` y
 * `NavContext` se montan en `AppShell`, o sea dentro del área autenticada, y un
 * contexto que *puertea* un subárbol no puede vivir dentro de ese subárbol.
 *
 * Además la pantalla de login se renderiza cuando `App` ni siquiera está
 * montada, así que no podría consumir nada que provea `App`.
 */

export type AuthStatus =
  /** Arrancando: `/api/auth/me` en vuelo. */
  | 'checking'
  /** Nunca hubo sesión en esta carga. `App` no se monta. */
  | 'anon'
  /** Hay sesión pero la contraseña es temporal: solo se puede cambiarla. */
  | 'must_change'
  /** Sesión válida. */
  | 'authed'
  /** Había sesión y se cayó a mitad de uso. `App` sigue montada detrás. */
  | 'expired'
  /** No se pudo contactar con el servidor. */
  | 'error'

export type AuthValue = {
  status: AuthStatus
  user: AuthUser | null
  /** Persona cuyos datos se están mirando, si el entrenador está impersonando. */
  viewingUser: AuthUser | null
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  changePassword: (current: string, next: string) => Promise<void>
  /** Reintenta `/api/auth/me` tras un fallo de red. */
  retry: () => void
  enterViewAs: (user: AuthUser) => void
  exitViewAs: () => void
}

export const AuthContext = createContext<AuthValue | null>(null)

/** Para `Root` y las pantallas de auth, donde el usuario puede ser null. */
export function useAuth(): AuthValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth fuera de AuthProvider')
  return value
}

/** Para todo lo que vive dentro de `App`, donde por construcción SIEMPRE hay
 *  usuario. Asserta en vez de devolver `AuthUser | null` porque
 *  `tsconfig.app.json` no tiene `strict`: sin esto, cada `user!.role` sería un
 *  crash esperando y nadie lo comprobaría. */
export function useSession(): AuthUser {
  const { user } = useAuth()
  if (!user) throw new Error('useSession fuera del área autenticada')
  return user
}
