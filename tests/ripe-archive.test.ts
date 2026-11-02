import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { ripeArchiveSchema } from '../src/data-sources/ripe-archive-schema.ts'
import {
  syntheticArchive,
  syntheticAthlete,
} from '../src/data/synthetic-archive.ts'
import {
  parseRipeArchive,
  reviewRipeArchive,
  emptyArchive,
  canonical,
  parseArchiveBackup,
  validateArchiveState,
} from '../src/data-sources/ripe-archive.ts'
import {
  athleteTrainingSummary,
  recordedPersonalBests,
} from '../src/domain/athlete-workspace.ts'
import { InMemoryCoachingRepository } from '../src/repositories/in-memory-coaching-repository.ts'
import type { InMemoryCoachingData } from '../src/repositories/in-memory-coaching-repository.ts'
import {
  loadPersistedCoachingData,
  savePersistedCoachingData,
  COACHING_STORAGE_KEY,
} from '../src/repositories/local-coaching-persistence.ts'

const athleteId = syntheticAthlete.id
const fixture = () => structuredClone(syntheticArchive)
const seed = (): InMemoryCoachingData => ({
  athletes: [structuredClone(syntheticAthlete)],
  observations: [],
  interpretations: [],
  priorities: [],
  decisions: [],
  performanceResults: [],
})
function repository(onChange?: (data: InMemoryCoachingData) => void) {
  let id = 0
  return new InMemoryCoachingRepository(seed(), {
    createId: () => `batch-${++id}`,
    now: () => '2026-11-02T00:00:00Z',
    onChange,
  })
}

test('published JSON schema and synthetic fixture match the runtime contract', () => {
  assert.deepEqual(
    JSON.parse(
      readFileSync(
        new URL('../docs/ripe-verified-archive.schema.json', import.meta.url),
        'utf8',
      ),
    ),
    ripeArchiveSchema,
  )
  assert.deepEqual(
    parseRipeArchive(
      readFileSync(
        new URL('./fixtures/ripe-synthetic-export.json', import.meta.url),
        'utf8',
      ),
    ),
    fixture(),
  )
})

test('schema accepts synthetic contract and rejects malformed or unknown fields', () => {
  assert.deepEqual(parseRipeArchive(JSON.stringify(fixture())), fixture())
  const cases = [
    { ...fixture(), format: 'other' },
    { ...fixture(), extra: 'not part of the contract' },
    { ...fixture(), sessions: [] },
    { ...fixture(), exportedAt: '2026-02-30T00:00:00Z' },
    { ...fixture(), exportedAt: '2026-11-01T24:00:00Z' },
  ]
  for (const value of cases)
    assert.throws(
      () => parseRipeArchive(JSON.stringify(value)),
      /Invalid archive/,
    )
  assert.throws(
    () => parseRipeArchive(' '.repeat(5 * 1024 * 1024 + 1)),
    /limit/,
  )
})

test('schema requires verified coach provenance, valid checksums and explicit nullable distances', () => {
  const mutations = [
    (f: ReturnType<typeof fixture>) => {
      delete f.sessions[0].approval.verifiedBy
    },
    (f: ReturnType<typeof fixture>) => {
      f.sessions[0].source.checksum = 'unverified-hash'
    },
    (f: ReturnType<typeof fixture>) => {
      f.sessions[0].participants[0].completedDistanceMeters = -1
    },
    (f: ReturnType<typeof fixture>) => {
      f.sessions[0].participants[0].performances[0].totalSeconds = 0
    },
    (f: ReturnType<typeof fixture>) => {
      f.sessions[0].participants[0].performances[0].distance = 0
    },
  ]
  for (const mutate of mutations) {
    const input = fixture()
    mutate(input)
    assert.throws(
      () => parseRipeArchive(JSON.stringify(input)),
      /Invalid archive/,
    )
    assert.throws(
      () => repository().importArchive(input, 'fixture.json', 'coach'),
      /Invalid archive/,
    )
  }
})

test('valid import reuses one athlete ID and integrates only verified timed performances', () => {
  const repo = repository()
  const input = fixture()
  const original = JSON.stringify(input)
  const batch = repo.importArchive(input, 'synthetic.json', 'coach')
  assert.equal(batch.review.filter((r) => r.status === 'ready').length, 3)
  assert.equal(repo.listAthletes().length, 1)
  const results = repo.getPerformanceResultsByAthleteId(athleteId)
  assert.equal(results.length, 2)
  assert.deepEqual(
    results.map((r) => r.totalSeconds),
    [64.8, 65.4],
  )
  assert.equal(results[0].athleteId, repo.listAthletes()[0].id)
  assert.equal(
    results[0].archiveProvenance?.sourceChecksum,
    input.sessions[1].source.checksum,
  )
  assert.equal(results[0].archiveProvenance?.verifiedBy, 'synthetic-coach')
  assert.equal(results[0].archiveProvenance?.verificationStatus, 'verified')
  assert.deepEqual(results[0].segments, [])
  assert.equal(JSON.stringify(input), original)
  assert.equal(
    repo.getPerformanceComparison(results[0].id).previousResultId,
    results[1].id,
  )
  assert.equal(recordedPersonalBests(results)[0].totalSeconds, 64.8)
})

