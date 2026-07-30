import type { Exercise, Plan } from '@/lib/api'
import { DEFAULT_INDIRECT_WEIGHT, formatSets, weeklyVolume, type MuscleVolume } from '@/lib/volume'

/** Mismos topes que el radar de Hoy: menos de 3 ejes no forma polígono. */
export const MIN_COMPARE_AXES = 3
export const MAX_COMPARE_AXES = 8

export type PlanVolumeProfile = {
  plan: Plan
  volumes: MuscleVolume[]
  /** Series totales (directo + indirecto) de músculos programados. */
  totalSets: number
  trainingDays: number
  topMuscles: Array<{ muscle: string; sets: number }>
}

export type CompareRadarRow = {
  muscle: string
  /** Series por plan: clave = `p${planId}`. */
  [planKey: string]: string | number
}

export function planDataKey(planId: number): string {
  return `p${planId}`
}

export function buildPlanProfile(
  plan: Plan,
  exMap: Map<string, Exercise>,
): PlanVolumeProfile {
  const volumes = weeklyVolume(plan.days, exMap, plan.indirect_weight ?? DEFAULT_INDIRECT_WEIGHT)
  const programmed = volumes.filter((v) => v.programmed)
  const trainingDays = plan.days.filter((d) => d.items.length > 0).length
  return {
    plan,
    volumes,
    totalSets: programmed.reduce((n, v) => n + v.total, 0),
    trainingDays,
    topMuscles: programmed.slice(0, 3).map((v) => ({ muscle: v.muscle, sets: v.total })),
  }
}

/** Ejes = músculos con más volumen agregado entre los perfiles visibles. */
export function pickCompareAxes(profiles: PlanVolumeProfile[]): string[] {
  const acc = new Map<string, number>()
  for (const p of profiles) {
    for (const v of p.volumes) {
      if (!v.programmed) continue
      acc.set(v.muscle, (acc.get(v.muscle) ?? 0) + v.total)
    }
  }
  return [...acc.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_COMPARE_AXES)
    .map(([muscle]) => muscle)
}

export function buildCompareRadarRows(
  profiles: PlanVolumeProfile[],
  axes: string[],
): { rows: CompareRadarRow[]; maxValue: number } {
  let maxValue = 1
  const rows: CompareRadarRow[] = axes.map((muscle) => {
    const row: CompareRadarRow = { muscle }
    for (const p of profiles) {
      const total = p.volumes.find((v) => v.muscle === muscle)?.total ?? 0
      row[planDataKey(p.plan.id)] = total
      if (total > maxValue) maxValue = total
    }
    return row
  })
  return { rows, maxValue }
}

/** Radar de un solo plan sobre los mismos ejes (comparables entre tarjetas). */
export function buildSoloRadarRows(
  profile: PlanVolumeProfile,
  axes: string[],
): Array<{ muscle: string; sets: number }> {
  return axes.map((muscle) => ({
    muscle,
    sets: profile.volumes.find((v) => v.muscle === muscle)?.total ?? 0,
  }))
}

export function formatTopMuscles(top: PlanVolumeProfile['topMuscles']): string {
  if (!top.length) return 'Sin trabajo muscular programado'
  return top.map((t) => `${t.muscle} ${formatSets(t.sets)}`).join(' · ')
}
