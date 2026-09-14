import assert from 'node:assert/strict'
import test from 'node:test'

import { getInitialAthlete } from '../src/context/athlete-selection.ts'
import { athletes } from '../src/data/athletes.ts'
import { calculateSplitTotal } from '../src/domain/performance-entry.ts'
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
  DerivedBenchmarkModel,
  PerformanceResult,
} from '../src/types/performance/index.ts'
import {
  qasPacingBenchmarkProfiles,
  qasPacingBenchmarkSet,
  qasPacingDerivedModels,
} from '../src/data/benchmarks/qas-pacing-benchmarks.ts'

const [sam, maddie] = athletes

test('calculates a 100 m total from two decimal splits', () => {
  assert.equal(calculateSplitTotal(['27.35', '28.66']), 56.01)
})

test('calculates a 200 m total from four decimal splits', () => {
  assert.equal(
    calculateSplitTotal(['29.11', '30.22', '31.33', '32.44']),
    123.1,
  )
})

test('does not calculate a total until every split is valid', () => {
  assert.equal(calculateSplitTotal(['27.35', '']), undefined)
  assert.equal(calculateSplitTotal(['27.35', '0']), undefined)
})

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
  derivedBenchmarkModels: DerivedBenchmarkModel[] = [],
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
      derivedBenchmarkModels,
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

test('stores the total derived from race-entry splits', () => {
  const repository = createPerformanceRepository()
  const splitEntries = ['27.35', '28.66']
  const totalSeconds = calculateSplitTotal(splitEntries)

  assert.notEqual(totalSeconds, undefined)
  const created = repository.createPerformanceResult({
    ...validPerformanceInput,
    totalSeconds: totalSeconds!,
    segments: validPerformanceInput.segments.map((segment, index) => ({
      ...segment,
      seconds: Number(splitEntries[index]),
    })),
  })

  assert.equal(created.totalSeconds, 56.01)
})

test('updates a Performance Result and preserves identity and creation metadata', () => {
  const repository = createPerformanceRepository([{ ...performanceResult }])
  const splitEntries = ['27.25', '28.5']
  const totalSeconds = calculateSplitTotal(splitEntries)

  assert.notEqual(totalSeconds, undefined)
  const updated = repository.updatePerformanceResult(performanceResult.id, {
    ...validPerformanceInput,
    totalSeconds: totalSeconds!,
    segments: validPerformanceInput.segments.map((segment, index) => ({
      ...segment,
      seconds: Number(splitEntries[index]),
    })),
  })

  assert.equal(updated.id, performanceResult.id)
  assert.equal(updated.createdAt, performanceResult.createdAt)
  assert.equal(updated.totalSeconds, 55.75)
  assert.deepEqual(
    repository.getPerformanceResultsByAthleteId(sam.id)[0].segments,
    updated.segments,
  )
  updated.segments[0].seconds = 999
  assert.equal(
    repository.getPerformanceResultsByAthleteId(sam.id)[0].segments[0].seconds,
    27.25,
  )
})

test('rejects an update for an unknown Performance Result', () => {
  assert.throws(
    () =>
      createPerformanceRepository().updatePerformanceResult(
        'missing-performance',
        validPerformanceInput,
      ),
    /was not found/,
  )
})

test('rejects moving an edited Performance Result to another Athlete', () => {
  const repository = createPerformanceRepository([{ ...performanceResult }])

  assert.throws(
    () =>
      repository.updatePerformanceResult(performanceResult.id, {
        ...validPerformanceInput,
        athleteId: maddie.id,
      }),
    /another athlete/,
  )
})