test('duplicate imports are idempotent including reordered object keys', () => {
  const repo = repository()
  const input = fixture()
  repo.importArchive(input, 'one.json', 'coach')
  const reordered = JSON.parse(
    JSON.stringify(input, (_key, value) =>
      value && !Array.isArray(value) && typeof value === 'object'
        ? Object.fromEntries(Object.entries(value).reverse())
        : value,
    ),
  )
  // Canonical comparison is independent of object insertion order at every depth.
  assert.equal(
    canonical({ x: { a: 1, b: 2 } }),
    canonical({ x: { b: 2, a: 1 } }),
  )
  assert.ok(
    repo.reviewArchive(reordered).every((r) => r.status === 'duplicate'),
  )
  assert.ok(repo.reviewArchive(input).every((r) => r.status === 'duplicate'))
  assert.throws(
    () => repo.importArchive(input, 'two.json', 'coach'),
    /No importable/,
  )
  assert.equal(repo.getArchiveState().batches.length, 1)
  assert.equal(repo.getPerformanceResultsByAthleteId(athleteId).length, 2)
})

test('same identity with changed content or checksum is a conflict, never an overwrite', () => {
  for (const field of ['time', 'checksum', 'planned', 'approval']) {
    const repo = repository()
    repo.importArchive(fixture(), 'first.json', 'coach')
    const before = repo.getArchiveState()
    const changed = fixture()
    if (field === 'time')
      changed.sessions[0].participants[0].performances[0].totalSeconds = 60
    if (field === 'checksum')
      changed.sessions[0].source.checksum = `sha256:${'a'.repeat(64)}`
    if (field === 'planned') changed.sessions[0].plannedDistanceMeters = 9999
    if (field === 'approval')
      changed.sessions[0].approval.verifiedBy = 'someone-else'
    assert.equal(repo.reviewArchive(changed)[0].status, 'conflict')
    assert.throws(
      () => repo.importArchive(changed, 'changed.json', 'coach'),
      /No importable/,
    )
    assert.deepEqual(repo.getArchiveState(), before)
  }
})

test('provisional sessions are skipped and do not confirm completed distance or times', () => {
  const repo = repository()
  const input = fixture()
  input.sessions[0].approval = { status: 'provisional' }
  assert.equal(repo.reviewArchive(input)[0].status, 'unverified')
  repo.importArchive(input, 'mixed.json', 'coach')
  const summary = athleteTrainingSummary(
    repo.getArchiveState(),
    athleteId,
    '2026',
  )
  assert.equal(summary.rows.length, 2)
  assert.equal(summary.completedMeters, 0)
  assert.equal(repo.getPerformanceResultsByAthleteId(athleteId).length, 1)
})

test('unknown stable IDs never match by name or create a second athlete', () => {
  const repo = repository()
  const input = fixture()
  input.sessions.forEach((s) => {
    s.participants[0].athleteId = 'Demo Athlete'
  })
  assert.ok(repo.reviewArchive(input).every((r) => r.status === 'unresolved'))
  assert.throws(
    () => repo.importArchive(input, 'unknown.json', 'coach'),
    /No importable/,
  )
  assert.equal(repo.listAthletes().length, 1)
  assert.equal(repo.getArchiveState().sessions.length, 0)
})

test('rejects duplicate session, participant, result and reused source identities', () => {
  const repo = repository()
  const cases = [fixture(), fixture(), fixture(), fixture()]
  cases[0].sessions.push(structuredClone(cases[0].sessions[0]))
  cases[1].sessions[0].participants.push(
    structuredClone(cases[1].sessions[0].participants[0]),
  )
  cases[2].sessions[0].participants[0].performances.push(
    structuredClone(cases[2].sessions[0].participants[0].performances[0]),
  )
  cases[3].sessions[1].source.checksum = cases[3].sessions[0].source.checksum
  for (const input of cases)
    assert.equal(repo.reviewArchive(input)[0].status, 'conflict')
  repo.importArchive(fixture(), 'first.json', 'coach')
  const renamed = fixture()
  renamed.archiveId = 'different-archive'
  assert.ok(repo.reviewArchive(renamed).every((r) => r.status === 'conflict'))
})

