import assert from 'node:assert/strict'
import test from 'node:test'
import { athleteTrainingSummary, brisbaneDate, validateSeason } from '../src/domain/athlete-workspace.ts'
import { syntheticArchive, syntheticAthlete } from '../src/data/synthetic-archive.ts'
import { InMemoryCoachingRepository } from '../src/repositories/in-memory-coaching-repository.ts'

test('Brisbane civil date is independent of source offset and crosses UTC year boundary', () => {
  assert.equal(brisbaneDate('2026-12-31T14:00:00Z'), '2027-01-01')
  assert.equal(brisbaneDate('2027-01-01T00:30:00+11:00'), '2026-12-31')
})

test('season validation rejects impossible, empty and reversed ranges', () => {
  for (const season of [
    { startDate: '', endDate: '2026-12-31' },
    { startDate: '2026-02-30', endDate: '2026-12-31' },
    { startDate: '2027-01-01', endDate: '2026-12-31' },
  ]) assert.equal(validateSeason(season), false)
  assert.equal(validateSeason({ startDate: '2028-02-29', endDate: '2028-02-29' }), true)
})

test('cross-year season totals include Brisbane boundaries, exact actual metres and rollback', () => {
  const repo = new InMemoryCoachingRepository({ athletes: [syntheticAthlete], observations: [], interpretations: [], priorities: [], decisions: [], performanceResults: [] })
  const input = structuredClone(syntheticArchive)
  input.sessions[0].startsAt = '2026-12-31T14:00:00Z'
  input.sessions[0].participants[0].completedDistanceMeters = 4125
  input.sessions[1].startsAt = '2027-01-03T23:00:00+10:00'
  input.sessions[2].startsAt = '2027-01-04T00:00:00+10:00'
  const batch = repo.importArchive(input, 'synthetic.json', 'synthetic-reviewer')
  const season = { startDate: '2027-01-01', endDate: '2027-01-03' }
  const summary = () => athleteTrainingSummary(repo.getArchiveState(), syntheticAthlete.id, season)
  assert.equal(summary().rows.length, 2)
  assert.equal(summary().completedMeters, 4125)
  assert.equal(summary().missingDistance, 1)
  assert.deepEqual(summary().weeks, [{ week: '2026-12-28', completedMeters: 4125, missingDistance: 1 }])
  assert.equal(repo.reviewArchive(input).every((row) => row.status === 'duplicate'), true)
  assert.equal(summary().completedMeters, 4125)
  repo.rollbackArchiveBatch(batch.id, 'synthetic correction', 'synthetic-reviewer')
  assert.equal(summary().rows.length, 0)
  assert.equal(summary().completedMeters, null)
})

test('verified bests exclude faster unverified results and retain course, type and source', async () => {
  const { verifiedPersonalBests } = await import('../src/domain/athlete-workspace.ts')
  const repo = new InMemoryCoachingRepository({ athletes: [syntheticAthlete], observations: [], interpretations: [], priorities: [], decisions: [], performanceResults: [] })
  repo.importArchive(structuredClone(syntheticArchive), 'synthetic.json', 'synthetic-reviewer')
  const verified = repo.getPerformanceResultsByAthleteId(syntheticAthlete.id)[0]
  const unverified = { ...verified, id: 'unverified', totalSeconds: 1, archiveProvenance: undefined }
  assert.deepEqual(verifiedPersonalBests([unverified, verified]), [verified])
  assert.deepEqual(verifiedPersonalBests([unverified]), [])
  assert.equal(verifiedPersonalBests([verified])[0].archiveProvenance?.sourceFileName, 'synthetic-session-2.json')
})
