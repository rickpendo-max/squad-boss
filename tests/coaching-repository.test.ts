import assert from 'node:assert/strict'
import test from 'node:test'

import { getInitialAthlete } from '../src/context/athlete-selection.ts'
import { athletes } from '../src/data/athletes.ts'
import {
  InMemoryCoachingRepository,
  coachingRepository,
} from '../src/repositories/in-memory-coaching-repository.ts'
import type {
  Confidence,
  Decision,
  Interpretation,
  Observation,
  Priority,
} from '../src/types/coaching/index.ts'

const [sam, maddie] = athletes

const observation: Observation = {
  id: 'observation-1',
  athleteId: sam.id,
  status: 'active',
  createdAt: '2026-07-20T00:00:00Z',
  createdBy: 'coach-1',
  updatedAt: '2026-07-20T00:00:00Z',
  updatedBy: 'coach-1',
  occurredAt: '2026-07-20T00:00:00Z',
  sourceType: 'coach',
  contextType: 'training',
  summary: 'Test observation',
}

const interpretation: Interpretation = {
  id: 'interpretation-1',
  athleteId: sam.id,
  status: 'active',
  createdAt: '2026-07-20T00:00:00Z',
  createdBy: 'coach-1',
  updatedAt: '2026-07-20T00:00:00Z',
  updatedBy: 'coach-1',
  observationIds: [observation.id],
  summary: 'Test interpretation',
  confidence: 3,
}

const priority: Priority = {
  id: 'priority-1',
  athleteId: sam.id,
  status: 'active',
  createdAt: '2026-07-20T00:00:00Z',
  createdBy: 'coach-1',
  updatedAt: '2026-07-20T00:00:00Z',
  updatedBy: 'coach-1',
  interpretationIds: [interpretation.id],
  title: 'Test priority',
  rationale: 'Test rationale',
  rank: 1,
}

const decision: Decision = {
  id: 'decision-1',
  athleteId: sam.id,
  status: 'active',
  createdAt: '2026-07-20T00:00:00Z',
  createdBy: 'coach-1',
  updatedAt: '2026-07-20T00:00:00Z',
  updatedBy: 'coach-1',
  priorityId: priority.id,
  title: 'Test decision',
  rationale: 'Test rationale',
  confidence: 3,
  ownerId: 'coach-1',
  reviewDueAt: '2026-08-20T00:00:00Z',
}

function createRepository(overrides: {
  observations?: Observation[]
  interpretations?: Interpretation[]
  priorities?: Priority[]
  decisions?: Decision[]
} = {}) {
  return new InMemoryCoachingRepository({
    athletes: [sam, maddie],
    observations: overrides.observations ?? [observation],
    interpretations: overrides.interpretations ?? [interpretation],
    priorities: overrides.priorities ?? [priority],
    decisions: overrides.decisions ?? [decision],
  })
}

test('returns athletes through the repository boundary', () => {
  assert.deepEqual(
    coachingRepository.listAthletes().map((athlete) => athlete.id),
    athletes.map((athlete) => athlete.id),
  )
  assert.equal(coachingRepository.getAthleteById(sam.id)?.id, sam.id)
})

test('retrieves coaching records by athlete ID', () => {
  const repository = createRepository()

  assert.deepEqual(repository.listObservationsForAthlete(sam.id), [observation])
  assert.deepEqual(repository.listInterpretationsForAthlete(sam.id), [
    interpretation,
  ])
  assert.deepEqual(repository.listPrioritiesForAthlete(sam.id), [priority])
  assert.deepEqual(repository.listDecisionsForAthlete(sam.id), [decision])
  assert.deepEqual(repository.listObservationsForAthlete(maddie.id), [])
})

test('rejects an Interpretation linked to another athlete Observation', () => {
  const invalid = { ...interpretation, athleteId: maddie.id }

  assert.throws(
    () => createRepository({ interpretations: [invalid] }),
    /another athlete/,
  )
})

test('rejects a Priority linked to another athlete Interpretation', () => {
  const invalid = { ...priority, athleteId: maddie.id }

  assert.throws(
    () => createRepository({ priorities: [invalid], decisions: [] }),
    /another athlete/,
  )
})

