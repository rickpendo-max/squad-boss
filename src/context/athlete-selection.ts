import type { CoachingRepository } from '../repositories/coaching-repository'

export function getInitialAthlete(repository: CoachingRepository) {
  const athlete = repository.listAthletes()[0]

  if (!athlete) {
    throw new Error('At least one athlete is required')
  }

  return athlete
}