test('absent athletes cannot have positive completed distance or timed results', () => {
  const repo = repository()
  const input = fixture()
  input.sessions[0].participants[0].attendance = 'absent'
  assert.equal(repo.reviewArchive(input)[0].status, 'conflict')
})

test('planned and completed distances, missing values, zero and season filters stay distinct', () => {
  const repo = repository()
  repo.importArchive(fixture(), 'fixture.json', 'coach')
  const summary = athleteTrainingSummary(
    repo.getArchiveState(),
    athleteId,
    '2026',
  )
  assert.equal(summary.completedMeters, 4200)
  assert.equal(summary.missingDistance, 1)
  assert.equal(summary.attendancePercent, 67)
  assert.equal(summary.provisionalMeasurements, 2)
  assert.equal(summary.missingTimes, 2)
  const none = athleteTrainingSummary(repo.getArchiveState(), athleteId, '2025')
  assert.equal(none.completedMeters, null)
  assert.equal(none.attendancePercent, null)
  assert.equal(none.rows.length, 0)
})

test('unknown attendance is excluded from percentage denominator', () => {
  const repo = repository()
  const input = fixture()
  input.sessions[2].participants[0].attendance = 'unknown'
  repo.importArchive(input, 'fixture.json', 'coach')
  const summary = athleteTrainingSummary(
    repo.getArchiveState(),
    athleteId,
    '2026',
  )
  assert.equal(summary.attendancePercent, 100)
  assert.equal(summary.knownAttendance, 2)
})

test('failed persistence cannot partially publish an archive transaction', () => {
  const repo = repository(() => {
    throw new Error('Quota exceeded')
  })
  assert.throws(
    () => repo.importArchive(fixture(), 'fixture.json', 'coach'),
    /Quota/,
  )
  assert.deepEqual(repo.getArchiveState(), emptyArchive())
  assert.equal(repo.getPerformanceResultsByAthleteId(athleteId).length, 0)
})

test('failed rollback save keeps the original batch and results active', () => {
  let fail = false
  const repo = repository(() => {
    if (fail) throw new Error('Unavailable storage')
  })
  const batch = repo.importArchive(fixture(), 'fixture.json', 'coach')
  fail = true
  assert.throws(
    () => repo.rollbackArchiveBatch(batch.id, 'Test rollback', 'coach'),
    /Unavailable/,
  )
  assert.equal(repo.getArchiveState().batches[0].status, 'active')
  assert.equal(repo.getPerformanceResultsByAthleteId(athleteId).length, 2)
})

test('training and performance projections isolate athletes by stable ID', () => {
  const data = seed()
  data.athletes.push({
    ...structuredClone(syntheticAthlete),
    id: 'demo-athlete-002',
  })
  const repo = new InMemoryCoachingRepository(data)
  const input = fixture()
  input.sessions[0].participants.push({
    athleteId: 'demo-athlete-002',
    attendance: 'present',
    completedDistanceMeters: 1000,
    performances: [],
  })
  repo.importArchive(input, 'fixture.json', 'coach')
  assert.equal(
    athleteTrainingSummary(repo.getArchiveState(), 'demo-athlete-002', '2026')
      .completedMeters,
    1000,
  )
  assert.equal(
    athleteTrainingSummary(repo.getArchiveState(), athleteId, '2026')
      .completedMeters,
    4200,
  )
  assert.equal(
    repo.getPerformanceResultsByAthleteId('demo-athlete-002').length,
    0,
  )
})

test('archive source and returned snapshots cannot mutate confirmed records', () => {
  const repo = repository()
  const input = fixture()
  repo.importArchive(input, 'fixture.json', 'coach')
  input.sessions[0].participants[0].completedDistanceMeters = 9000
  const snapshot = repo.getArchiveState()
  snapshot.sessions[0].session.title = 'tampered'
  const result = repo.getPerformanceResultsByAthleteId(athleteId)[0]
  assert.throws(
    () =>
      repo.updatePerformanceResult(result.id, {
        ...result,
        createdBy: 'coach',
      }),
    /immutable/,
  )
  assert.equal(
    athleteTrainingSummary(repo.getArchiveState(), athleteId, '2026')
      .completedMeters,
    4200,
  )
  assert.notEqual(repo.getArchiveState().sessions[0].session.title, 'tampered')
})

