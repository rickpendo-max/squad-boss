import assert from 'node:assert/strict'
import test from 'node:test'
import { bridge, options } from './fixtures/bridge-v02-synthetic.ts'
import {
  checkedBridge,
  sourceReaders,
} from './fixtures/checked-bridge-synthetic.ts'
import {
  verifyBridgeSourceFiles,
  discoverLocalExports,
} from '../src/data-sources/bridge-local-files.ts'
import { adaptBridgeV02 } from '../src/data-sources/ripe-bridge-v02-adapter.ts'
import { savedBridgeReconciliation } from '../src/domain/bridge-reconciliation.ts'
import {
  athleteTrainingSummary,
  recordedPersonalBests,
} from '../src/domain/athlete-workspace.ts'
import {
  InMemoryCoachingRepository,
  type InMemoryCoachingData,
} from '../src/repositories/in-memory-coaching-repository.ts'
import {
  loadPersistedCoachingData,
  savePersistedCoachingData,
} from '../src/repositories/local-coaching-persistence.ts'
import {
  emptyArchive,
  validateArchiveState,
} from '../src/data-sources/ripe-archive.ts'
import { syntheticAthlete } from '../src/data/synthetic-archive.ts'

const seed = (): InMemoryCoachingData => ({
  athletes: ['athlete-1', 'athlete-2'].map((id) => ({
    ...structuredClone(syntheticAthlete),
    id,
  })),
  observations: [],
  interpretations: [],
  priorities: [],
  decisions: [],
  performanceResults: [],
})
function repository(
  onChange?: (data: InMemoryCoachingData) => void,
  data = seed(),
) {
  let n = 0
  return new InMemoryCoachingRepository(data, {
    createId: () => `checked-batch-${++n}`,
    now: () => '2026-11-02T07:00:00Z',
    onChange,
  })
}
function novelSession() {
  const value = bridge()
  value.sessions = [value.sessions[0]]
  value.sessions[0].archive_id = 'D'
  value.sessions[0].record.session_id = 'D'
  return checkedBridge(value)
}

test('SHA-256 checks validate exact original JSON bytes without modifying files', async () => {
  const checked = checkedBridge(bridge())
  const before = JSON.stringify(checked)
  const checks = await verifyBridgeSourceFiles(
    checked.raw,
    sourceReaders(checked.files),
  )
  assert.equal(checks.length, 3)
  assert.ok(checks.every((c) => c.method === 'sha256-selected-json'))
  assert.equal(JSON.stringify(checked), before)
  assert.ok(!JSON.stringify(checks).includes('PRIVATE'))
})

test('missing, changed and unrelated source bytes block the entire transaction', async () => {
  const checked = checkedBridge(bridge())
  const cases = [
    [],
    sourceReaders([{ contents: '{}' }]),
    sourceReaders(checked.files.map((f) => ({ contents: `${f.contents}\n` }))),
  ]
  for (const files of cases) {
    const repo = repository()
    await assert.rejects(
      repo.importBridgeArchive(
        checked.raw,
        options(),
        'synthetic.json',
        'coach',
        files,
      ),
      /checksum|Select the original/,
    )
    assert.deepEqual(repo.getArchiveState(), emptyArchive())
  }
})

test('correct original hash cannot conceal a tampered exported record', async () => {
  const checked = checkedBridge(bridge())
  checked.raw.sessions[0].record.distance_m!['Fictional One'] = 9999
  const repo = repository()
  await assert.rejects(
    repo.importBridgeArchive(
      checked.raw,
      options(),
      'synthetic.json',
      'coach',
      sourceReaders(checked.files),
    ),
    /differs from/,
  )
  assert.deepEqual(repo.getArchiveState(), emptyArchive())
})

test('oversized source and directory selections fail before reading file bytes', async () => {
  let reads = 0
  const huge = {
    size: 26 * 1024 * 1024,
    arrayBuffer: async () => {
      reads++
      return new ArrayBuffer(0)
    },
  }
  await assert.rejects(
    verifyBridgeSourceFiles(checkedBridge(bridge()).raw, [huge]),
    /limit/,
  )
  await assert.rejects(
    discoverLocalExports(
      Array.from({ length: 1001 }, () => ({
        name: 'x.json',
        size: 1,
        text: async () => {
          reads++
          return '{}'
        },
      })),
    ),
    /at most 1000/,
  )
  assert.equal(reads, 0)
})

