import type { Athlete } from '../types/athlete'
import type {
  Decision,
  Interpretation,
  Observation,
  ObservationContextType,
  ObservationSourceType,
  ObservationStatus,
  Priority,
} from '../types/coaching'

export interface CreateObservationInput {
  athleteId: string
  occurredAt: string
  sourceType: ObservationSourceType
  contextType: ObservationContextType
  summary: string
  createdBy: string
}

export interface UpdateObservationInput {
  id: string
  occurredAt: string
  sourceType: ObservationSourceType
  contextType: ObservationContextType
  summary: string
  status: ObservationStatus
  updatedBy: string
}

export interface CoachingRepository {
  listAthletes(): Athlete[]
  getAthleteById(athleteId: string): Athlete | undefined
  listObservationsForAthlete(athleteId: string): Observation[]
  createObservation(input: CreateObservationInput): Observation
  updateObservation(input: UpdateObservationInput): Observation
  listInterpretationsForAthlete(athleteId: string): Interpretation[]
  listPrioritiesForAthlete(athleteId: string): Priority[]
  listDecisionsForAthlete(athleteId: string): Decision[]
}
