import type { VolumeStatus } from '@/lib/volume'

/**
 * Cómo se pinta el volumen. Vive aparte porque lo comparten la vista de la
 * semana (`VolumePanel`) y la del día (`DayStimulusPanel`): son la misma
 * medida a dos escalas, y si los colores se separan el usuario tiene que
 * aprender dos códigos para lo mismo.
 *
 * El color dice **estado** —el semáforo de siempre, no el naranja de marca— y
 * el tono dice **origen**: `fill` para las series directas, `soft` para las
 * indirectas. Lo que pasa del tope se pinta con `OVER_*`, nunca el resto.
 */

export const VOLUME_BAR: Record<VolumeStatus, { fill: string; soft: string }> = {
  low: { fill: 'bg-warning', soft: 'bg-warning/45' },
  ok: { fill: 'bg-success', soft: 'bg-success/45' },
  // Pasado del tope: verde hasta el tope —el objetivo está cumplido— y rojo
  // solo el exceso, que es lo único que hay que corregir.
  high: { fill: 'bg-success', soft: 'bg-success/45' },
  // Un músculo que solo se arrastra de otros ejercicios no tiene objetivo que
  // cumplir, así que no entra en el semáforo: gris.
  incidental: { fill: 'bg-muted-foreground/50', soft: 'bg-muted-foreground/25' },
}

/** Texto de la cifra. `low` usa la variante oscurecida: el ámbar de la barra no
 *  llega al contraste que pide un texto pequeño. */
export const VOLUME_TEXT: Record<VolumeStatus, string> = {
  low: 'text-warning-strong',
  ok: 'text-foreground',
  high: 'text-destructive',
  incidental: 'text-muted-foreground',
}

/** El exceso que pone la fuente que se está midiendo (este día, o el plan). */
export const OVER_FILL = 'bg-destructive/85'
/** El exceso que ponen los demás: mismo rojo, más apagado —el aviso es del
 *  músculo, pero la culpa no es de lo que se está mirando—. */
export const OVER_SOFT = 'bg-destructive/35'

/** Hueco entre lo que hay y el mínimo. */
export const SHORTFALL = 'bg-warning/20'
/** Banda del rango objetivo, de mínimo a tope. */
export const GOAL_BAND = 'bg-foreground/[0.07]'
/** Muesca del mínimo. */
export const MIN_TICK = 'bg-foreground/45'
