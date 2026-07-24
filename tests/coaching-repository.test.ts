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
import type {
  BenchmarkProfile,
  PerformanceResult,
} from '../src/types/performance/index.ts'

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
  focus: 'Test priority',
  rationale: 'Test rationale',
  category: 'performance',
  rank: 1,
  reviewAt: '2026-08-20T00:00:00Z',
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

const maddieObservation: Observation = {
  ...observation,
  id: 'maddie-observation',
  athleteId: maddie.id,
}

function createInterpretationRepository(
  existingInterpretations: Interpretation[] = [],
) {
  let timestampIndex = 0
  const timestamps = [
    '2026-07-23T00:00:00Z',
    '2026-07-24T00:00:00Z',
  ]

  return new InMemoryCoachingRepository(
    {
      athletes: [sam, maddie],
      observations: [observation, maddieObservation],
      interpretations: existingInterpretations,
      priorities: [],
      decisions: [],
    },
    {
      createId: () => 'created-interpretation',
      now: () => timestamps[timestampIndex++] ?? timestamps.at(-1)!,
    },
  )
}

const validInterpretationInput = {
  athleteId: sam.id,
  observationIds: [observation.id],
  summary: 'Synthetic repository test interpretation',
  confidence: 4 as const,
  createdBy: 'coach-1',
}

test('creates an Interpretation through the repository', () => {
  const repository = createInterpretationRepository()
  const created = repository.createInterpretation(validInterpretationInput)

  assert.equal(created.id, 'created-interpretation')
  assert.equal(created.status, 'active')
  assert.deepEqual(created.observationIds, [observation.id])
  assert.equal(created.createdAt, '2026-07-23T00:00:00Z')
  assert.equal(created.updatedAt, created.createdAt)
  assert.deepEqual(repository.getInterpretationsByAthleteId(sam.id), [created])
})

test('rejects an Interpretation without a supporting Observation', () => {
  const repository = createInterpretationRepository()

  assert.throws(
    () =>
      repository.createInterpretation({
        ...validInterpretationInput,
        observationIds: [],
      }),
    /At least one Observation/,
  )
})

test('rejects an Interpretation referencing a missing Observation', () => {
  const repository = createInterpretationRepository()

  assert.throws(
    () =>
      repository.createInterpretation({
        ...validInterpretationInput,
        observationIds: ['missing-observation'],
      }),
    /unknown Observation/,
  )
})

test('rejects an Interpretation referencing another athlete Observation', () => {
  const repository = createInterpretationRepository()

  assert.throws(
    () =>
      repository.createInterpretation({
        ...validInterpretationInput,
        observationIds: [maddieObservation.id],
      }),
    /another athlete/,
  )
})

test('returns Interpretation history newest first', () => {
  const older = {
    ...interpretation,
    id: 'older-interpretation',
    createdAt: '2026-07-19T00:00:00Z',
  }
  const newer = {
    ...interpretation,
    id: 'newer-interpretation',
    createdAt: '2026-07-21T00:00:00Z',
  }
  const repository = createInterpretationRepository([older, newer])

  assert.deepEqual(
    repository
      .getInterpretationsByAthleteId(sam.id)
      .map((record) => record.id),
    ['newer-interpretation', 'older-interpretation'],
  )
})

test('updates an Interpretation and preserves ownership and creation metadata', () => {
  const repository = createInterpretationRepository([
    { ...interpretation },
  ])
  const updated = repository.updateInterpretation({
    id: interpretation.id,
    observationIds: [observation.id],
    summary: 'Updated synthetic interpretation',
    confidence: 5,
    status: 'superseded',
    updatedBy: 'coach-2',
  })

  assert.equal(updated.athleteId, interpretation.athleteId)
  assert.equal(updated.createdAt, interpretation.createdAt)
  assert.equal(updated.createdBy, interpretation.createdBy)
  assert.equal(updated.updatedAt, '2026-07-23T00:00:00Z')
  assert.equal(updated.updatedBy, 'coach-2')
  assert.equal(updated.summary, 'Updated synthetic interpretation')
  assert.equal(updated.status, 'superseded')
})

const maddieInterpretation: Interpretation = {
  ...interpretation,
  id: 'maddie-interpretation',
  athleteId: maddie.id,
  observationIds: [maddieObservation.id],
}

function createPriorityRepository(existingPriorities: Priority[] = []) {
  let timestampIndex = 0
  const timestamps = [
    '2026-07-25T00:00:00Z',
    '2026-07-26T00:00:00Z',
  ]

  return new InMemoryCoachingRepository(
    {
      athletes: [sam, maddie],
      observations: [observation, maddieObservation],
      interpretations: [interpretation, maddieInterpretation],
      priorities: existingPriorities,
      decisions: [],
    },
    {
      createId: () => 'created-priority',
      now: () => timestamps[timestampIndex++] ?? timestamps.at(-1)!,
    },
  )
}

