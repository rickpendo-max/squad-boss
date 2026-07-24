import {
  decisions,
  interpretations,
  observations,
  priorities,
} from '../data/coaching.ts'
import { athletes } from '../data/athletes.ts'
import { priorityCategories } from '../types/coaching/priority.ts'
import type { Athlete } from '../types/athlete'
import type {
  Decision,
  Interpretation,
  Observation,
  Priority,
} from '../types/coaching'
import type {
  CoachingRepository,
  CreateInterpretationInput,
  CreateObservationInput,
  CreatePriorityInput,
  UpdateInterpretationInput,
  UpdateObservationInput,
  UpdatePriorityInput,
} from './coaching-repository'

export interface InMemoryCoachingData {
  athletes: Athlete[]
  observations: Observation[]
  interpretations: Interpretation[]
  priorities: Priority[]
  decisions: Decision[]
}

interface InMemoryCoachingDependencies {
  createId: () => string
  now: () => string
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

function validateObservation(
  observation: Pick<
    Observation,
    | 'id'
    | 'athleteId'
    | 'occurredAt'
    | 'sourceType'
    | 'contextType'
    | 'summary'
    | 'createdBy'
    | 'updatedBy'
  >,
) {
  requireValue(observation.athleteId, 'athleteId', observation.id)
  requireValue(observation.occurredAt, 'occurredAt', observation.id)
  requireValue(observation.sourceType, 'sourceType', observation.id)
  requireValue(observation.contextType, 'contextType', observation.id)
  requireValue(observation.summary, 'summary', observation.id)
  requireValue(observation.createdBy, 'createdBy', observation.id)
  requireValue(observation.updatedBy, 'updatedBy', observation.id)
}

function validateInterpretationContent(
  interpretation: Pick<
    Interpretation,
    | 'id'
    | 'athleteId'
    | 'observationIds'
    | 'summary'
    | 'confidence'
    | 'createdBy'
    | 'updatedBy'
  >,
) {
  requireValue(interpretation.athleteId, 'athleteId', interpretation.id)
  requireValue(interpretation.summary, 'summary', interpretation.id)
  requireValue(interpretation.createdBy, 'createdBy', interpretation.id)
  requireValue(interpretation.updatedBy, 'updatedBy', interpretation.id)

  if (interpretation.observationIds.length === 0) {
    throw new Error(
      `At least one Observation is required for Interpretation ${interpretation.id}`,
    )
  }

  validateConfidence(
    interpretation.confidence,
    'Interpretation',
    interpretation.id,
  )
}

function validatePriorityContent(priority: Priority) {
  requireValue(priority.athleteId, 'athleteId', priority.id)
  requireValue(priority.focus, 'focus', priority.id)
  requireValue(priority.rationale, 'rationale', priority.id)
  requireValue(priority.category, 'category', priority.id)
  requireValue(priority.reviewAt, 'reviewAt', priority.id)
  requireValue(priority.createdBy, 'createdBy', priority.id)
  requireValue(priority.updatedBy, 'updatedBy', priority.id)

  if (priority.interpretationIds.length === 0) {
    throw new Error(
      `At least one Interpretation is required for Priority ${priority.id}`,
    )
  }

  if (
    !priorityCategories.includes(
      priority.category as (typeof priorityCategories)[number],
    )
  ) {
    throw new Error(`Priority ${priority.id} category is invalid`)
  }

  if (!Number.isInteger(priority.rank) || priority.rank < 1 || priority.rank > 3) {
    throw new Error(`Priority ${priority.id} rank must be 1, 2 or 3`)
  }

  if (Number.isNaN(Date.parse(priority.reviewAt))) {
    throw new Error(`Priority ${priority.id} reviewAt must be a valid date`)
  }
}

export class InMemoryCoachingRepository implements CoachingRepository {
  private readonly data: InMemoryCoachingData
  private readonly dependencies: InMemoryCoachingDependencies

  constructor(
    data: InMemoryCoachingData,
    dependencies: InMemoryCoachingDependencies = {
      createId: () => crypto.randomUUID(),
      now: () => new Date().toISOString(),
    },
  ) {
    this.data = data
    this.dependencies = dependencies
    this.validate()
  }

  listAthletes() {
    return [...this.data.athletes]
  }

  getAthleteById(athleteId: string) {
    return this.data.athletes.find((athlete) => athlete.id === athleteId)
  }

  listObservationsForAthlete(athleteId: string) {
    return this.data.observations
      .filter((observation) => observation.athleteId === athleteId)
      .toSorted(
        (left, right) =>
          right.occurredAt.localeCompare(left.occurredAt) ||
          right.createdAt.localeCompare(left.createdAt),
      )
  }

  createObservation(input: CreateObservationInput) {
    const timestamp = this.dependencies.now()
    const observation: Observation = {
      ...input,
      id: this.dependencies.createId(),
      status: 'active',
      createdAt: timestamp,
      updatedAt: timestamp,
      updatedBy: input.createdBy,
    }

    validateObservation(observation)
    this.requireAthlete(observation.athleteId, observation.id)
    this.data.observations.push(observation)

    return observation
  }

  updateObservation(input: UpdateObservationInput) {
    const index = this.data.observations.findIndex(
      (observation) => observation.id === input.id,
    )

    if (index === -1) {
      throw new Error(`Observation ${input.id} was not found`)
    }

    const observation: Observation = {
      ...this.data.observations[index],
      ...input,
      updatedAt: this.dependencies.now(),
    }

    validateObservation(observation)
    this.requireAthlete(observation.athleteId, observation.id)
    this.data.observations[index] = observation

    return observation
  }