test('read-only directory discovery recognizes exports and reports unsupported files', async () => {
  const file = (name: string, contents: string) => ({
    name,
    size: new TextEncoder().encode(contents).length,
    text: async () => contents,
  })
  const result = await discoverLocalExports([
    file('export.json', JSON.stringify(bridge())),
    file('settings.json', '{}'),
    file('broken.json', '{'),
    file('notes.txt', 'not an export'),
  ])
  assert.equal(result.exports.length, 1)
  assert.equal(result.exports[0].name, 'export.json')
  assert.equal(result.skipped, 3)
})

test('verified imports atomically save existing athlete links, source checks and session times', async () => {
  const checked = checkedBridge(bridge())
  const repo = repository()
  const batch = await repo.importBridgeArchive(
    checked.raw,
    options(),
    'synthetic.json',
    'coach',
    sourceReaders(checked.files),
  )
  const state = repo.getArchiveState()
  assert.equal(repo.listAthletes().length, 2)
  assert.equal(batch.sourceChecks?.length, 3)
  assert.equal(state.bridge?.identities.length, 2)
  assert.equal(state.bridge?.audit.length, 2)
  assert.equal(state.bridge?.sessions.length, 3)
  assert.equal(
    athleteTrainingSummary(state, 'athlete-1', '2026').completedMeters,
    8300,
  )
  const saved = savedBridgeReconciliation(
    state,
    options().archiveId,
    checked.raw,
  )
  assert.deepEqual(saved.mapping, options().athleteIdsBySourceName)
  assert.deepEqual(saved.times, options().startsAtBySessionId)
  assert.deepEqual(
    savedBridgeReconciliation(state, 'another-archive', checked.raw).mapping,
    {},
  )
})

test('unknown aliases and changed source hashes do not silently reuse reconciliation', async () => {
  const checked = checkedBridge(bridge())
  const repo = repository()
  await repo.importBridgeArchive(
    checked.raw,
    options(),
    'synthetic.json',
    'coach',
    sourceReaders(checked.files),
  )
  const changed = structuredClone(checked.raw)
  changed.sessions[0].source_sha256 = 'd'.repeat(64)
  assert.equal(
    savedBridgeReconciliation(
      repo.getArchiveState(),
      options().archiveId,
      changed,
    ).times.A,
    undefined,
  )
  const unknown = bridge()
  Object.assign(unknown.sessions[0].record, {
    distance_m: { 'Different Fictional Person': 4000 },
  })
  const checkedUnknown = checkedBridge(unknown)
  await assert.rejects(
    repo.importBridgeArchive(
      checkedUnknown.raw,
      options(),
      'unknown.json',
      'coach',
      sourceReaders(checkedUnknown.files),
    ),
    /unmapped/,
  )
  assert.equal(repo.listAthletes().length, 2)
})

test('saved reconciliation survives browser persistence and archive backup recovery', async () => {
  const values = new Map<string, string>()
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
  }
  const checked = checkedBridge(bridge())
  const repo = repository((data) =>
    savePersistedCoachingData(storage, data, undefined, true),
  )
  await repo.importBridgeArchive(
    checked.raw,
    options(),
    'synthetic.json',
    'coach',
    sourceReaders(checked.files),
  )
  const restored = repository(
    undefined,
    loadPersistedCoachingData(storage, seed()),
  )
  assert.deepEqual(restored.getArchiveState(), repo.getArchiveState())
  const recovered = repository()
  recovered.restoreArchiveBackup(
    JSON.stringify({
      format: 'ripe-archive-backup-v1',
      archive: repo.getArchiveState(),
    }),
    'recovery-coach',
  )
  assert.deepEqual(
    recovered.getArchiveState().bridge,
    repo.getArchiveState().bridge,
  )
  assert.ok(![...values.values()].join('').includes('PRIVATE'))
  assert.ok(![...values.values()].join('').includes('source_location'))
})