test('rejects invalid edited splits without changing the stored result', () => {
  const repository = createPerformanceRepository([{ ...performanceResult }])

  assert.throws(
    () =>
      repository.updatePerformanceResult(performanceResult.id, {
        ...validPerformanceInput,
        segments: [
          { ...validPerformanceInput.segments[0], seconds: 0 },
          validPerformanceInput.segments[1],
        ],
      }),
    /segment times must be positive/,
  )
  assert.equal(
    repository.getPerformanceResultsByAthleteId(sam.id)[0].totalSeconds,
    performanceResult.totalSeconds,
  )
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

test('accepts imported final-only results and rejects invalid supplied splits', () => {
  const finalOnly = createPerformanceRepository().createPerformanceResult({
    ...validPerformanceInput,
    segments: [],
    importMetadata: {
      provider: 'Swimming Australia CSV',
      sourceType: 'csv',
      sourceFileName: 'results.csv',
      meetName: 'Test Meet',
      duplicateKey: 'final-only-test',
      importedAt: '2026-07-25T00:00:00Z',
    },
  })

  assert.equal(finalOnly.totalSeconds, validPerformanceInput.totalSeconds)
  assert.deepEqual(finalOnly.segments, [])
  assert.throws(
    () =>
      createPerformanceRepository().createPerformanceResult({
        ...validPerformanceInput,
        segments: [],
      }),
    /requires at least one segment/,
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

test('compares final-only results by total without segment findings', () => {
  const previous = {
    ...performanceResult,
    id: 'final-only-previous',
    occurredAt: '2026-07-19T00:00:00Z',
    totalSeconds: 57,
    segments: [],
    source: 'import' as const,
    importMetadata: {
      provider: 'Swimming Australia CSV' as const,
      sourceType: 'csv' as const,
      sourceFileName: 'results.csv',
      meetName: 'Test Meet',
      duplicateKey: 'final-only-previous',
      importedAt: '2026-07-20T00:00:00Z',
    },
  }
  const current = {
    ...performanceResult,
    id: 'final-only-current',
    totalSeconds: 54,
    segments: [],
    source: 'import' as const,
    importMetadata: {
      ...previous.importMetadata,
      duplicateKey: 'final-only-current',
    },
  }
  const repository = createPerformanceRepository([previous, current])
  const comparison = repository.getPerformanceComparison(current.id)

  assert.equal(comparison.previousResultId, previous.id)
  assert.equal(comparison.previousTotalDifferenceSeconds, -3)
  assert.equal(comparison.pbResultId, current.id)
  assert.equal(comparison.pbTotalDifferenceSeconds, 0)
  assert.deepEqual(comparison.segmentComparisons, [])
  assert.equal(
    comparison.findings.some((finding) => finding.findingType === 'segment'),
    false,
  )
})

test('compares a final-only result with an applicable total benchmark', () => {
  const finalOnly = {
    ...performanceResult,
    id: 'benchmark-final-only',
    totalSeconds: 56,
    segments: [],
    source: 'import' as const,
    importMetadata: {
      provider: 'Swimming Australia CSV' as const,
      sourceType: 'csv' as const,
      sourceFileName: 'results.csv',
      meetName: 'Test Meet',
      duplicateKey: 'benchmark-final-only',
      importedAt: '2026-07-20T00:00:00Z',
    },
  }
  const benchmark: BenchmarkProfile = {
    id: 'benchmark-100-free',
    benchmarkSetId: 'qas-test',
    event: '100 m freestyle',
    distance: 100,
    stroke: 'freestyle',
    course: 'LCM',
    basis: 'Test fixture',
    segments: [
      {
        segmentIndex: 1,
        distanceFrom: 0,
        distanceTo: 50,
        expectedSeconds: 26.5,
        metricCode: 'split-1',
        unit: 'seconds',
      },
      {
        segmentIndex: 2,
        distanceFrom: 50,
        distanceTo: 100,
        expectedSeconds: 28.5,
        metricCode: 'split-2',
        unit: 'seconds',
      },
    ],
  }
  const comparison = createPerformanceRepository(
    [finalOnly],
    [benchmark],
  ).getPerformanceComparison(finalOnly.id)

  assert.equal(comparison.benchmarkMatchStatus, 'partial')
  assert.equal(comparison.benchmarkProfileId, benchmark.id)
  assert.equal(comparison.benchmarkTotalDifferenceSeconds, 1)
  assert.deepEqual(comparison.segmentComparisons, [])
})

test('imports final-only results idempotently beside manual results', () => {
  const repository = createPerformanceRepository([performanceResult])
  const importedAt = '2026-07-25T00:00:00Z'
  const input = {
    ...validPerformanceInput,
    occurredAt: '2026-07-24T00:00:00Z',
    totalSeconds: 55.5,
    segments: [],
    importMetadata: {
      provider: 'Swimming Australia CSV' as const,
      sourceType: 'csv' as const,
      sourceFileName: 'results.csv',
      meetName: 'Queensland Championships',
      duplicateKey:
        'swimming-australia|sam-gould|2026-07-24|queensland championships|100|freestyle|LCM|55.50|',
      importedAt,
    },
  }

  assert.equal(repository.importPerformanceResults([input]).length, 1)
  assert.equal(repository.importPerformanceResults([input]).length, 0)
  const results = repository.getPerformanceResultsByAthleteId(sam.id)

  assert.equal(results.length, 2)
  assert.equal(results.find((result) => result.source === 'manual')?.id, performanceResult.id)
  assert.equal(results.find((result) => result.source === 'import')?.segments.length, 0)
})

test('reports created results accurately when an import batch contains distinct and identical races', () => {
  const repository = createPerformanceRepository()
  const first = {
    ...validPerformanceInput,
    occurredAt: '2026-08-08T00:00:00Z',
    totalSeconds: 59.02,
    segments: [],
    importMetadata: {
      provider: 'Swimming Australia CSV' as const,
      sourceType: 'csv' as const,
      sourceFileName: 'GetParticipantResults.csv',
      meetName: 'Championships',
      duplicateKey:
        'swimming-australia|sam-gould|2026-08-08|championships|100|freestyle|SCM|59.02|',
      importedAt: '2026-08-09T00:00:00Z',
    },
  }
  const second = {
    ...first,
    totalSeconds: 58.71,
    importMetadata: {
      ...first.importMetadata,
      duplicateKey:
        'swimming-australia|sam-gould|2026-08-08|championships|100|freestyle|SCM|58.71|',
    },
  }

  assert.equal(repository.importPerformanceResults([first, second, first]).length, 2)
  assert.equal(repository.importPerformanceResults([first, second]).length, 0)
  assert.equal(repository.getPerformanceResultsByAthleteId(sam.id).length, 2)
})

test('changing stroke recalculates the previous comparable result', () => {
  const backstrokePrevious = {
    ...performanceResult,
    id: 'backstroke-previous',
    occurredAt: '2026-07-19T00:00:00Z',
    stroke: 'backstroke' as const,
  }
  const repository = createPerformanceRepository([
    backstrokePrevious,
    performanceResult,
  ])

  repository.updatePerformanceResult(performanceResult.id, {
    ...validPerformanceInput,
    stroke: 'backstroke',
    event: '100 m backstroke',
  })

  assert.equal(
    repository.getPerformanceComparison(performanceResult.id).previousResultId,
    backstrokePrevious.id,
  )
})

test('changing course recalculates the previous comparable result', () => {
  const scmPrevious = {
    ...performanceResult,
    id: 'scm-previous',
    occurredAt: '2026-07-19T00:00:00Z',
    course: 'SCM' as const,
  }
  const repository = createPerformanceRepository([scmPrevious, performanceResult])

  repository.updatePerformanceResult(performanceResult.id, {
    ...validPerformanceInput,
    course: 'SCM',
  })

  assert.equal(
    repository.getPerformanceComparison(performanceResult.id).previousResultId,
    scmPrevious.id,
  )
})

test('changing distance recalculates the previous comparable result', () => {
  const segments = [27, 29, 30, 31].map((seconds, index) => ({
    segmentIndex: index + 1,
    distanceFrom: index * 50,
    distanceTo: (index + 1) * 50,
    seconds,
  }))
  const previous200 = {
    ...performanceResult,
    id: '200-previous',
    occurredAt: '2026-07-19T00:00:00Z',
    event: '200 m freestyle',
    distance: 200,
    totalSeconds: 117,
    segments,
  }
  const repository = createPerformanceRepository([previous200, performanceResult])

  repository.updatePerformanceResult(performanceResult.id, {
    ...validPerformanceInput,
    event: '200 m freestyle',
    distance: 200,
    totalSeconds: 118,
    segments: segments.map((segment, index) => ({
      ...segment,
      seconds: segment.seconds + (index === 3 ? 1 : 0),
    })),
  })

  assert.equal(
    repository.getPerformanceComparison(performanceResult.id).previousResultId,
    previous200.id,
  )
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

test('recalculates PB and previous result after editing a result', () => {
  const priorPb = {
    ...performanceResult,
    id: 'prior-pb',
    occurredAt: '2026-07-18T00:00:00Z',
    totalSeconds: 55,
    segments: [
      { ...performanceResult.segments[0], seconds: 26.5 },
      { ...performanceResult.segments[1], seconds: 28.5 },
    ],
  }
  const repository = createPerformanceRepository([priorPb, performanceResult])

  repository.updatePerformanceResult(performanceResult.id, {
    ...validPerformanceInput,
    totalSeconds: 54,
    segments: [
      { ...validPerformanceInput.segments[0], seconds: 26 },
      { ...validPerformanceInput.segments[1], seconds: 28 },
    ],
  })
  let comparison = repository.getPerformanceComparison(performanceResult.id)

  assert.equal(comparison.pbResultId, performanceResult.id)
  assert.equal(comparison.pbTotalDifferenceSeconds, 0)
  assert.equal(comparison.previousResultId, priorPb.id)
  assert.equal(comparison.previousTotalDifferenceSeconds, -1)

  repository.updatePerformanceResult(performanceResult.id, {
    ...validPerformanceInput,
    totalSeconds: 56,
  })
  comparison = repository.getPerformanceComparison(performanceResult.id)

  assert.equal(comparison.pbResultId, priorPb.id)
  assert.equal(comparison.pbTotalDifferenceSeconds, 1)
  assert.equal(comparison.previousTotalDifferenceSeconds, 1)
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

test('matches Maddie to the authoritative female 200 LCM freestyle row', () => {
  const athlete = { ...maddie, sex: 'female' as const }
  const performance = {
    ...performanceResult,
    id: 'maddie-200-free',
    athleteId: athlete.id,
    event: '200 m freestyle',
    distance: 200,
    totalSeconds: 124.5,
    segments: [
      { segmentIndex: 1, distanceFrom: 0, distanceTo: 50, seconds: 29.5 },
      { segmentIndex: 2, distanceFrom: 50, distanceTo: 100, seconds: 31.5 },
      { segmentIndex: 3, distanceFrom: 100, distanceTo: 150, seconds: 32 },
      { segmentIndex: 4, distanceFrom: 150, distanceTo: 200, seconds: 31.5 },
    ],
  }
  const repository = createPerformanceRepository(
    [performance],
    qasPacingBenchmarkProfiles,
  )
  const comparison = repository.getPerformanceComparison(performance.id)

  assert.equal(qasPacingBenchmarkSet.status, 'active')
  assert.equal(
    comparison.benchmarkProfileId,
    'qas-200-lcm-freestyle-female-124.5',
  )
  assert.equal(comparison.benchmarkMatchStatus, 'exact')
  assert.equal(
    comparison.benchmarkProvenance?.label,
    'Published SpeedChart benchmark',
  )
  assert.equal(comparison.benchmarkProvenance?.isPublished, true)
  assert.equal(comparison.benchmarkTotalDifferenceSeconds, 0)
  assert.deepEqual(
    comparison.segmentComparisons.map((segment) => segment.benchmarkSeconds),
    [29.19, 31.49, 32.07, 31.75],
  )
  assert.deepEqual(
    comparison.segmentComparisons.map(
      (segment) => segment.benchmarkDifferenceSeconds,
    ),
    [0.31, 0.01, -0.07, -0.25],
  )
  assert.deepEqual(comparison.distributionSummary, {
    firstHalfActualSeconds: 61,
    firstHalfExpectedSeconds: 60.68,
    firstHalfDifferenceSeconds: 0.32,
    secondHalfActualSeconds: 63.5,
    secondHalfExpectedSeconds: 63.82,
    secondHalfDifferenceSeconds: -0.32,
  })
  assert.equal(comparison.largestAbsoluteSegmentDeviation?.distanceFrom, 0)
})

test('retains the published male and female 200 freestyle chart ranges', () => {
  const femaleProfiles = qasPacingBenchmarkProfiles.filter(
    (profile) => profile.sex === 'female',
  )
  const maleProfiles = qasPacingBenchmarkProfiles.filter(
    (profile) => profile.sex === 'male',
  )

  assert.equal(femaleProfiles.length, 35)
  assert.equal(femaleProfiles[0].targetTotalSeconds, 111)
  assert.equal(femaleProfiles.at(-1)?.targetTotalSeconds, 128)
  assert.equal(maleProfiles.length, 35)
  assert.equal(maleProfiles[0].targetTotalSeconds, 100)
  assert.equal(maleProfiles.at(-1)?.targetTotalSeconds, 117)
})

test('does not cross-match sex-specific published pacing rows', () => {
  const athlete = { ...maddie, sex: 'female' as const }
  const performance = {
    ...performanceResult,
    id: 'maddie-male-range',
    athleteId: athlete.id,
    event: '200 m freestyle',
    distance: 200,
    totalSeconds: 110,
    segments: [
      { segmentIndex: 1, distanceFrom: 0, distanceTo: 50, seconds: 26 },
      { segmentIndex: 2, distanceFrom: 50, distanceTo: 100, seconds: 28 },
      { segmentIndex: 3, distanceFrom: 100, distanceTo: 150, seconds: 28 },
      { segmentIndex: 4, distanceFrom: 150, distanceTo: 200, seconds: 28 },
    ],
  }
  const repository = createPerformanceRepository(
    [performance],
    qasPacingBenchmarkProfiles,
  )

  const comparison = repository.getPerformanceComparison(performance.id)
  assert.equal(comparison.benchmarkProfileId, undefined)
  assert.equal(comparison.benchmarkMatchStatus, 'out-of-range')
  assert.match(comparison.findings[0].summary, /outside the published/)
})

test('derives Maddie pacing outside the female published range', () => {
  const athlete = { ...maddie, sex: 'female' as const, classification: 'S14' }
  const performance = {
    ...performanceResult,
    id: 'maddie-derived-200-free',
    athleteId: athlete.id,
    event: '200 m freestyle',
    distance: 200,
    totalSeconds: 137.4,
    segments: [
      { segmentIndex: 1, distanceFrom: 0, distanceTo: 50, seconds: 31.7 },
      { segmentIndex: 2, distanceFrom: 50, distanceTo: 100, seconds: 34.63 },
      { segmentIndex: 3, distanceFrom: 100, distanceTo: 150, seconds: 35.69 },
      { segmentIndex: 4, distanceFrom: 150, distanceTo: 200, seconds: 35.38 },
    ],
  }
  const repository = new InMemoryCoachingRepository(
    {
      athletes: [athlete],
      observations: [],
      interpretations: [],
      priorities: [],
      decisions: [],
      performanceResults: [performance],
      benchmarkProfiles: qasPacingBenchmarkProfiles,
      derivedBenchmarkModels: qasPacingDerivedModels,
    },
    {
      createId: () => 'unused',
      now: () => '2026-07-25T00:00:00Z',
    },
  )

  const comparison = repository.getPerformanceComparison(performance.id)

  assert.equal(comparison.benchmarkMatchStatus, 'derived')
  assert.equal(
    comparison.benchmarkModelId,
    'speedchart-derived-200-lcm-freestyle-female',
  )
  assert.equal(
    comparison.benchmarkProvenance?.label,
    'SpeedChart-derived able-bodied model',
  )
  assert.equal(comparison.benchmarkProvenance?.isPublished, false)
  assert.equal(
    comparison.benchmarkProvenance?.isOutsidePublishedRange,
    true,
  )
  assert.equal(
    comparison.benchmarkProvenance?.modelCategory,
    'population-able-bodied',
  )
  assert.deepEqual(
    comparison.segmentComparisons.map((segment) => segment.benchmarkSeconds),
    [31.7, 34.63, 35.69, 35.38],
  )
  assert.deepEqual(
    comparison.segmentComparisons.map((segment) =>
      Math.round(
        (segment.benchmarkSeconds! +
          comparison.segmentComparisons
            .slice(0, segment.segmentIndex - 1)
            .reduce((total, prior) => total + prior.benchmarkSeconds!, 0)) *
          100,
      ) / 100,
    ),
    [31.7, 66.33, 102.02, 137.4],
  )
  assert.match(comparison.benchmarkProvenance!.basis, /35 published female rows/)
})

test('derived pacing model remains sex-specific', () => {
  const maleOnlyModels = qasPacingDerivedModels.filter(
    (model) => model.sex === 'male',
  )
  const performance = {
    ...performanceResult,
    id: 'female-with-male-model',
    athleteId: maddie.id,
    event: '200 m freestyle',
    distance: 200,
    totalSeconds: 137.4,
    segments: [
      { segmentIndex: 1, distanceFrom: 0, distanceTo: 50, seconds: 31.7 },
      { segmentIndex: 2, distanceFrom: 50, distanceTo: 100, seconds: 34.63 },
      { segmentIndex: 3, distanceFrom: 100, distanceTo: 150, seconds: 35.69 },
      { segmentIndex: 4, distanceFrom: 150, distanceTo: 200, seconds: 35.38 },
    ],
  }
  const repository = createPerformanceRepository(
    [performance],
    [],
    maleOnlyModels,
  )

  const comparison = repository.getPerformanceComparison(performance.id)

  assert.equal(comparison.benchmarkMatchStatus, 'unavailable')
  assert.equal(comparison.benchmarkModelId, undefined)
})

test('prefers a valid classification-specific Para population benchmark', () => {
  const athlete = { ...maddie, sex: 'female' as const, classification: 'S14' }
  const performance = {
    ...performanceResult,
    id: 'maddie-para-priority',
    athleteId: athlete.id,
    event: '200 m freestyle',
    distance: 200,
    totalSeconds: 137.4,
    segments: [
      { segmentIndex: 1, distanceFrom: 0, distanceTo: 50, seconds: 32 },
      { segmentIndex: 2, distanceFrom: 50, distanceTo: 100, seconds: 34 },
      { segmentIndex: 3, distanceFrom: 100, distanceTo: 150, seconds: 35 },
      { segmentIndex: 4, distanceFrom: 150, distanceTo: 200, seconds: 36.4 },
    ],
  }
  const paraProfile: BenchmarkProfile = {
    id: 'future-s14-200-free-profile',
    benchmarkSetId: 'future-para-set',
    event: '200 m freestyle',
    distance: 200,
    stroke: 'freestyle',
    course: 'LCM',
    sex: 'female',
    classification: 'S14',
    targetTotalSeconds: 137.4,
    modelCategory: 'classification-para',
    label: 'S14 population benchmark',
    source: 'Synthetic priority test only',
    sourceVersion: 'test',
    isPublished: true,
    basis: 'Synthetic priority test only',
    segments: performance.segments.map((segment) => ({
      ...segment,
      expectedSeconds: segment.seconds,
      metricCode: `test-${segment.segmentIndex}`,
      unit: 'seconds' as const,
    })),
  }
  const repository = new InMemoryCoachingRepository(
    {
      athletes: [athlete],
      observations: [],
      interpretations: [],
      priorities: [],
      decisions: [],
      performanceResults: [performance],
      benchmarkProfiles: [...qasPacingBenchmarkProfiles, paraProfile],
      derivedBenchmarkModels: qasPacingDerivedModels,
    },
    { createId: () => 'unused', now: () => '2026-07-25T00:00:00Z' },
  )

  const comparison = repository.getPerformanceComparison(performance.id)

  assert.equal(comparison.benchmarkProfileId, paraProfile.id)
  assert.equal(
    comparison.benchmarkProvenance?.modelCategory,
    'classification-para',
  )
})