  listInterpretationsForAthlete(athleteId: string) {
    return this.getInterpretationsByAthleteId(athleteId)
  }

  getInterpretationsByAthleteId(athleteId: string) {
    return this.data.interpretations
      .filter((interpretation) => interpretation.athleteId === athleteId)
      .toSorted((left, right) =>
        right.createdAt.localeCompare(left.createdAt),
      )
  }

  createInterpretation(input: CreateInterpretationInput) {
    const timestamp = this.dependencies.now()
    const interpretation: Interpretation = {
      ...input,
      observationIds: [...input.observationIds],
      id: this.dependencies.createId(),
      status: 'active',
      createdAt: timestamp,
      updatedAt: timestamp,
      updatedBy: input.createdBy,
    }

    validateInterpretationContent(interpretation)
    this.requireAthlete(interpretation.athleteId, interpretation.id)
    this.validateInterpretationObservations(interpretation)
    this.data.interpretations.push(interpretation)

    return interpretation
  }

  updateInterpretation(input: UpdateInterpretationInput) {
    const index = this.data.interpretations.findIndex(
      (interpretation) => interpretation.id === input.id,
    )

    if (index === -1) {
      throw new Error(`Interpretation ${input.id} was not found`)
    }

    const interpretation: Interpretation = {
      ...this.data.interpretations[index],
      ...input,
      observationIds: [...input.observationIds],
      updatedAt: this.dependencies.now(),
    }

    validateInterpretationContent(interpretation)
    this.requireAthlete(interpretation.athleteId, interpretation.id)
    this.validateInterpretationObservations(interpretation)
    this.data.interpretations[index] = interpretation

    return interpretation
  }

  listPrioritiesForAthlete(athleteId: string) {
    return this.getPrioritiesByAthleteId(athleteId)
  }

  getPrioritiesByAthleteId(athleteId: string) {
    return this.data.priorities
      .filter((priority) => priority.athleteId === athleteId)
      .toSorted((left, right) => {
        if (left.status === 'active' && right.status !== 'active') return -1
        if (left.status !== 'active' && right.status === 'active') return 1
        if (left.status === 'active' && right.status === 'active') {
          return left.rank - right.rank
        }

        return (
          right.updatedAt.localeCompare(left.updatedAt) ||
          left.id.localeCompare(right.id)
        )
      })
      .map((priority) => ({
        ...priority,
        interpretationIds: [...priority.interpretationIds],
      }))
  }

  createPriority(input: CreatePriorityInput) {
    const timestamp = this.dependencies.now()
    const priority: Priority = {
      ...input,
      interpretationIds: [...input.interpretationIds],
      id: this.dependencies.createId(),
      status: 'active',
      createdAt: timestamp,
      updatedAt: timestamp,
      updatedBy: input.createdBy,
    }

    validatePriorityContent(priority)
    this.requireAthlete(priority.athleteId, priority.id)
    this.validatePriorityInterpretations(priority)
    this.validateActivePrioritySet(priority)
    this.data.priorities.push(priority)

    return { ...priority, interpretationIds: [...priority.interpretationIds] }
  }

  updatePriority(priorityId: string, input: UpdatePriorityInput) {
    const index = this.data.priorities.findIndex(
      (priority) => priority.id === priorityId,
    )

    if (index === -1) {
      throw new Error(`Priority ${priorityId} was not found`)
    }

    const priority: Priority = {
      ...this.data.priorities[index],
      ...input,
      interpretationIds: [...input.interpretationIds],
      updatedAt: this.dependencies.now(),
    }

    validatePriorityContent(priority)
    this.requireAthlete(priority.athleteId, priority.id)
    this.validatePriorityInterpretations(priority)
    this.validateActivePrioritySet(priority, priorityId)
    this.data.priorities[index] = priority

    return { ...priority, interpretationIds: [...priority.interpretationIds] }
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

    for (const observation of this.data.observations) {
      validateObservation(observation)
    }

    for (const interpretation of this.data.interpretations) {
      validateInterpretationContent(interpretation)
      this.validateInterpretationObservations(
        interpretation,
        observationsById,
      )
    }

    for (const priority of this.data.priorities) {
      validatePriorityContent(priority)
      this.validatePriorityInterpretations(priority, interpretationsById)
      this.validateActivePrioritySet(priority, priority.id)
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

  private requireAthlete(athleteId: string, recordId: string) {
    if (!this.data.athletes.some((athlete) => athlete.id === athleteId)) {
      throw new Error(
        `Record ${recordId} references unknown athlete ${athleteId}`,
      )
    }
  }

  private validateInterpretationObservations(
    interpretation: Interpretation,
    observationsById = new Map(
      this.data.observations.map((observation) => [
        observation.id,
        observation,
      ]),
    ),
  ) {
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

  private validatePriorityInterpretations(
    priority: Priority,
    interpretationsById = new Map(
      this.data.interpretations.map((interpretation) => [
        interpretation.id,
        interpretation,
      ]),
    ),
  ) {
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

  private validateActivePrioritySet(
    priority: Priority,
    excludedPriorityId?: string,
  ) {
    if (priority.status !== 'active') return

    const otherActivePriorities = this.data.priorities.filter(
      (existing) =>
        existing.athleteId === priority.athleteId &&
        existing.status === 'active' &&
        existing.id !== excludedPriorityId,
    )

    if (otherActivePriorities.length >= 3) {
      throw new Error(
        `Athlete ${priority.athleteId} cannot have more than three active Priorities`,
      )
    }

    if (
      otherActivePriorities.some((existing) => existing.rank === priority.rank)
    ) {
      throw new Error(
        `Athlete ${priority.athleteId} already has an active Priority at rank ${priority.rank}`,
      )
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