test('fresh review attestations do not turn identical verified evidence into conflicts', async () => {
  const checked = checkedBridge(bridge())
  const repo = repository()
  await repo.importBridgeArchive(
    checked.raw,
    options(),
    'synthetic.json',
    'coach',
    sourceReaders(checked.files),
  )
  const input = adaptBridgeV02(checked.raw, {
    ...options(),
    attestedBy: 'another-reviewer',
    attestedAt: '2026-11-03T07:00:00Z',
    previousSessions: repo.getArchiveState().sessions.map((s) => s.session),
  })
  assert.ok(
    repo.reviewArchive(input).every((row) => row.status === 'duplicate'),
  )
  await assert.rejects(
    repo.importBridgeArchive(
      checked.raw,
      {
        ...options(),
        attestedBy: 'another-reviewer',
        attestedAt: '2026-11-03T07:00:00Z',
      },
      'again.json',
      'coach',
      sourceReaders(checked.files),
    ),
    /No importable/,
  )
  assert.equal(repo.getArchiveState().batches.length, 1)
})

test('reassigning a verified alias requires audited revocation and never moves historical facts', async () => {
  const repo = repository()
  const checked = checkedBridge(bridge())
  await repo.importBridgeArchive(
    checked.raw,
    options(),
    'first.json',
    'coach',
    sourceReaders(checked.files),
  )
  const novel = novelSession()
  const next = options()
  Object.assign(next.startsAtBySessionId, { D: next.startsAtBySessionId.A })
  next.athleteIdsBySourceName['Fictional One'] = 'athlete-2'
  await assert.rejects(
    repo.importBridgeArchive(
      novel.raw,
      next,
      'new.json',
      'coach',
      sourceReaders(novel.files),
    ),
    /reassigned silently/,
  )
  assert.equal(repo.getArchiveState().batches.length, 1)
  assert.throws(
    () =>
      repo.revokeBridgeIdentity(next.archiveId, 'Fictional One', '', 'coach'),
    /reason/,
  )
  repo.revokeBridgeIdentity(
    next.archiveId,
    'Fictional One',
    'Synthetic identity correction',
    'coach',
  )
  await repo.importBridgeArchive(
    novel.raw,
    next,
    'new.json',
    'coach',
    sourceReaders(novel.files),
  )
  const state = repo.getArchiveState()
  assert.equal(
    state.bridge?.audit.filter((event) => event.action === 'revoke').length,
    1,
  )
  assert.equal(
    athleteTrainingSummary(state, 'athlete-1', '2026').completedMeters,
    8300,
  )
  assert.equal(
    athleteTrainingSummary(state, 'athlete-2', '2026').completedMeters,
    4000,
  )
})

test('failed persistence and concurrent verification cannot publish partial facts or mappings', async () => {
  const checked = checkedBridge(bridge())
  const failed = repository(() => {
    throw new Error('Storage unavailable')
  })
  await assert.rejects(
    failed.importBridgeArchive(
      checked.raw,
      options(),
      'synthetic.json',
      'coach',
      sourceReaders(checked.files),
    ),
    /Storage unavailable/,
  )
  assert.deepEqual(failed.getArchiveState(), emptyArchive())
  const repo = repository()
  const attempts = await Promise.allSettled(
    [1, 2].map(() =>
      repo.importBridgeArchive(
        checked.raw,
        options(),
        'synthetic.json',
        'coach',
        sourceReaders(checked.files),
      ),
    ),
  )
  assert.equal(
    attempts.filter((result) => result.status === 'fulfilled').length,
    1,
  )
  assert.equal(repo.getArchiveState().batches.length, 1)
  assert.equal(repo.getArchiveState().bridge?.identities.length, 2)
})

test('rollback retains verified identities and source-check audit but excludes athlete facts', async () => {
  const checked = checkedBridge(bridge())
  const repo = repository()
  const batch = await repo.importBridgeArchive(
    checked.raw,
    options(),
    'synthetic.json',
    'coach',
    sourceReaders(checked.files),
  )
  repo.rollbackArchiveBatch(batch.id, 'Synthetic rollback', 'coach')
  assert.equal(
    athleteTrainingSummary(repo.getArchiveState(), 'athlete-1', '2026')
      .completedMeters,
    null,
  )
  assert.equal(
    repo.getArchiveState().bridge?.identities.filter((link) => link.active)
      .length,
    2,
  )
  assert.equal(repo.getArchiveState().batches[0].sourceChecks?.length, 3)
  validateArchiveState(repo.getArchiveState(), ['athlete-1', 'athlete-2'])
})

