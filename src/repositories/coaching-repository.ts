import type { Athlete } from '../types/athlete'
import type {
  Confidence,
  Decision,
  Interpretation,
  InterpretationStatus,
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

export interface CreateInterpretationInput {
  athleteId: string
  observationIds: string[]
  summary: string
  confidence: Confidence
  createdBy: string
}

export interface UpdateInterpretationInput {
  id: string
  observationIds: string[]
  summary: string
  confidence: Confidence
  status: InterpretationStatus
  updatedBy: string
}

export interface CoachingRepository {
  listAthletes(): Athlete[]
  getAthleteById(athleteId: string): Athlete | undefined
  listObservationsForAthlete(athleteId: string): Observation[]
  createObservation(input: CreateObservationInput): Observation
  updateObservation(input: UpdateObservationInput): Observation
  listInterpretationsForAthlete(athleteId: string): Interpretation[]
  getInterpretationsByAthleteId(athleteId: string): Interpretation[]
  createInterpretation(input: CreateInterpretationInput): Interpretation
  updateInterpretation(input: UpdateInterpretationInput): Interpretation
  listPrioritiesForAthlete(athleteId: string): Priority[]
  listDecisionsForAthlete(athleteId: string): Decision[]
}
