import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  createOfficialResultsPreview,
  createOfficialResultDuplicateKey,
  isDuplicateOfficialResult,
  parseOfficialResultsCsv,
} from '../src/data-sources/official-results-csv.ts'
import type { PerformanceResult } from '../src/types/performance/index.ts'

const fixture = readFileSync(
  new URL('./fixtures/official-results.csv', import.meta.url),
  'utf8',
)
const participantResultsFixture = readFileSync(
  new URL(
    './fixtures/swimming-australia-participant-results.csv',
    import.meta.url,
  ),
  'utf8',
)

test('parses the exact Swimming Australia participant-results export', () => {
  const rows = parseOfficialResultsCsv(participantResultsFixture, 'Sam Gould')

  assert.equal(rows.length, 4)
  assert.equal(rows.every((row) => row.reason === undefined), true)
  assert.deepEqual(
    rows.map((row) => ({
      date: row.result?.occurredAt,
      meet: row.result?.meetName,
      stroke: row.result?.stroke,
      distance: row.result?.distance,
      course: row.result?.course,
      age: row.result?.age,
      verified: row.result?.verified,
      verificationStatus: row.result?.verificationStatus,
      time: row.result?.totalSeconds,
      segments: [],
    })),
    [
      {
        date: '2026-08-08T00:00:00.000Z',
        meet: '2026 Hancock Prospecting Qld SC Championships',
        stroke: 'freestyle',
        distance: 100,
        course: 'SCM',
        age: 25,
        verified: true,
        verificationStatus: 'verified',
        time: 59.02,
        segments: [],
      },
      {
        date: '2026-08-07T00:00:00.000Z',
        meet: '2026 Hancock Prospecting Qld SC Championships',
        stroke: 'backstroke',
        distance: 100,
        course: 'SCM',
        age: 25,
        verified: true,
        verificationStatus: 'verified',
        time: 68.03,
        segments: [],
      },
      {
        date: '2026-07-25T00:00:00.000Z',
        meet: 'Glasgow 2026 Commonwealth Games',
        stroke: 'freestyle',
        distance: 200,
        course: 'LCM',
        age: 25,
        verified: true,
        verificationStatus: 'verified',
        time: 131.2,
        segments: [],
      },
      {
        date: '2026-07-24T00:00:00.000Z',
        meet: 'Glasgow 2026 Commonwealth Games',
        stroke: 'backstroke',
        distance: 50,
        course: 'LCM',
        age: 25,
        verified: true,
        verificationStatus: 'verified',
        time: 32.63,
        segments: [],
      },
    ],
  )
})

test('accepts Yes, No and N/A verification statuses', () => {
  const csv = [
    'Date,Meet,Stroke,Distance,Course,Age,Verified,Time',
    '08/08/2026,Meet,Freestyle,100,Short,25,Yes,59.02',
    '07/08/2026,Meet,Backstroke,100,Short,25,N/A,1:08.03',
    '06/08/2026,Meet,Breaststroke,100,Long,25,No,1:12.03',
  ].join('\n')
  const rows = parseOfficialResultsCsv(csv, 'Sam Gould')

  assert.equal(rows.every((row) => row.reason === undefined), true)
  assert.deepEqual(
    rows.map((row) => ({
      verified: row.result?.verified,
      status: row.result?.verificationStatus,
    })),
    [
      { verified: true, status: 'verified' },
      { verified: undefined, status: 'not-applicable' },
      { verified: false, status: 'unverified' },
    ],
  )
})

test('verification status does not weaken required race-field validation', () => {
  const csv = [
    'Date,Meet,Stroke,Distance,Course,Age,Verified,Time',
    'not-a-date,Meet,Freestyle,100,Short,25,N/A,59.02',
    '08/08/2026,Meet,Unknown,100,Short,25,N/A,59.02',
    '08/08/2026,Meet,Freestyle,not-a-distance,Short,25,N/A,59.02',
    '08/08/2026,Meet,Freestyle,100,Unknown,25,N/A,59.02',
    '08/08/2026,Meet,Freestyle,100,Short,25,N/A,not-a-time',
  ].join('\n')
  const rows = parseOfficialResultsCsv(csv, 'Sam Gould')

  assert.equal(rows.every((row) => row.result === undefined), true)
  assert.match(rows.map((row) => row.reason).join(' '), /date/)
  assert.match(rows.map((row) => row.reason).join(' '), /stroke/)
  assert.match(rows.map((row) => row.reason).join(' '), /distance/)
  assert.match(rows.map((row) => row.reason).join(' '), /course/)
  assert.match(rows.map((row) => row.reason).join(' '), /time/)
})

