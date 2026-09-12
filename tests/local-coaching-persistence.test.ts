import assert from 'node:assert/strict'
import test from 'node:test'

import { athletes } from '../src/data/athletes.ts'
import {
  InMemoryCoachingRepository,
  type InMemoryCoachingData,
} from '../src/repositories/in-memory-coaching-repository.ts'
import {
  COACHING_STORAGE_KEY,
  loadPersistedCoachingData,
  savePersistedCoachingData,
  type KeyValueStorage,
} from '../src/repositories/local-coaching-persistence.ts'
import type { CreatePerformanceResultInput } from '../src/repositories/coaching-repository.ts'

class MemoryStorage implements KeyValueStorage {
  readonly values = new Map<string, string>()

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string) {
    this.values.set(key, value)
  }
}

const [sam] = athletes

function seedData(): InMemoryCoachingData {
  return {
    athletes,
    observations: [],
    interpretations: [],
    priorities: [],
    decisions: [],
    performanceResults: [],
    benchmarkProfiles: [],
  }
}

function createPersistentRepository(
  storage: MemoryStorage,
  ids: string[] = [],
  timestamps: string[] = [],
) {
  let idIndex = 0
  let timestampIndex = 0
  const data = loadPersistedCoachingData(storage, seedData())

  return new InMemoryCoachingRepository(data, {
    createId: () => ids[idIndex++] ?? `generated-${idIndex}`,
    now: () =>
      timestamps[timestampIndex++] ?? '2026-09-12T08:00:00.000Z',
    onChange: (changedData) =>
      savePersistedCoachingData(storage, changedData),
  })
}

const importedInput: CreatePerformanceResultInput = {
  athleteId: sam.id,
  resultType: 'competition',
  occurredAt: '2026-08-08T00:00:00.000Z',
  event: '100 m freestyle',
  distance: 100,
  stroke: 'freestyle',
  course: 'SCM',
  totalSeconds: 59.02,
  segments: [],
  createdBy: 'local-coach',
  importMetadata: {
    provider: 'Swimming Australia CSV',
    sourceType: 'csv',
    sourceFileName: 'GetParticipantResults.csv',
    meetName: 'Queensland Championships',
    verified: true,
    verificationStatus: 'verified',
    age: 25,
    duplicateKey:
      'swimming-australia|sam-gould|2026-08-08|queensland championships|100|freestyle|SCM|59.02|',
    importedAt: '2026-09-12T07:00:00.000Z',
  },
}

const manualInput: CreatePerformanceResultInput = {
  athleteId: sam.id,
  resultType: 'competition',
  occurredAt: '2026-08-09T00:00:00.000Z',
  event: '100 m freestyle',
  distance: 100,
  stroke: 'freestyle',
  course: 'LCM',
  totalSeconds: 56.01,
  segments: [
    { segmentIndex: 1, distanceFrom: 0, distanceTo: 50, seconds: 27.35 },
    { segmentIndex: 2, distanceFrom: 50, distanceTo: 100, seconds: 28.66 },
  ],
  createdBy: 'local-coach',
}

test('empty storage initializes from seed data without writing', () => {
  const storage = new MemoryStorage()
  const loaded = loadPersistedCoachingData(storage, seedData())

  assert.equal(loaded.athletes.length, athletes.length)
  assert.deepEqual(loaded.performanceResults, [])
  assert.equal(storage.getItem(COACHING_STORAGE_KEY), null)
})

test('performance results, metadata, edits, IDs and timestamps survive hydration', () => {
  const storage = new MemoryStorage()
  const repository = createPersistentRepository(
    storage,
    ['imported-result', 'manual-result'],
    ['2026-09-12T08:01:00.000Z', '2026-09-12T08:02:00.000Z'],
  )
  const imported = repository.importPerformanceResults([importedInput])[0]
  const manual = repository.createPerformanceResult(manualInput)
  repository.updatePerformanceResult(imported.id, {
    ...importedInput,
    totalSeconds: 58.91,
    importMetadata: {
      ...importedInput.importMetadata!,
      duplicateKey: importedInput.importMetadata!.duplicateKey.replace(
        '59.02',
        '58.91',
      ),
    },
  })

  const hydrated = createPersistentRepository(storage)
  const results = hydrated.getPerformanceResultsByAthleteId(sam.id)
  const hydratedImported = results.find((result) => result.id === imported.id)!
  const hydratedManual = results.find((result) => result.id === manual.id)!

  assert.equal(hydratedImported.totalSeconds, 58.91)
  assert.equal(hydratedImported.createdAt, '2026-09-12T08:01:00.000Z')
  assert.deepEqual(hydratedImported.segments, [])
  assert.deepEqual(hydratedImported.importMetadata, {
    ...importedInput.importMetadata,
    duplicateKey: importedInput.importMetadata!.duplicateKey.replace(
      '59.02',
      '58.91',
    ),
  })
  assert.equal(hydratedManual.createdAt, '2026-09-12T08:02:00.000Z')
  assert.deepEqual(hydratedManual.segments, manualInput.segments)
})

