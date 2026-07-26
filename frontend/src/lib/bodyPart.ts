/** Traducción de `body_part` del catálogo. La clave en inglés es la que filtra;
 *  la etiqueta solo se muestra. */

export const BODY_PART_ES: Record<string, string> = {
  chest: 'Pecho',
  back: 'Espalda',
  shoulders: 'Hombros',
  'upper arms': 'Brazos (superior)',
  'lower arms': 'Antebrazos',
  'upper legs': 'Piernas (superior)',
  'lower legs': 'Piernas (inferior)',
  waist: 'Cintura',
  neck: 'Cuello',
  cardio: 'Cardio',
}

export const bodyPartES = (p: string) => BODY_PART_ES[p] || p
