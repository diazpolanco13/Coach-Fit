import { useSyncExternalStore } from 'react'

/** matchMedia como fuente externa: sin efecto ni estado espejo, y en el primer
 *  render ya devuelve el valor real, así que no hay salto de layout. */
const cache = new Map<string, MediaQueryList>()

const mql = (query: string) => {
  let m = cache.get(query)
  if (!m) {
    m = window.matchMedia(query)
    cache.set(query, m)
  }
  return m
}

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const m = mql(query)
      m.addEventListener('change', onChange)
      return () => m.removeEventListener('change', onChange)
    },
    () => mql(query).matches,
    // En SSR no hay matchMedia; la app es solo cliente, pero el tercer
    // argumento evita que un prerender accidental reviente.
    () => false,
  )
}
