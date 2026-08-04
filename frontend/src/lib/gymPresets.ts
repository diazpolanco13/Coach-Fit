import type { Exercise, GymKind, UserEquipment } from '@/lib/api'
import { availableEquipment } from '@/lib/equipment'

/**
 * Inventario típico de cada tipo de espacio.
 *
 * El tipo de espacio (`kind`) solo servía para elegir un icono, así que crear
 * «Parque» obligaba a registrar el material pieza por pieza, un formulario por
 * pieza, antes de que la biblioteca dejara de ofrecer poleas. Y el inventario
 * es justo lo que decide el tamaño del catálogo: con peso corporal solo salen
 * 325 de los 1324 ejercicios, el preset de parque llega a 437 y el de casa a
 * 741 (medido con `EQUIPMENT_UNLOCKS` y el catálogo real).
 *
 * Los presets registran TIPOS, no pesos: el tipo es lo que desbloquea catálogo
 * (`EQUIPMENT_UNLOCKS` en el backend), mientras los kilos concretos solo los
 * sabe el usuario y se añaden después. El preset es un punto de partida
 * editable, no una promesa de que eso es lo que hay.
 */

export type GymPresetItem = { name: string; equipment_type: string }

/** Todos los tipos registrables. Un gym comercial completo se monta con esto
 *  de un clic; desbloquea casi todo el catálogo (1322/1324: quedan hammer y
 *  tire, que no tienen tipo de usuario). */
export const ALL_EQUIPMENT: GymPresetItem[] = [
  { name: 'Mancuernas', equipment_type: 'dumbbell' },
  { name: 'Barras', equipment_type: 'barbell' },
  { name: 'Banco', equipment_type: 'bench' },
  { name: 'Poleas', equipment_type: 'cable' },
  { name: 'Máquinas', equipment_type: 'machine' },
  { name: 'Barra de dominadas', equipment_type: 'pull_up_bar' },
  { name: 'Kettlebells', equipment_type: 'kettlebell' },
  { name: 'Bandas elásticas', equipment_type: 'band' },
  { name: 'Máquinas de cardio', equipment_type: 'cardio_machine' },
  { name: 'Balón medicinal', equipment_type: 'medicine_ball' },
  { name: 'Cuerda', equipment_type: 'rope' },
  { name: 'Fitball', equipment_type: 'stability_ball' },
  { name: 'Rueda abdominal', equipment_type: 'wheel' },
]

export const GYM_PRESETS: Record<GymKind, GymPresetItem[]> = {
  // Casa típica de verdad: lo que suele haber sin montar un gimnasio. Sin
  // kilos (eso se añade aparte) y sin piezas raras del setup de alguien.
  hogar: [
    { name: 'Mancuernas', equipment_type: 'dumbbell' },
    { name: 'Bandas elásticas', equipment_type: 'band' },
    { name: 'Barra de dominadas', equipment_type: 'pull_up_bar' },
    { name: 'Banco', equipment_type: 'bench' },
  ],
  comercial: [
    { name: 'Mancuernas', equipment_type: 'dumbbell' },
    { name: 'Barras', equipment_type: 'barbell' },
    { name: 'Banco', equipment_type: 'bench' },
    { name: 'Poleas', equipment_type: 'cable' },
    { name: 'Máquinas', equipment_type: 'machine' },
    { name: 'Barra de dominadas', equipment_type: 'pull_up_bar' },
    { name: 'Kettlebells', equipment_type: 'kettlebell' },
    { name: 'Bandas elásticas', equipment_type: 'band' },
    { name: 'Máquinas de cardio', equipment_type: 'cardio_machine' },
    { name: 'Balón medicinal', equipment_type: 'medicine_ball' },
    { name: 'Cuerda', equipment_type: 'rope' },
    { name: 'Fitball', equipment_type: 'stability_ball' },
  ],
  // Un parque o un óvalo: barras fijas y lo que lleves encima. El peso corporal
  // entra siempre, sin registrar nada.
  outdoor: [
    { name: 'Barra de dominadas', equipment_type: 'pull_up_bar' },
    { name: 'Bandas elásticas', equipment_type: 'band' },
  ],
  temporal: [{ name: 'Bandas elásticas', equipment_type: 'band' }],
  oficina: [
    { name: 'Bandas elásticas', equipment_type: 'band' },
    { name: 'Fitball', equipment_type: 'stability_ball' },
  ],
}

/** Cuántos ejercicios del catálogo desbloquearía un inventario. Sirve para que
 *  el usuario elija con el número delante, no a ciegas. */
export function reachableCount(
  exercises: Exercise[],
  equipment: Pick<UserEquipment, 'equipment_type'>[],
  unlocks: Record<string, string[]>,
): number {
  const mine = availableEquipment(equipment, unlocks)
  return exercises.reduce((n, e) => n + (mine.has(e.equipment) ? 1 : 0), 0)
}

/** Preset menos lo que el espacio ya tiene: aplicarlo dos veces no duplica
 *  filas ni pisa lo que el usuario registró a mano. */
export function missingFromPreset(kind: GymKind, equipment: UserEquipment[]): GymPresetItem[] {
  const have = new Set(equipment.map((e) => e.equipment_type))
  return GYM_PRESETS[kind].filter((p) => !have.has(p.equipment_type))
}
