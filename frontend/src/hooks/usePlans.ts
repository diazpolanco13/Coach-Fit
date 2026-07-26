import { useCallback, useEffect, useRef, useState } from 'react'
import { api, type PlanSummary } from '@/lib/api'
import { clearLegacyVolumeRange, peekLegacyVolumeRange } from '@/lib/settings'

/** Lista de planes y sus mutaciones. Vive en el shell, no en la pantalla del
 *  plan: el sidebar los lista y las operaciones se lanzan desde ahí. */
export function usePlans() {
  const [plans, setPlans] = useState<PlanSummary[]>([])
  const [activeId, setActiveId] = useState<number | null>(null)
  const [maxPlans, setMaxPlans] = useState(20)
  /** Se incrementa solo tras una mutación que deba recargar el borrador. Es lo
   *  que evita que un refresco de fondo de `plans` se coma las ediciones en
   *  curso, que es lo que hacía el editor anterior. */
  const [reloadToken, setReloadToken] = useState(0)

  const reload = useCallback(async () => {
    const res = await api.plans()
    setPlans(res.plans)
    setActiveId(res.active_id)
    setMaxPlans(res.max_plans)
    return res
  }, [])

  useEffect(() => {
    reload().catch(() => undefined)
  }, [reload])

  const bump = () => setReloadToken((n) => n + 1)

  // --- Migración del rango de volumen que vivía en localStorage -------------
  const migrating = useRef(false)
  useEffect(() => {
    if (migrating.current || !plans.length) return
    const active = plans.find((p) => p.is_active)
    if (!active) return
    const legacy = peekLegacyVolumeRange()
    if (!legacy) return
    // Solo si el plan sigue con el rango de fábrica: si el usuario ya lo tocó
    // desde la app nueva, manda el plan.
    const untouched = active.goals.base.min === 10 && active.goals.base.max === 20
    if (!untouched || (legacy.min === 10 && legacy.max === 20)) {
      clearLegacyVolumeRange()
      return
    }
    migrating.current = true
    api
      .patchPlan(active.id, { goals: { base: legacy, overrides: active.goals.overrides } })
      // Borrar solo después de que el servidor lo acepte: si falla, las claves
      // siguen ahí y se reintenta en la siguiente carga.
      .then(() => {
        clearLegacyVolumeRange()
        bump()
        return reload()
      })
      .catch(() => {
        migrating.current = false
      })
  }, [plans, reload])

  const create = useCallback(
    async (body: { name: string; gym_id?: number | null; objective?: string | null }) => {
      const created = await api.createPlan(body)
      await reload()
      bump()
      return created
    },
    [reload],
  )

  const duplicate = useCallback(
    async (id: number) => {
      const copy = await api.duplicatePlan(id)
      await reload()
      bump()
      return copy
    },
    [reload],
  )

  /** Re-ancla un plan a otro espacio. Solo el ancla: los dias y los objetivos no
   *  se tocan, que es lo que hace que «el mismo plan en el parque» sea un cambio
   *  de una linea y no una copia a mano. */
  const moveToGym = useCallback(
    async (id: number, gymId: number) => {
      await api.patchPlan(id, { gym_id: gymId })
      await reload()
    },
    [reload],
  )

  const rename = useCallback(
    async (id: number, name: string) => {
      await api.patchPlan(id, { name })
      await reload()
    },
    [reload],
  )

  const activate = useCallback(async (id: number) => {
    const res = await api.activatePlan(id)
    setPlans(res.plans)
    setActiveId(res.active_id)
  }, [])

  const remove = useCallback(async (id: number) => {
    const res = await api.deletePlan(id)
    setPlans(res.plans)
    setActiveId(res.active_id)
    return res
  }, [])

  return {
    plans,
    activeId,
    maxPlans,
    reloadToken,
    reloadPlans: reload,
    createPlan: create,
    duplicatePlan: duplicate,
    movePlanToGym: moveToGym,
    renamePlan: rename,
    activatePlan: activate,
    deletePlan: remove,
  }
}
