import type { Exercise, PlanGoals } from '@/lib/api'
import {
  EXPERIENCE_TO_MAX_DIFFICULTY,
  exerciseDifficulty,
  type Experience,
} from '@/lib/anatomy'
import { muscleES } from '@/lib/muscle'
import { goalFor, type MuscleVolume } from '@/lib/volume'

/** 0–100: qué tan bien encaja el ejercicio con huecos del plan y el nivel. */
export function fitScore(
  ex: Exercise,
  volumes: MuscleVolume[],
  goals: PlanGoals,
  experience: Experience,
): number {
  let score = 50
  const muscle = muscleES(ex.target)
  const vol = volumes.find((v) => v.muscle === muscle)
  const goal = goalFor(goals, muscle)
  const total = vol?.total ?? 0

  if (total < goal.min) score += 25
  else if (total >= goal.max) score -= 30
  else score += 5

  const prioritized = goals.overrides.some((o) => o.muscle === muscle)
  if (prioritized && total < goal.min) score += 10

  const maxDiff = EXPERIENCE_TO_MAX_DIFFICULTY[experience]
  const diff = exerciseDifficulty(ex)
  if (diff > maxDiff + 1) score -= 35
  else if (diff > maxDiff) score -= 15
  else if (diff === maxDiff) score += 5

  return Math.max(0, Math.min(100, score))
}

export function fitLabel(score: number): 'encaja' | 'ok' | 'alto' | null {
  if (score >= 70) return 'encaja'
  if (score <= 30) return 'alto'
  return null
}