test('CSV batch import persists and remains idempotent after hydration', () => {
  const storage = new MemoryStorage()
  const repository = createPersistentRepository(storage, ['imported-result'])

  assert.equal(repository.importPerformanceResults([importedInput]).length, 1)
  const hydrated = createPersistentRepository(storage)
  assert.equal(hydrated.importPerformanceResults([importedInput]).length, 0)
  assert.equal(hydrated.getPerformanceResultsByAthleteId(sam.id).length, 1)
})

test('failed validation does not change persisted data', () => {
  const storage = new MemoryStorage()
  const repository = createPersistentRepository(storage, ['manual-result'])
  repository.createPerformanceResult(manualInput)
  const storedBeforeFailure = storage.getItem(COACHING_STORAGE_KEY)

  assert.throws(
    () =>
      repository.createPerformanceResult({
        ...manualInput,
        totalSeconds: 0,
      }),
    /total must be positive/,
  )
  assert.equal(storage.getItem(COACHING_STORAGE_KEY), storedBeforeFailure)
})

test('Observation, Interpretation and Priority mutations survive hydration', () => {
  const storage = new MemoryStorage()
  const repository = createPersistentRepository(
    storage,
    ['observation-id', 'interpretation-id', 'priority-id'],
  )
  const observation = repository.createObservation({
    athleteId: sam.id,
    occurredAt: '2026-09-10T00:00:00.000Z',
    sourceType: 'coach',
    contextType: 'training',
    summary: 'Persistent observation',
    createdBy: 'local-coach',
  })
  const interpretation = repository.createInterpretation({
    athleteId: sam.id,
    observationIds: [observation.id],
    summary: 'Persistent interpretation',
    confidence: 4,
    createdBy: 'local-coach',
  })
  const priority = repository.createPriority({
    athleteId: sam.id,
    interpretationIds: [interpretation.id],
    focus: 'Persistent priority',
    rationale: 'Backed by persistent records',
    category: 'performance',
    rank: 1,
    reviewAt: '2026-10-01T00:00:00.000Z',
    createdBy: 'local-coach',
  })

  const hydrated = createPersistentRepository(storage)
  assert.equal(hydrated.listObservationsForAthlete(sam.id)[0].id, observation.id)
  assert.equal(
    hydrated.getInterpretationsByAthleteId(sam.id)[0].id,
    interpretation.id,
  )
  assert.equal(hydrated.getPrioritiesByAthleteId(sam.id)[0].id, priority.id)
})

test('malformed and unsupported stored data fall back without overwriting storage', () => {
  for (const stored of ['not json', JSON.stringify({ version: 99 })]) {
    const storage = new MemoryStorage()
    const warnings: string[] = []
    storage.setItem(COACHING_STORAGE_KEY, stored)

    const loaded = loadPersistedCoachingData(
      storage,
      seedData(),
      (warning) => warnings.push(warning),
    )

    assert.deepEqual(loaded.performanceResults, [])
    assert.equal(warnings.length, 1)
    assert.equal(storage.getItem(COACHING_STORAGE_KEY), stored)
  }
})

test('missing optional version-one collections use seed defaults', () => {
  const storage = new MemoryStorage()
  storage.setItem(COACHING_STORAGE_KEY, JSON.stringify({ version: 1 }))

  const loaded = loadPersistedCoachingData(storage, seedData())
  assert.deepEqual(loaded.observations, [])
  assert.deepEqual(loaded.performanceResults, [])
})
