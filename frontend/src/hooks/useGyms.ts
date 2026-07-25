import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, type Gym } from '@/lib/api'
import { getActiveGymId, setActiveGymId } from '@/lib/settings'

/** Espacios de entrenamiento y cuál está seleccionado.
 *
 *  El espacio activo es preferencia de cliente (localStorage), no estado de
 *  servidor: hacerlo servidor sería una escritura por cada cambio y una carrera
 *  con el ancla del plan. El servidor solo dice cuál usaría él por defecto
 *  (`effective_gym_id`), que es a lo que se cae la primera vez. */
export function useGyms() {
  const [gyms, setGyms] = useState<Gym[]>([])
  const [maxGyms, setMaxGyms] = useState(10)
  const [activeGymId, setActive] = useState<number | null>(() => getActiveGymId())

  const reload = useCallback(async () => {
    const res = await api.gyms()
    setGyms(res.gyms)
    setMaxGyms(res.max_gyms)
    setActive((current) => {
      // Si el espacio guardado ya no existe (borrado desde otro sitio), se cae
      // al que el servidor considera en efecto.
      const stillThere = current != null && res.gyms.some((g) => g.id === current)
      return stillThere ? current : res.effective_gym_id
    })
    return res.gyms
  }, [])

  useEffect(() => {
    reload().catch(() => undefined)
  }, [reload])

  const setActiveGym = useCallback((id: number) => {
    setActive(id)
    setActiveGymId(id)
  }, [])

  const activeGym = useMemo(
    () => gyms.find((g) => g.id === activeGymId) ?? gyms[0] ?? null,
    [gyms, activeGymId],
  )

  // Memoizado en el hook y no en el consumidor: `availableEquipment` devuelve un
  // Set nuevo en cada llamada y su memo depende de la identidad de este array.
  const activeEquipment = useMemo(() => activeGym?.equipment ?? [], [activeGym])

  return { gyms, maxGyms, activeGym, activeEquipment, setActiveGym, reloadGyms: reload }
}