const validPriorityInput = {
  athleteId: sam.id,
  interpretationIds: [interpretation.id],
  focus: 'Synthetic test focus',
  rationale: 'Synthetic test rationale',
  category: 'technical' as const,
  rank: 1,
  reviewAt: '2026-08-25',
  createdBy: 'coach-1',
}

test('creates an active Priority owned by the selected Athlete', () => {
  const repository = createPriorityRepository()
  const created = repository.createPriority(validPriorityInput)

  assert.equal(created.id, 'created-priority')
  assert.equal(created.athleteId, sam.id)
  assert.equal(created.status, 'active')
  assert.equal(created.createdAt, '2026-07-25T00:00:00Z')
  assert.equal(created.updatedAt, created.createdAt)
  assert.equal(created.updatedBy, created.createdBy)
})

test('rejects a Priority without a supporting Interpretation', () => {
  const repository = createPriorityRepository()

  assert.throws(
    () =>
      repository.createPriority({
        ...validPriorityInput,
        interpretationIds: [],
      }),
    /At least one Interpretation/,
  )
})

test('rejects a Priority referencing a missing Interpretation', () => {
  const repository = createPriorityRepository()

  assert.throws(
    () =>
      repository.createPriority({
        ...validPriorityInput,
        interpretationIds: ['missing-interpretation'],
      }),
    /unknown Interpretation/,
  )
})

test('rejects a Priority referencing another athlete Interpretation', () => {
  const repository = createPriorityRepository()

  assert.throws(
    () =>
      repository.createPriority({
        ...validPriorityInput,
        interpretationIds: [maddieInterpretation.id],
      }),
    /another athlete/,
  )
})

test('rejects empty Priority focus, rationale and authorship', () => {
  for (const invalid of [
    { ...validPriorityInput, focus: ' ' },
    { ...validPriorityInput, rationale: ' ' },
    { ...validPriorityInput, createdBy: ' ' },
  ]) {
    assert.throws(
      () => createPriorityRepository().createPriority(invalid),
      /required/,
    )
  }
})

test('rejects an invalid Priority category', () => {
  const repository = createPriorityRepository()

  assert.throws(
    () =>
      repository.createPriority({
        ...validPriorityInput,
        category: 'invalid' as never,
      }),
    /category is invalid/,
  )
})

test('rejects invalid Priority ranks', () => {
  for (const rank of [0, 4, 1.5]) {
    assert.throws(
      () =>
        createPriorityRepository().createPriority({
          ...validPriorityInput,
          rank,
        }),
      /rank must be 1, 2 or 3/,
    )
  }
})

test('rejects missing or invalid Priority review dates', () => {
  for (const reviewAt of ['', 'not-a-date']) {
    assert.throws(
      () =>
        createPriorityRepository().createPriority({
          ...validPriorityInput,
          reviewAt,
        }),
      /reviewAt/,
    )
  }
})

test('rejects a duplicate active Priority rank', () => {
  const repository = createPriorityRepository([{ ...priority }])

  assert.throws(
    () => repository.createPriority(validPriorityInput),
    /already has an active Priority at rank 1/,
  )
})

test('rejects a fourth active Priority', () => {
  const activePriorities = [1, 2, 3].map((rank) => ({
    ...priority,
    id: `priority-${rank}`,
    rank,
  }))
  const repository = createPriorityRepository(activePriorities)

  assert.throws(
    () =>
      repository.createPriority({
        ...validPriorityInput,
        rank: 2,
      }),
    /more than three active Priorities/,
  )
})

test('returns Athlete-specific active Priorities in rank order', () => {
  const priorities = [
    { ...priority, id: 'rank-3', rank: 3 },
    {
      ...priority,
      id: 'maddie-rank-1',
      athleteId: maddie.id,
      interpretationIds: [maddieInterpretation.id],
    },
    { ...priority, id: 'rank-1', rank: 1 },
    { ...priority, id: 'rank-2', rank: 2 },
  ]
  const repository = createPriorityRepository(priorities)

  assert.deepEqual(
    repository.getPrioritiesByAthleteId(sam.id).map((record) => record.id),
    ['rank-1', 'rank-2', 'rank-3'],
  )
  assert.deepEqual(
    repository.getPrioritiesByAthleteId(maddie.id).map((record) => record.id),
    ['maddie-rank-1'],
  )
})

