/** Traducción de equipamiento. Solo la etiqueta: los valores en inglés siguen
 *  siendo la clave real (vienen del catálogo y se usan para filtrar), así que
 *  nunca deben traducirse en el estado ni en las comparaciones. */

/** Valores de `equipment` del catálogo (los 28 que trae el dataset). */
export const EQUIPMENT_ES: Record<string, string> = {
  'body weight': 'Peso corporal',
  dumbbell: 'Mancuernas',
  barbell: 'Barra',
  'ez barbell': 'Barra EZ',
  'olympic barbell': 'Barra olímpica',
  'trap bar': 'Barra hexagonal',
  cable: 'Polea',
  band: 'Banda elástica',
  'resistance band': 'Banda de resistencia',
  kettlebell: 'Kettlebell',
  'leverage machine': 'Máquina de palanca',
  'smith machine': 'Multipower',
  'sled machine': 'Máquina de empuje',
  assisted: 'Asistido',
  weighted: 'Con lastre',
  'stability ball': 'Fitball',
  'bosu ball': 'Bosu',
  'medicine ball': 'Balón medicinal',
  'wheel roller': 'Rueda abdominal',
  roller: 'Rodillo',
  rope: 'Cuerda',
  hammer: 'Martillo',
  tire: 'Neumático',
  'stationary bike': 'Bicicleta estática',
  'elliptical machine': 'Elíptica',
  'skierg machine': 'SkiErg',
  'stepmill machine': 'Escaladora',
  'upper body ergometer': 'Ergómetro de brazos',
}

/** Tipos que el usuario registra en la pestaña Equipo. */
export const EQUIPMENT_TYPE_ES: Record<string, string> = {
  dumbbell: 'Mancuerna',
  barbell: 'Barra',
  kettlebell: 'Kettlebell',
  band: 'Liga / banda',
  bench: 'Banco',
  pull_up_bar: 'Barra de dominadas',
  wheel: 'Rueda abdominal',
  cable: 'Polea',
  machine: 'Máquina',
  stability_ball: 'Fitball / bosu',
  medicine_ball: 'Balón medicinal',
  rope: 'Cuerda',
  cardio_machine: 'Máquina de cardio',
}

export const equipmentES = (e: string) => EQUIPMENT_ES[e] || e
export const equipmentTypeES = (t: string) => EQUIPMENT_TYPE_ES[t] || t

/** Valores de `equipment` que el usuario puede hacer con lo que tiene
 *  registrado. El peso corporal entra siempre: es una app de entrenar en casa.
 *  `unlocks` viene de `/api/catalog` para no duplicar el mapeo del backend. */
export function availableEquipment(
  equipment: { equipment_type: string }[],
  unlocks: Record<string, string[]>,
): Set<string> {
  const out = new Set<string>(['body weight'])
  for (const eq of equipment) {
    for (const name of unlocks[eq.equipment_type] ?? []) out.add(name)
  }
  return out
}
