import assert from 'node:assert/strict'
import test from 'node:test'
import { adaptBridgeV02 } from '../src/data-sources/ripe-bridge-v02-adapter.ts'
import {
  parseRipeArchive,
  reviewRipeArchive,
  emptyArchive,
} from '../src/data-sources/ripe-archive.ts'

import { bridge, options, sha } from './fixtures/bridge-v02-synthetic.ts'
import { InMemoryCoachingRepository } from '../src/repositories/in-memory-coaching-repository.ts'
import { syntheticAthlete } from '../src/data/synthetic-archive.ts'
import { athleteTrainingSummary } from '../src/domain/athlete-workspace.ts'
import {
  loadPersistedCoachingData,
  savePersistedCoachingData,
} from '../src/repositories/local-coaching-persistence.ts'

test('adapts all three Bridge v0.2 wire variants without inventing times or completed metres', () => {
  const result = parseRipeArchive(
    JSON.stringify(adaptBridgeV02(bridge(), options())),
  )
  assert.equal(result.sessions.length, 3)
  assert.deepEqual(
    result.sessions.map((s) => s.participants[0].completedDistanceMeters),
    [4000, 4300, null],
  )
  assert.equal(result.sessions[2].plannedDistanceMeters, 5300)
  assert.equal(result.sessions[2].participants[1].attendance, 'absent')
  assert.equal(result.sessions[2].participants[1].completedDistanceMeters, null)
  assert.ok(
    result.sessions.every((s) =>
      s.participants.every((p) => p.performances.length === 0),
    ),
  )
  assert.ok(!JSON.stringify(result).includes('PRIVATE'))
  assert.equal(result.sessions[0].source.checksum, `sha256:${sha('a')}`)
  assert.ok(
    reviewRipeArchive(result, emptyArchive(), ['athlete-1', 'athlete-2']).every(
      (r) => r.status === 'ready',
    ),
  )
})

test('blocks unknown identities, missing session times, invalid approvals and conflicting attendance', () => {
  const b = bridge()
  const o = options()
  o.athleteIdsBySourceName['Fictional Two'] = ''
  assert.throws(() => adaptBridgeV02(b, o), /unmapped/)
  const o2 = options()
  o2.startsAtBySessionId.A = ''
  assert.throws(() => adaptBridgeV02(b, o2), /confirmed/)
  const b2 = bridge()
  Object.assign(b2.sessions[0].record, { status: 'pending' })
  assert.throws(() => adaptBridgeV02(b2, options()), /not coach-verified/)
  const b3 = bridge()
  Object.assign(b3.sessions[2].record, {
    present: ['Fictional One', 'Fictional Two'],
  })
  assert.throws(() => adaptBridgeV02(b3, options()), /conflicting attendance/)
})

test('rejects repeated source session identities and invalid checksums', () => {
  const b = bridge()
  b.sessions[1].archive_id = 'A'
  assert.throws(() => adaptBridgeV02(b, options()), /repeated/)
  const b2 = bridge()
  b2.sessions[0].source_sha256 = 'not-a-hash'
  assert.throws(() => adaptBridgeV02(b2, options()), /checksum/)
})

test('rejects contradictory approval markers even when another marker is positive', () => {
  for (const markers of [
    { status: 'pending', review_status: 'coach_confirmed' },
    { status: 'coach_verified', coach_approval: 'rejected' },
    { status: 'coach_verified', review_status: null },
  ]) {
    const input = bridge()
    Object.assign(input.sessions[0].record, markers)
    assert.throws(() => adaptBridgeV02(input, options()), /not coach-verified/)
  }
})

test('distance aliases cannot silently overwrite conflicting completed metres', () => {
  const input = bridge()
  Object.assign(input.sessions[0].record, {
    athlete_distances_m: { 'Fictional One': 4200 },
  })
  assert.throws(
    () => adaptBridgeV02(input, options()),
    /conflicting completed distance/,
  )
  Object.assign(input.sessions[0].record, {
    athlete_distances_m: { 'Fictional One': 4000 },
  })
  assert.equal(
    adaptBridgeV02(input, options()).sessions[0].participants[0]
      .completedDistanceMeters,
    4000,
  )
})

test('explicit provisional distance status cannot be promoted to confirmed volume', () => {
  const input = bridge()
  Object.assign(input.sessions[0].record, { distance_status: 'provisional' })
  assert.throws(() => adaptBridgeV02(input, options()), /distance status/)
  Object.assign(input.sessions[0].record, { distance_status: 'verified' })
  assert.equal(
    adaptBridgeV02(input, options()).sessions[0].participants[0]
      .completedDistanceMeters,
    4000,
  )
})

