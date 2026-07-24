import type { Athlete } from '../types/athlete'
import type {
  Decision,
  Interpretation,
  Observation,
  Priority,
} from '../types/coaching'

export interface CoachingRepository {
  listAthletes(): Athlete[]
  getAthleteById(athleteId: string): Athlete | undefined
  listObservationsForAthlete(athleteId: string): Observation[]
  listInterpretationsForAthlete(athleteId: string): Interpretation[]
  listPrioritiesForAthlete(athleteId: string): Priority[]
  listDecisionsForAthlete(athleteId: string): Decision[]
}