test('updates a Priority and preserves ownership and creation metadata', () => {
  const repository = createPriorityRepository([{ ...priority }])
  const updated = repository.updatePriority(priority.id, {
    interpretationIds: [interpretation.id],
    focus: 'Updated synthetic focus',
    rationale: 'Updated synthetic rationale',
    category: 'development',
    rank: 2,
    reviewAt: '2026-09-01',
    status: 'active',
    updatedBy: 'coach-2',
  })

  assert.equal(updated.athleteId, priority.athleteId)
  assert.equal(updated.createdAt, priority.createdAt)
  assert.equal(updated.createdBy, priority.createdBy)
  assert.equal(updated.updatedAt, '2026-07-25T00:00:00Z')
  assert.equal(updated.updatedBy, 'coach-2')
  assert.equal(updated.focus, 'Updated synthetic focus')
  assert.equal(updated.rank, 2)
})

const performanceResult: PerformanceResult = {
  id: 'performance-current',
  athleteId: sam.id,
  resultType: 'competition',
  occurredAt: '2026-07-20T00:00:00Z',
  event: '100 m freestyle',
  distance: 100,
  stroke: 'freestyle',
  course: 'LCM',
  totalSeconds: 56,
  segments: [
    {
      segmentIndex: 1,
      distanceFrom: 0,
      distanceTo: 50,
      seconds: 27,
    },
    {
      segmentIndex: 2,
      distanceFrom: 50,
      distanceTo: 100,
      seconds: 29,
    },
  ],
  source: 'manual',
  qualityStatus: 'valid',
  createdAt: '2026-07-20T01:00:00Z',
  createdBy: 'coach-1',
}

function createPerformanceRepository(
  existingResults: PerformanceResult[] = [],
  benchmarkProfiles: BenchmarkProfile[] = [],
) {
  return new InMemoryCoachingRepository(
    {
      athletes: [sam, maddie],
      observations: [],
      interpretations: [],
      priorities: [],
      decisions: [],
      performanceResults: existingResults,
      benchmarkProfiles,
    },
    {
      createId: () => 'created-performance',
      now: () => '2026-07-25T00:00:00Z',
    },
  )
}

const validPerformanceInput = {
  athleteId: sam.id,
  resultType: 'competition' as const,
  occurredAt: '2026-07-25T06:00:00Z',
  event: '100 m freestyle',
  distance: 100,
  stroke: 'freestyle' as const,
  course: 'LCM' as const,
  totalSeconds: 56,
  segments: [
    {
      segmentIndex: 1,
      distanceFrom: 0,
      distanceTo: 50,
      seconds: 27,
    },
    {
      segmentIndex: 2,
      distanceFrom: 50,
      distanceTo: 100,
      seconds: 29,
    },
  ],
  createdBy: 'coach-1',
}

test('creates a valid Athlete-owned Performance Result', () => {
  const repository = createPerformanceRepository()
  const created = repository.createPerformanceResult(validPerformanceInput)

  assert.equal(created.id, 'created-performance')
  assert.equal(created.athleteId, sam.id)
  assert.equal(created.source, 'manual')
  assert.equal(created.qualityStatus, 'valid')
  assert.equal(created.createdAt, '2026-07-25T00:00:00Z')
  assert.deepEqual(repository.getPerformanceResultsByAthleteId(sam.id), [
    created,
  ])
  assert.deepEqual(repository.getPerformanceResultsByAthleteId(maddie.id), [])
})

test('rejects a Performance Result for an unknown Athlete', () => {
  assert.throws(
    () =>
      createPerformanceRepository().createPerformanceResult({
        ...validPerformanceInput,
        athleteId: 'unknown-athlete',
      }),
    /unknown athlete/,
  )
})

test('rejects a non-positive Performance Result total', () => {
  for (const totalSeconds of [0, -1]) {
    assert.throws(
      () =>
        createPerformanceRepository().createPerformanceResult({
          ...validPerformanceInput,
          totalSeconds,
        }),
      /total must be positive/,
    )
  }
})

test('rejects missing or invalid Performance Result splits', () => {
  assert.throws(
    () =>
      createPerformanceRepository().createPerformanceResult({
        ...validPerformanceInput,
        segments: [],
      }),
    /at least one segment/,
  )
  assert.throws(
    () =>
      createPerformanceRepository().createPerformanceResult({
        ...validPerformanceInput,
        segments: [
          { ...validPerformanceInput.segments[0], seconds: 0 },
          validPerformanceInput.segments[1],
        ],
      }),
    /segment times must be positive/,
  )
})