test('explicit measured results feed athlete performance intelligence without promoting missing or unverified times', async () => {
  const input = bridge()
  const result = {
    athlete_name: 'Fictional One',
    id: 'race-1',
    resultType: 'test',
    distance: 100,
    stroke: 'freestyle',
    course: 'LCM',
    totalSeconds: 65.2,
    verificationStatus: 'verified',
  }
  Object.assign(input.sessions[0].record, {
    timed_results: [
      result,
      { ...result, id: 'missing', totalSeconds: null },
      {
        ...result,
        id: 'provisional',
        verificationStatus: 'provisional',
        totalSeconds: 50,
      },
      {
        ...result,
        id: 'unverified',
        verificationStatus: 'unverified',
        totalSeconds: 40,
      },
    ],
  })
  Object.assign(input.sessions[1].record, {
    timed_results: [{ ...result, id: 'race-2', totalSeconds: 64.8 }],
  })
  const checked = checkedBridge(input)
  const repo = repository()
  const batch = await repo.importBridgeArchive(
    checked.raw,
    options(),
    'measured.json',
    'coach',
    sourceReaders(checked.files),
  )
  const results = repo.getPerformanceResultsByAthleteId('athlete-1')
  assert.equal(results.length, 2)
  assert.equal(recordedPersonalBests(results)[0].totalSeconds, 64.8)
  assert.equal(
    repo.getPerformanceComparison(results[0].id).previousResultId,
    results[1].id,
  )
  assert.equal(
    athleteTrainingSummary(repo.getArchiveState(), 'athlete-1', '2026')
      .unverifiedMeasurements,
    1,
  )
  assert.equal(repo.getPerformanceResultsByAthleteId('athlete-2').length, 0)
  repo.rollbackArchiveBatch(batch.id, 'Synthetic rollback', 'coach')
  assert.equal(repo.getPerformanceResultsByAthleteId('athlete-1').length, 0)
})

test('unknown measured result layouts block import instead of discarding measurements', async () => {
  const input = bridge()
  Object.assign(input.sessions[0].record, {
    timed_results: [{ athlete_name: 'Fictional One', time: 'unknown shape' }],
  })
  const checked = checkedBridge(input)
  const repo = repository()
  await assert.rejects(
    repo.importBridgeArchive(
      checked.raw,
      options(),
      'unknown.json',
      'coach',
      sourceReaders(checked.files),
    ),
    /Unsupported measured-result/,
  )
  assert.deepEqual(repo.getArchiveState(), emptyArchive())
})

test('source-provided timestamps are reused exactly and conflicting manual overrides block import', async () => {
  const value = bridge()
  for (const entry of value.sessions)
    Object.assign(entry.record, {
      starts_at:
        options().startsAtBySessionId[entry.archive_id as 'A' | 'B' | 'C'],
    })
  const checked = checkedBridge(value)
  const reconciliation = { ...options(), startsAtBySessionId: {} }
  const converted = adaptBridgeV02(checked.raw, reconciliation)
  assert.equal(converted.sessions[0].startsAt, options().startsAtBySessionId.A)
  const saved = savedBridgeReconciliation(
    emptyArchive(),
    reconciliation.archiveId,
    checked.raw,
  )
  assert.deepEqual(saved.times, options().startsAtBySessionId)
  const conflicting = options()
  conflicting.startsAtBySessionId.A = '2026-10-29T07:00:00+10:00'
  const repo = repository()
  await assert.rejects(
    repo.importBridgeArchive(
      checked.raw,
      conflicting,
      'times.json',
      'coach',
      sourceReaders(checked.files),
    ),
    /conflicting source and reconciled/,
  )
  assert.deepEqual(repo.getArchiveState(), emptyArchive())
})

test('corrupt cached identities, time links or source-check evidence cannot be restored', async () => {
  const checked = checkedBridge(bridge())
  const repo = repository()
  await repo.importBridgeArchive(
    checked.raw,
    options(),
    'checked.json',
    'coach',
    sourceReaders(checked.files),
  )
  const cases = Array.from({ length: 6 }, () => repo.getArchiveState())
  cases[0].bridge!.audit = []
  cases[1].bridge!.identities[0].athleteId = 'unknown-athlete'
  cases[2].bridge!.sessions[0].startsAt = '2026-10-29T07:00:00+10:00'
  cases[3].batches[0].sourceChecks = []
  cases[4].bridge!.identities.push(
    structuredClone(cases[4].bridge!.identities[0]),
  )
  cases[5].bridge!.identities[0].active = false
  for (const archive of cases) {
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