test('rollback retains evidence and audit, excludes derived results and preserves unrelated records', () => {
  const repo = repository()
  const native = repo.createPerformanceResult({
    athleteId,
    resultType: 'training',
    occurredAt: '2026-10-20T06:00:00Z',
    event: '50 m freestyle',
    distance: 50,
    stroke: 'freestyle',
    course: 'LCM',
    totalSeconds: 40,
    segments: [
      { segmentIndex: 1, distanceFrom: 0, distanceTo: 50, seconds: 40 },
    ],
    createdBy: 'coach',
  })
  const batch = repo.importArchive(fixture(), 'fixture.json', 'coach')
  assert.throws(
    () => repo.rollbackArchiveBatch(batch.id, '', 'coach'),
    /reason/,
  )
  repo.rollbackArchiveBatch(batch.id, 'Wrong source selection', 'coach')
  const state = repo.getArchiveState()
  assert.equal(state.sessions.length, 3)
  assert.equal(state.batches[0].status, 'rolled-back')
  assert.equal(state.batches[0].rollback?.reason, 'Wrong source selection')
  assert.deepEqual(
    repo.getPerformanceResultsByAthleteId(athleteId).map((r) => r.id),
    [native.id],
  )
  assert.equal(
    athleteTrainingSummary(state, athleteId, '2026').completedMeters,
    null,
  )
  assert.throws(
    () => repo.rollbackArchiveBatch(batch.id, 'Again', 'coach'),
    /not found/,
  )
  repo.importArchive(fixture(), 'retry.json', 'coach')
  validateArchiveState(repo.getArchiveState(), [athleteId])
  assert.equal(repo.getArchiveState().batches.length, 2)
})

test('archive and provenance survive hydration with duplicate protection intact', () => {
  const values = new Map<string, string>()
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
  }
  const repo = repository((data) =>
    savePersistedCoachingData(storage, data, undefined, true),
  )
  repo.importArchive(fixture(), 'fixture.json', 'coach')
  const restored = new InMemoryCoachingRepository(
    loadPersistedCoachingData(storage, seed()),
  )
  assert.deepEqual(restored.getArchiveState(), repo.getArchiveState())
  assert.equal(restored.getPerformanceResultsByAthleteId(athleteId).length, 2)
  assert.ok(
    restored.reviewArchive(fixture()).every((r) => r.status === 'duplicate'),
  )
  assert.ok(values.get(COACHING_STORAGE_KEY))
})

test('strict persistence propagates storage failures instead of reporting import success', () => {
  const storage = {
    getItem: () => null,
    setItem: () => {
      throw new Error('Quota')
    },
  }
  assert.throws(
    () => savePersistedCoachingData(storage, seed(), undefined, true),
    /Local save failed/,
  )
  assert.throws(
    () => savePersistedCoachingData(undefined, seed(), undefined, true),
    /unavailable/,
  )
})

test('backup recovery validates identities and only restores into an empty archive', () => {
  const source = repository()
  source.importArchive(fixture(), 'fixture.json', 'coach')
  const text = JSON.stringify({
    format: 'ripe-archive-backup-v1',
    archive: source.getArchiveState(),
  })
  assert.throws(() => parseArchiveBackup(text, []), /Invalid stored archive/)
  const target = repository()
  target.restoreArchiveBackup(text, 'recovering-coach')
  assert.equal(
    target.getArchiveState().recovery?.restoredBy,
    'recovering-coach',
  )
  assert.equal(target.getPerformanceResultsByAthleteId(athleteId).length, 2)
  assert.throws(
    () => target.restoreArchiveBackup(text, 'coach'),
    /empty archive/,
  )
})

test('corrupted backup evidence and partial batch references fail closed', () => {
  const source = repository()
  source.importArchive(fixture(), 'fixture.json', 'coach')
  const mutations = [
    source.getArchiveState(),
    source.getArchiveState(),
    source.getArchiveState(),
  ]
  mutations[0].sessions[0].session.approval.status = 'provisional'
  mutations[1].sessions[0].batchId = 'missing-batch'
  mutations[2].sessions[0].session.participants[0].athleteId = 'missing-athlete'
  for (const archive of mutations) {
    const target = repository()
    assert.throws(() =>
      target.restoreArchiveBackup(
        JSON.stringify({ format: 'ripe-archive-backup-v1', archive }),
        'coach',
      ),
    )
    assert.deepEqual(target.getArchiveState(), emptyArchive())
  }
})

test('mixed imports report every row and import ready sessions only', () => {
  const input = fixture()
  input.sessions[0].participants[0].athleteId = 'unknown'
  input.sessions[1].approval = { status: 'provisional' }
  const repo = repository()
  const batch = repo.importArchive(input, 'mixed.json', 'coach')
  assert.deepEqual(
    batch.review.map((r) => r.status),
    ['unresolved', 'unverified', 'ready'],
  )
  assert.equal(repo.getArchiveState().sessions.length, 1)
  assert.equal(repo.getPerformanceResultsByAthleteId(athleteId).length, 0)
  assert.equal(
    reviewRipeArchive(fixture(), emptyArchive(), [athleteId]).length,
    3,
  )
})