test('date-only metadata and impossible offset-qualified timestamps fail closed', () => {
  for (const invalid of [
    '2026-11-02',
    '2026-02-30T06:00:00Z',
    '2026-11-02T24:00:00Z',
  ]) {
    const input = bridge()
    input.exported_utc = invalid
    assert.throws(() => adaptBridgeV02(input, options()))
    const reconciliation = options()
    reconciliation.attestedAt = invalid
    assert.throws(() => adaptBridgeV02(bridge(), reconciliation))
  }
  const reconciliation = options()
  reconciliation.startsAtBySessionId.A = '2026-10-29T24:00:00+10:00'
  assert.throws(() => adaptBridgeV02(bridge(), reconciliation))
})

test('date and period reconciliation cannot contradict source metadata', () => {
  const reconciliation = options()
  reconciliation.startsAtBySessionId.A = '2026-10-30T06:00:00+10:00'
  assert.throws(() => adaptBridgeV02(bridge(), reconciliation), /confirmed/)
  const input = bridge()
  Object.assign(input.sessions[1].record, { period: 'AM' })
  assert.throws(
    () => adaptBridgeV02(input, options()),
    /conflicting session period/,
  )
  const morning = options()
  morning.startsAtBySessionId.B = '2026-10-29T06:00:00+10:00'
  assert.throws(
    () => adaptBridgeV02(bridge(), morning),
    /conflicts with its period/,
  )
})

test('empty exports and missing approval evidence fail the canonical contract', () => {
  const input = bridge()
  input.sessions = []
  assert.throws(() => adaptBridgeV02(input, options()), /Invalid archive/)
  const unknown = bridge()
  Object.assign(unknown.sessions[0].record, { status: undefined })
  assert.throws(() => adaptBridgeV02(unknown, options()), /not coach-verified/)
})

test('stable identity reconciliation rejects aliases and inherited mappings', () => {
  const reconciliation = options()
  reconciliation.athleteIdsBySourceName['Fictional Two'] = 'athlete-1'
  assert.throws(
    () => adaptBridgeV02(bridge(), reconciliation),
    /multiple source names/,
  )
  reconciliation.athleteIdsBySourceName = Object.create(
    options().athleteIdsBySourceName,
  )
  assert.throws(() => adaptBridgeV02(bridge(), reconciliation), /unmapped/)
})

test('zero completed distance is retained without inventing attendance', () => {
  const input = bridge()
  input.sessions[0].record.distance_m!['Fictional One'] = 0
  const participant = adaptBridgeV02(input, options()).sessions[0]
    .participants[0]
  assert.equal(participant.completedDistanceMeters, 0)
  assert.equal(participant.attendance, 'unknown')
})

test('conversion preserves the raw source and strips private paths from persisted evidence', () => {
  const input = bridge()
  const before = JSON.stringify(input)
  const converted = adaptBridgeV02(input, options())
  assert.equal(JSON.stringify(input), before)
  assert.ok(!JSON.stringify(converted).includes('source_location'))
  assert.ok(!JSON.stringify(converted).includes('PRIVATE'))
})

test('converted sessions integrate idempotently with persistence, conflict detection and rollback', () => {
  const seed = () => ({
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
  const values = new Map<string, string>()
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
  }
  const repo = new InMemoryCoachingRepository(seed(), {
    createId: () => 'synthetic-bridge-batch',
    now: () => '2026-11-02T07:00:00Z',
    onChange: (data) =>
      savePersistedCoachingData(storage, data, undefined, true),
  })
  const converted = adaptBridgeV02(bridge(), options())
  const batch = repo.importArchive(
    converted,
    'synthetic-bridge.json',
    'synthetic-coach',
  )
  const summary = athleteTrainingSummary(
    repo.getArchiveState(),
    'athlete-1',
    '2026',
  )
  assert.equal(summary.completedMeters, 8300)
  assert.equal(summary.missingDistance, 1)
  assert.equal(summary.attended, 3)
  assert.equal(repo.getPerformanceResultsByAthleteId('athlete-1').length, 0)
  assert.ok(![...values.values()].join('').includes('PRIVATE'))
  const hydrated = new InMemoryCoachingRepository(
    loadPersistedCoachingData(storage, seed()),
  )
  assert.ok(
    hydrated
      .reviewArchive(converted)
      .every((row) => row.status === 'duplicate'),
  )
  assert.throws(
    () => hydrated.importArchive(converted, 'again.json', 'synthetic-coach'),
    /No importable/,
  )
  const changed = bridge()
  changed.sessions[0].record.distance_m!['Fictional One'] = 4100
  assert.equal(
    hydrated.reviewArchive(adaptBridgeV02(changed, options()))[0].status,
    'conflict',
  )
  hydrated.rollbackArchiveBatch(
    batch.id,
    'Synthetic rollback',
    'synthetic-coach',
  )
  assert.equal(
    athleteTrainingSummary(hydrated.getArchiveState(), 'athlete-1', '2026')
      .completedMeters,
    null,
  )
  assert.equal(hydrated.getArchiveState().sessions.length, 3)
})
