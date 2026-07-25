/** Sección abierta.
 *
 *  Unión discriminada en memoria, cadena plana al persistir: la unión da tipos a
 *  los parámetros; la cadena da una clave estable para comparar en el sidebar y
 *  para guardarla en localStorage.
 *
 *  Sin router: `react-router-dom` está en el package.json sin un solo import, y
 *  lo único que aportaría es `useBlocker` — que el guard del borrador no
 *  necesita, porque el borrador vive en el shell y sobrevive a la navegación.
 *  Los deep links tampoco valen nada aquí: un solo usuario, tras Basic Auth. */
export type PlanSub = 'dias' | 'objetivos'
export type EspacioSub = 'inventario' | 'biblioteca'

export type Route =
  | { k: 'hoy' }
  | { k: 'registrar'; date?: string }
  | { k: 'plan'; id: number; sub: PlanSub }
  | { k: 'espacio'; id: number; sub: EspacioSub }
  | { k: 'fuerza' }
  | { k: 'cardio' }
  | { k: 'catalogo' }
  | { k: 'ajustes' }

export const INICIO: Route = { k: 'hoy' }

export const planRoute = (id: number, sub: PlanSub = 'dias'): Route => ({ k: 'plan', id, sub })
export const espacioRoute = (id: number, sub: EspacioSub = 'inventario'): Route => ({
  k: 'espacio',
  id,
  sub,
})

/** `plan:3:dias`. Clave de igualdad y de persistencia. */
export function routeKey(r: Route): string {
  if (r.k === 'plan' || r.k === 'espacio') return `${r.k}:${r.id}:${r.sub}`
  return r.k
}

/** Clave sin subsección: el plan sigue marcado en el sidebar aunque estés
 *  dentro de «Objetivos». */
export function routeScope(r: Route): string {
  return r.k === 'plan' || r.k === 'espacio' ? `${r.k}:${r.id}` : r.k
}

const PLAN_SUBS: PlanSub[] = ['dias', 'objetivos']
const ESPACIO_SUBS: EspacioSub[] = ['inventario', 'biblioteca']
const SIMPLE = ['hoy', 'registrar', 'fuerza', 'cardio', 'catalogo', 'ajustes'] as const

/** Tolerante a lo desconocido: una ruta guardada que ya no se entiende cae en
 *  Hoy, nunca deja la app en blanco. Que el id exista se comprueba aparte, tras
 *  cargar los datos — aquí solo se valida la forma. */
export function parseRoute(raw: string | null): Route {
  if (!raw) return INICIO
  const [k, rawId, rawSub] = raw.split(':')

  if (k === 'plan' || k === 'espacio') {
    const id = Number(rawId)
    if (!Number.isInteger(id) || id <= 0) return INICIO
    if (k === 'plan') {
      const sub = PLAN_SUBS.includes(rawSub as PlanSub) ? (rawSub as PlanSub) : 'dias'
      return { k, id, sub }
    }
    const sub = ESPACIO_SUBS.includes(rawSub as EspacioSub)
      ? (rawSub as EspacioSub)
      : 'inventario'
    return { k, id, sub }
  }

  return SIMPLE.includes(k as (typeof SIMPLE)[number]) ? ({ k } as Route) : INICIO
}

/** El guard solo pregunta al cambiar de plan: navegar a Hoy y volver no pierde
 *  nada, porque el borrador vive en el shell y no se desmonta. */
export function changesPlan(from: Route, to: Route): boolean {
  if (from.k !== 'plan') return false
  return to.k !== 'plan' ? false : to.id !== from.id
}
