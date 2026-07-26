import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { toISO } from "@/lib/dates"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** El día de hoy en el calendario del usuario. Antes salía de
 *  `toISOString()`, que es UTC: en Caracas (UTC-4), a partir de las 20:00 esto
 *  devolvía el día siguiente y «Hoy» se adelantaba media tarde. */
export function todayISO() {
  return toISO(new Date())
}
