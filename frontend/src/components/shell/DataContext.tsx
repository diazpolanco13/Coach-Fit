import { createContext, useContext } from 'react'
import type { Exercise, Gym, UserEquipment, WeekDay } from '@/lib/api'

/** Datos que cambian raras veces. Va separado de NavContext a propósito: si
 *  fueran uno solo, cada navegación re-renderizaría a todos los consumidores
 *  del catálogo de 1324 ejercicios y el sidebar iría a tirones en el móvil. */
export type DataValue = {
  exercises: Exercise[]
  equipmentUnlocks: Record<string, string[]>
  gyms: Gym[]
  activeGym: Gym | null
  maxGyms: number
  setActiveGym: (id: number) => void
  reloadGyms: () => Promise<Gym[]>
  /** Inventario del espacio activo, memoizado: si se construyera un array nuevo
   *  en cada render, el memo de `availableEquipment` nunca acertaría y el
   *  filtrado recorrería los 1324 ejercicios en cada pulsación. */
  activeEquipment: UserEquipment[]
  openGuide: (ex: Exercise, cardio?: import('@/lib/cardio').CardioGuideContext | null) => void
  startTraining: (day: WeekDay) => void
}

export const DataContext = createContext<DataValue | null>(null)

export function useData(): DataValue {
  const value = useContext(DataContext)
  if (!value) throw new Error('useData fuera de DataProvider')
  return value
}
