import type { Gym } from '@/lib/api'

/** Icono de respaldo por tipo de espacio, para cuando el usuario no eligió uno. */
const GYM_KIND_ICON: Record<string, string> = {
  hogar: '🏠',
  comercial: '🏋',
  outdoor: '🌳',
  temporal: '🧳',
  oficina: '🏢',
}

export const gymIcon = (gym: Pick<Gym, 'icon' | 'kind'>) =>
  gym.icon || GYM_KIND_ICON[gym.kind] || '📍'

export const GYM_KIND_ES: Record<string, string> = {
  hogar: 'Casa',
  comercial: 'Gimnasio comercial',
  outdoor: 'Aire libre / calistenia',
  temporal: 'Temporal (viaje, hotel)',
  oficina: 'Oficina',
}
