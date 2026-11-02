import assert from 'node:assert/strict'
import test from 'node:test'
import { adaptBridgeV02 } from '../src/data-sources/ripe-bridge-v02-adapter.ts'
import { parseRipeArchive, reviewRipeArchive, emptyArchive } from '../src/data-sources/ripe-archive.ts'

const sha = (c: string) => c.repeat(64)
function bridge() {
  return {
    schema: 'ripe-verified-archive-v1',
    exported_utc: '2026-11-02T05:28:13Z',
    sessions: [
      {
        archive_id: 'A',
        source_sha256: sha('a'),
        source_location: 'D:\\PRIVATE\\do-not-expose.json',
        record: {
          session_id: 'A',
          date: '2026-10-29',
          course: 'LCM',
          status: 'coach_verified',
          distance_m: { 'Fictional One': 4000 },
          timed_results_count: 10,
        },
      },
      {
        archive_id: 'B',
        source_sha256: sha('b'),
        source_location: 'D:\\PRIVATE\\do-not-expose-2.json',
        record: {
          archive_id: 'B',
          date: '2026-10-29',
          session: 'PM',
          status: 'coach_verified',
          athlete_distances_m: { 'Fictional One': 4300 },
          timed_results: [],
        },
      },
      {
        archive_id: 'C',
        source_sha256: sha('c'),
        source_location: 'D:\\PRIVATE\\do-not-expose-3.json',
        record: {
          archive_id: 'C',
          date: '2026-10-30',
          period: 'AM',
          review_status: 'coach_confirmed',
          planned_main_group_m: 5300,
          present: ['Fictional One'],
          absent: { 'Fictional Two': 'not attending' },
          provisional_early_exit: { distance_m: 3200, distance_status: 'provisional' },
          performance_protocols: [{ note: 'timing not transcribed' }],
        },
      },
    ],
  }
}
function options() {
  return {
    archiveId: 'bridge-synthetic',
    athleteIdsBySourceName: { 'Fictional One': 'athlete-1', 'Fictional Two': 'athlete-2' },
    startsAtBySessionId: {
      A: '2026-10-29T06:00:00+10:00',
      B: '2026-10-29T16:00:00+10:00',
      C: '2026-10-30T06:00:00+10:00',
    },
    attestedBy: 'synthetic-reviewer',
    attestedAt: '2026-11-02T16:00:00+10:00',
  }
}

test('adapts all three Bridge v0.2 wire variants without inventing times or completed metres', () => {
  const result = parseRipeArchive(JSON.stringify(adaptBridgeV02(bridge(), options())))
  assert.equal(result.sessions.length, 3)
  assert.deepEqual(result.sessions.map(s => s.participants[0].completedDistanceMeters), [4000, 4300, null])
  assert.equal(result.sessions[2].plannedDistanceMeters, 5300)
  assert.equal(result.sessions[2].participants[1].attendance, 'absent')
  assert.equal(result.sessions[2].participants[1].completedDistanceMeters, null)
  assert.ok(result.sessions.every(s => s.participants.every(p => p.performances.length === 0)))
  assert.ok(!JSON.stringify(result).includes('PRIVATE'))
  assert.equal(result.sessions[0].source.checksum, `sha256:${sha('a')}`)
  assert.ok(reviewRipeArchive(result, emptyArchive(), ['athlete-1', 'athlete-2']).every(r => r.status === 'ready'))
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
  Object.assign(b3.sessions[2].record, { present: ['Fictional One', 'Fictional Two'] })
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
