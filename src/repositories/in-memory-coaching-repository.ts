import {
  decisions,
  interpretations,
  observations,
  priorities,
} from '../data/coaching.ts'
import { athletes } from '../data/athletes.ts'
import type { Athlete } from '../types/athlete'
import type {
  Decision,
  Interpretation,
  Observation,
  Priority,
} from '../types/coaching'
import type { CoachingRepository } from './coaching-repository'

export interface InMemoryCoachingData {
  athletes: Athlete[]
  observations: Observation[]
  interpretations: Interpretation[]
  priorities: Priority[]
  decisions: Decision[]
}

function requireValue(value: string, field: string, recordId: string) {
  if (!value.trim()) {
    throw new Error(`${field} is required for record ${recordId}`)
  }
}

function validateConfidence(
  confidence: number,
  recordType: string,
  recordId: string,
) {
  if (!Number.isInteger(confidence) || confidence < 1 || confidence > 5) {
    throw new Error(
      `${recordType} ${recordId} confidence must be an integer from 1 to 5`,
    )
  }
}

export class InMemoryCoachingRepository implements CoachingRepository {
  private readonly data: InMemoryCoachingData

  constructor(data: InMemoryCoachingData) {
    this.data = data
    this.validate()
  }

  listAthletes() {
    return [...this.data.athletes]
  }

  getAthleteById(athleteId: string) {
    return this.data.athletes.find((athlete) => athlete.id === athleteId)
  }

  listObservationsForAthlete(athleteId: string) {
    return this.data.observations.filter(
      (observation) => observation.athleteId === athleteId,
    )
  }

  listInterpretationsForAthlete(athleteId: string) {
    return this.data.interpretations.filter(
      (interpretation) => interpretation.athleteId === athleteId,
    )
  }

  listPrioritiesForAthlete(athleteId: string) {
    return this.data.priorities.filter(
      (priority) => priority.athleteId === athleteId,
    )
  }

  listDecisionsForAthlete(athleteId: string) {
    return this.data.decisions.filter(
      (decision) => decision.athleteId === athleteId,
    )
  }

  private validate() {
    const athleteIds = new Set(this.data.athletes.map((athlete) => athlete.id))
    const observationsById = new Map(
      this.data.observations.map((observation) => [observation.id, observation]),
    )
    const interpretationsById = new Map(
      this.data.interpretations.map((interpretation) => [
        interpretation.id,
        interpretation,
      ]),
    )
    const prioritiesById = new Map(
      this.data.priorities.map((priority) => [priority.id, priority]),
    )

    for (const record of [
      ...this.data.observations,
      ...this.data.interpretations,
      ...this.data.priorities,
      ...this.data.decisions,
    ]) {
      if (!athleteIds.has(record.athleteId)) {
        throw new Error(
          `Record ${record.id} references unknown athlete ${record.athleteId}`,
        )
      }
    }

    for (const interpretation of this.data.interpretations) {
      validateConfidence(
        interpretation.confidence,
        'Interpretation',
        interpretation.id,
      )

      for (const observationId of interpretation.observationIds) {
        const observation = observationsById.get(observationId)

        if (!observation) {
          throw new Error(
            `Interpretation ${interpretation.id} references unknown Observation ${observationId}`,
          )
        }

        if (observation.athleteId !== interpretation.athleteId) {
          throw new Error(
            `Interpretation ${interpretation.id} cannot reference an Observation belonging to another athlete`,
          )
        }
      }
    }

    for (const priority of this.data.priorities) {
      for (const interpretationId of priority.interpretationIds) {
        const interpretation = interpretationsById.get(interpretationId)

        if (!interpretation) {
          throw new Error(
            `Priority ${priority.id} references unknown Interpretation ${interpretationId}`,
          )
        }

        if (interpretation.athleteId !== priority.athleteId) {
          throw new Error(
            `Priority ${priority.id} cannot reference an Interpretation belonging to another athlete`,
          )
        }
      }
    }

    for (const decision of this.data.decisions) {
      validateConfidence(decision.confidence, 'Decision', decision.id)

      const priority = prioritiesById.get(decision.priorityId)

      if (!priority) {
        throw new Error(
          `Decision ${decision.id} references unknown Priority ${decision.priorityId}`,
        )
      }

      if (priority.athleteId !== decision.athleteId) {
        throw new Error(
          `Decision ${decision.id} cannot reference a Priority belonging to another athlete`,
        )
      }

      if (decision.status === 'active') {
        requireValue(decision.rationale, 'rationale', decision.id)
        requireValue(decision.ownerId, 'ownerId', decision.id)
        requireValue(decision.reviewDueAt, 'reviewDueAt', decision.id)
      }
    }
  }
}

export const coachingRepository = new InMemoryCoachingRepository({
  athletes,
  observations,
  interpretations,
  priorities,
  decisions,
})
