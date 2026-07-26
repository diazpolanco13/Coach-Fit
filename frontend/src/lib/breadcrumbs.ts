import type { Route } from '@/lib/nav'
import { espacioRoute, INICIO, planRoute } from '@/lib/nav'

export type Crumb = {
  label: string
  /** Sin `route` = tramo actual (no clicable). */
  route?: Route
}

/** Etiquetas de contexto que el shell ya conoce (nombre del plan, espacio…). */
export type CrumbContext = {
  planName?: string
  gymName?: string
  /** Fecha ISO del día que se está registrando. */
  registrarDate?: string
}

const PLAN_SUB_LABEL: Record<string, string> = {
  dias: 'Días',
  objetivos: 'Objetivos',
}

const ESPACIO_SUB_LABEL: Record<string, string> = {
  inventario: 'Inventario',
  biblioteca: 'Biblioteca',
}

/** Migas estructurales de la ruta actual (no el historial).
 *  `from` = origen inmediato (p. ej. plan → registrar) para un trazo más útil. */
export function crumbsFor(route: Route, ctx: CrumbContext = {}, from?: Route | null): Crumb[] {
  switch (route.k) {
    case 'hoy':
      return [{ label: 'Hoy' }]
    case 'registrar': {
      const date = ctx.registrarDate || route.date
      const label = date ? `Registrar · ${date}` : 'Registrar'
      if (from?.k === 'plan') {
        const name = ctx.planName?.trim() || `Plan #${from.id}`
        return [
          { label: name, route: planRoute(from.id, from.sub) },
          { label },
        ]
      }
      return [
        { label: 'Hoy', route: INICIO },
        { label },
      ]
    }
    case 'plan': {
      const name = ctx.planName?.trim() || `Plan #${route.id}`
      return [
        { label: name, route: planRoute(route.id, 'dias') },
        { label: PLAN_SUB_LABEL[route.sub] ?? route.sub },
      ]
    }
    case 'espacio': {
      const name = ctx.gymName?.trim() || `Espacio #${route.id}`
      return [
        { label: name, route: espacioRoute(route.id, 'inventario') },
        { label: ESPACIO_SUB_LABEL[route.sub] ?? route.sub },
      ]
    }
    case 'perfil':
      return [{ label: 'Progreso' }, { label: 'Perfil' }]
    case 'mediciones':
      return [{ label: 'Progreso' }, { label: 'Mediciones' }]
    case 'fuerza':
      return [{ label: 'Progreso' }, { label: 'Fuerza' }]
    case 'cardio':
      return [{ label: 'Progreso' }, { label: 'Cardio' }]
    case 'consistencia':
      return [{ label: 'Progreso' }, { label: 'Consistencia' }]
    case 'catalogo':
      return [{ label: 'Catálogo' }]
    case 'ajustes':
      return [{ label: 'Ajustes' }]
    default:
      return [{ label: 'Coach Fit' }]
  }
}
