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