test('parses valid official rows independently of column order', () => {
  const rows = parseOfficialResultsCsv(fixture, 'Sam Gould')
  const first = rows[0].result
  const second = rows[1].result

  assert.equal(first?.externalResultId, 'race-100')
  assert.equal(first?.meetName, 'Queensland, State Championships')
  assert.equal(first?.occurredAt, '2026-08-15T00:00:00.000Z')
  assert.equal(first?.stroke, 'freestyle')
  assert.equal(first?.course, 'LCM')
  assert.equal(first?.totalSeconds, 55.42)
  assert.equal(second?.occurredAt, '2026-07-12T00:00:00.000Z')
  assert.equal(second?.course, 'SCM')
  assert.equal(second?.totalSeconds, 121.35)
})

test('maps recognized stroke and course aliases', () => {
  const csv = [
    'Date,Meet,Stroke,Distance,Course,Time',
    '2026-01-01,Meet,Back,100,SC,1:01.20',
    '2026-01-02,Meet,Breast,100,Long Course,1:08.20',
    '2026-01-03,Meet,Fly,100,LCM,59.20',
    '2026-01-04,Meet,IM,200,SCM,2:10.20',
  ].join('\n')
  const rows = parseOfficialResultsCsv(csv, 'Sam Gould')

  assert.deepEqual(
    rows.map((row) => [row.result?.stroke, row.result?.course]),
    [
      ['backstroke', 'SCM'],
      ['breaststroke', 'LCM'],
      ['butterfly', 'LCM'],
      ['individual-medley', 'SCM'],
    ],
  )
})

test('rejects malformed and athlete-mismatched rows', () => {
  const rows = parseOfficialResultsCsv(fixture, 'Sam Gould')

  assert.match(rows[2].reason ?? '', /time/)
  assert.match(rows[3].reason ?? '', /does not match Sam Gould/)
  assert.equal(rows[2].result, undefined)
  assert.equal(rows[3].result, undefined)
})

test('detects duplicates by external ID or deterministic fields', () => {
  const parsed = parseOfficialResultsCsv(fixture, 'Sam Gould')[0].result!
  const duplicateKey = createOfficialResultDuplicateKey('sam-gould', parsed)
  const existing = {
    id: 'imported',
    athleteId: 'sam-gould',
    resultType: 'competition',
    occurredAt: parsed.occurredAt,
    event: '100 m freestyle',
    distance: 100,
    stroke: 'freestyle',
    course: 'LCM',
    totalSeconds: parsed.totalSeconds,
    segments: [],
    source: 'import',
    qualityStatus: 'valid',
    createdAt: parsed.occurredAt,
    createdBy: 'coach-1',
    importMetadata: {
      provider: 'Swimming Australia CSV',
      sourceType: 'csv',
      sourceFileName: 'official-results.csv',
      meetName: parsed.meetName,
      externalResultId: parsed.externalResultId,
      duplicateKey,
      importedAt: parsed.occurredAt,
    },
  } satisfies PerformanceResult

  assert.equal(
    isDuplicateOfficialResult('sam-gould', parsed, [existing]),
    true,
  )
  assert.equal(
    createOfficialResultDuplicateKey('sam-gould', {
      ...parsed,
      externalResultId: undefined,
    }),
    [
      'swimming-australia',
      'sam-gould',
      '2026-08-15',
      'queensland, state championships',
      '100',
      'freestyle',
      'LCM',
      '55.42',
      'final',
    ].join('|'),
  )
})

test('keeps legitimate same-event swims with different final times distinct', () => {
  const rows = parseOfficialResultsCsv(
    [
      'Date,Meet,Stroke,Distance,Course,Age,Verified,Time',
      '08/08/2026,Championships,Freestyle,100,Short,25,Yes,59.02',
      '08/08/2026,Championships,Freestyle,100,Short,25,Yes,58.71',
    ].join('\n'),
    'Sam Gould',
  )
  const preview = createOfficialResultsPreview('sam-gould', rows, [])

  assert.deepEqual(preview.map((row) => row.duplicate), [false, false])
  assert.notEqual(
    createOfficialResultDuplicateKey('sam-gould', rows[0].result!),
    createOfficialResultDuplicateKey('sam-gould', rows[1].result!),
  )
})

test('identifies a truly identical source row before import', () => {
  const csv = [
    'Date,Meet,Stroke,Distance,Course,Age,Verified,Time',
    '24/08/2025,Virtus Swimming World Championships,Backstroke,50,Long,24,Yes,33.17',
    '24/08/2025,Virtus Swimming World Championships,Backstroke,50,Long,24,Yes,33.17',
  ].join('\n')
  const rows = parseOfficialResultsCsv(csv, 'Sam Gould')
  const preview = createOfficialResultsPreview('sam-gould', rows, [])

  assert.equal(preview.filter((row) => !row.duplicate).length, 1)
  assert.equal(preview.filter((row) => row.duplicate).length, 1)
  assert.equal(preview[1].duplicateOfRowNumber, 2)
})