test('rejects invalid segment coverage and totals outside tolerance', () => {
  assert.throws(
    () =>
      createPerformanceRepository().createPerformanceResult({
        ...validPerformanceInput,
        segments: [
          validPerformanceInput.segments[0],
          {
            ...validPerformanceInput.segments[1],
            distanceFrom: 60,
          },
        ],
      }),
    /valid and ordered/,
  )
  assert.throws(
    () =>
      createPerformanceRepository().createPerformanceResult({
        ...validPerformanceInput,
        totalSeconds: 57,
      }),
    /sum to total within 0.05 seconds/,
  )
})

test('retrieves Performance Results newest first', () => {
  const older = {
    ...performanceResult,
    id: 'older-performance',
    occurredAt: '2026-07-18T00:00:00Z',
  }
  const newer = {
    ...performanceResult,
    id: 'newer-performance',
    occurredAt: '2026-07-22T00:00:00Z',
  }
  const repository = createPerformanceRepository([older, newer])

  assert.deepEqual(
    repository
      .getPerformanceResultsByAthleteId(sam.id)
      .map((result) => result.id),
    ['newer-performance', 'older-performance'],
  )
})

test('matches only a compatible previous Performance Result', () => {
  const previous = {
    ...performanceResult,
    id: 'previous-compatible',
    occurredAt: '2026-07-19T00:00:00Z',
    totalSeconds: 57,
    segments: [
      { ...performanceResult.segments[0], seconds: 27.5 },
      { ...performanceResult.segments[1], seconds: 29.5 },
    ],
  }
  const incompatible = {
    ...previous,
    id: 'incompatible-result',
    occurredAt: '2026-07-19T12:00:00Z',
    stroke: 'backstroke' as const,
  }
  const repository = createPerformanceRepository([
    previous,
    incompatible,
    performanceResult,
  ])
  const comparison = repository.getPerformanceComparison(performanceResult.id)

  assert.equal(comparison.previousResultId, previous.id)
  assert.equal(comparison.previousTotalDifferenceSeconds, -1)
  assert.equal(comparison.segmentComparisons[0].previousDifferenceSeconds, -0.5)
})

test('selects the fastest valid comparable stored result as PB', () => {
  const storedPb = {
    ...performanceResult,
    id: 'stored-pb',
    occurredAt: '2026-07-18T00:00:00Z',
    totalSeconds: 54,
    segments: [
      { ...performanceResult.segments[0], seconds: 26 },
      { ...performanceResult.segments[1], seconds: 28 },
    ],
  }
  const excludedFaster = {
    ...storedPb,
    id: 'excluded-faster',
    totalSeconds: 53,
    segments: [
      { ...performanceResult.segments[0], seconds: 25.5 },
      { ...performanceResult.segments[1], seconds: 27.5 },
    ],
    qualityStatus: 'excluded' as const,
  }
  const repository = createPerformanceRepository([
    storedPb,
    excludedFaster,
    performanceResult,
  ])
  const comparison = repository.getPerformanceComparison(performanceResult.id)

  assert.equal(comparison.pbResultId, storedPb.id)
  assert.equal(comparison.pbTotalDifferenceSeconds, 2)
})

test('uses positive differences for slower and negative for faster', () => {
  const previous = {
    ...performanceResult,
    id: 'previous-result',
    occurredAt: '2026-07-18T00:00:00Z',
    totalSeconds: 56,
    segments: [
      { ...performanceResult.segments[0], seconds: 28 },
      { ...performanceResult.segments[1], seconds: 28 },
    ],
  }
  const repository = createPerformanceRepository([
    previous,
    performanceResult,
  ])
  const comparison = repository.getPerformanceComparison(performanceResult.id)

  assert.equal(comparison.segmentComparisons[0].previousDifferenceSeconds, -1)
  assert.equal(comparison.segmentComparisons[1].previousDifferenceSeconds, 1)
  assert.equal(
    comparison.largestDeteriorationFromPrevious?.segmentIndex,
    2,
  )
  assert.equal(comparison.largestImprovementFromPrevious?.segmentIndex, 1)
  assert.match(
    comparison.findings.map((finding) => finding.summary).join(' '),
    /improved by 1.00 s/,
  )
  assert.match(
    comparison.findings.map((finding) => finding.summary).join(' '),
    /1.00 s slower/,
  )
})

test('handles an unavailable QAS benchmark without error', () => {
  const repository = createPerformanceRepository([performanceResult])
  const comparison = repository.getPerformanceComparison(performanceResult.id)

  assert.equal(comparison.benchmarkMatchStatus, 'unavailable')
  assert.equal(comparison.benchmarkProfileId, undefined)
  assert.match(
    comparison.findings.map((finding) => finding.summary).join(' '),
    /No applicable QAS benchmark available/,
  )
})