test('rejects a Decision linked to another athlete Priority', () => {
  const invalid = { ...decision, athleteId: maddie.id }

  assert.throws(
    () => createRepository({ decisions: [invalid] }),
    /another athlete/,
  )
})

test('rejects confidence outside the 1 to 5 range', () => {
  const invalid = {
    ...interpretation,
    confidence: 6 as Confidence,
  }

  assert.throws(
    () => createRepository({ interpretations: [invalid], priorities: [], decisions: [] }),
    /integer from 1 to 5/,
  )
})

test('rejects active Decisions missing required lifecycle values', () => {
  for (const invalid of [
    { ...decision, ownerId: '' },
    { ...decision, rationale: '' },
    { ...decision, reviewDueAt: '' },
  ]) {
    assert.throws(() => createRepository({ decisions: [invalid] }), /required/)
  }
})

test('preserves first-athlete default selection behaviour', () => {
  assert.equal(getInitialAthlete(coachingRepository).id, athletes[0].id)
})

function createObservationRepository(existingObservations: Observation[] = []) {
  let timestampIndex = 0
  const timestamps = [
    '2026-07-21T00:00:00Z',
    '2026-07-22T00:00:00Z',
  ]

  return new InMemoryCoachingRepository(
    {
      athletes: [sam, maddie],
      observations: existingObservations,
      interpretations: [],
      priorities: [],
      decisions: [],
    },
    {
      createId: () => 'created-observation',
      now: () => timestamps[timestampIndex++] ?? timestamps.at(-1)!,
    },
  )
}

const validObservationInput = {
  athleteId: sam.id,
  occurredAt: '2026-07-20T06:00:00Z',
  sourceType: 'coach' as const,
  contextType: 'training' as const,
  summary: 'Synthetic repository test observation',
  createdBy: 'coach-1',
}

test('creates an Observation through the repository', () => {
  const repository = createObservationRepository()
  const created = repository.createObservation(validObservationInput)

  assert.equal(created.id, 'created-observation')
  assert.equal(created.status, 'active')
  assert.equal(created.createdAt, '2026-07-21T00:00:00Z')
  assert.equal(created.updatedAt, created.createdAt)
  assert.deepEqual(repository.listObservationsForAthlete(sam.id), [created])
})

test('rejects Observation creation when required values are empty', () => {
  for (const invalid of [
    { ...validObservationInput, summary: ' ' },
    { ...validObservationInput, occurredAt: '' },
    { ...validObservationInput, sourceType: '' as never },
    { ...validObservationInput, contextType: '' as never },
  ]) {
    const repository = createObservationRepository()
    assert.throws(() => repository.createObservation(invalid), /required/)
  }
})

test('returns Observation history newest first', () => {
  const older = {
    ...observation,
    id: 'older-observation',
    occurredAt: '2026-07-19T00:00:00Z',
  }
  const newer = {
    ...observation,
    id: 'newer-observation',
    occurredAt: '2026-07-21T00:00:00Z',
  }
  const repository = createObservationRepository([older, newer])

  assert.deepEqual(
    repository
      .listObservationsForAthlete(sam.id)
      .map((record) => record.id),
    ['newer-observation', 'older-observation'],
  )
})

test('updates an existing Observation while preserving its ownership', () => {
  const repository = createObservationRepository([{ ...observation }])
  const updated = repository.updateObservation({
    id: observation.id,
    occurredAt: '2026-07-21T06:00:00Z',
    sourceType: 'athlete',
    contextType: 'wellbeing',
    summary: 'Updated synthetic observation',
    status: 'superseded',
    updatedBy: 'coach-2',
  })

  assert.equal(updated.athleteId, observation.athleteId)
  assert.equal(updated.createdAt, observation.createdAt)
  assert.equal(updated.createdBy, observation.createdBy)
  assert.equal(updated.updatedAt, '2026-07-21T00:00:00Z')
  assert.equal(updated.updatedBy, 'coach-2')
  assert.equal(updated.summary, 'Updated synthetic observation')
  assert.equal(updated.status, 'superseded')
})
