import { createContext, useContext } from 'react'
import type { Route } from '@/lib/nav'

/** Devuelve qué hacer con los cambios sin guardar. Lo registra la pantalla que
 *  los tiene; el shell solo lo invoca. */
export type Guard = () => Promise<'salir' | 'quedarse'>

export type NavValue = {
  route: Route
  /** Única forma de cambiar de sección. `setRoute` es privado del shell: no
   *  exportarlo es lo que garantiza que nada esquive el guard. */
  navigate: (next: Route) => void
  registerGuard: (guard: Guard | null) => void
  drawerOpen: boolean
  setDrawerOpen: (open: boolean) => void
}

export const NavContext = createContext<NavValue | null>(null)

export function useNav(): NavValue {
  const value = useContext(NavContext)
  if (!value) throw new Error('useNav fuera de NavProvider')
  return value
}
