import assert from 'node:assert/strict'
import test from 'node:test'

import { calculatePerformanceProgression } from '../src/domain/performance-progression.ts'
import type {
  PerformanceComparison,
  PerformanceResult,
} from '../src/types/performance/index.ts'

function result(
  id: string,
  occurredAt: string,
  totalSeconds: number,
  overrides: Partial<PerformanceResult> = {},
): PerformanceResult {
  return {
    id,
    athleteId: 'athlete-1',
    resultType: 'competition',
    occurredAt,
    event: '100 m freestyle',
    distance: 100,
    stroke: 'freestyle',
    course: 'LCM',
    totalSeconds,
    segments: [
      { segmentIndex: 1, distanceFrom: 0, distanceTo: 50, seconds: 27 },
      {
        segmentIndex: 2,
        distanceFrom: 50,
        distanceTo: 100,
        seconds: totalSeconds - 27,
      },
    ],
    source: 'manual',
    qualityStatus: 'valid',
    createdAt: occurredAt,
    createdBy: 'coach-1',
    ...overrides,
  }
}

function comparison(
  resultId: string,
  overrides: Partial<PerformanceComparison> = {},
): PerformanceComparison {
  return {
    resultId,
    segmentComparisons: [],
    benchmarkMatchStatus: 'unavailable',
    findings: [],
    ...overrides,
  }
}

function comparisonMap(...comparisons: PerformanceComparison[]) {
  return new Map(comparisons.map((item) => [item.resultId, item]))
}

test('filters the selected event group and orders it chronologically', () => {
  const selected = result('selected', '2026-03-01T00:00:00Z', 56)
  const older = result('older', '2026-01-01T00:00:00Z', 58)
  const otherAthlete = result('other-athlete', '2026-02-01T00:00:00Z', 57, {
    athleteId: 'athlete-2',
  })
  const otherStroke = result('other-stroke', '2026-02-01T00:00:00Z', 57, {
    stroke: 'backstroke',
  })
  const otherCourse = result('other-course', '2026-02-01T00:00:00Z', 57, {
    course: 'SCM',
  })
  const otherDistance = result('other-distance', '2026-02-01T00:00:00Z', 117, {
    distance: 200,
  })

  const progression = calculatePerformanceProgression(
    older,
    [selected, otherAthlete, otherStroke, otherCourse, otherDistance, older],
    comparisonMap(comparison(selected.id), comparison(older.id)),
  )

  assert.deepEqual(
    progression.points.map((point) => point.resultId),
    ['older', 'selected'],
  )
  assert.equal(progression.points[0].isLatest, false)
  assert.equal(progression.points[0].isSelected, true)
  assert.equal(progression.points[1].isLatest, true)
  assert.equal(progression.points[1].isSelected, false)
})

test('identifies PB and carries previous and benchmark deltas', () => {
  const older = result('older', '2026-01-01T00:00:00Z', 58)
  const selected = result('selected', '2026-02-01T00:00:00Z', 56)
  const progression = calculatePerformanceProgression(
    selected,
    [selected, older],
    comparisonMap(
      comparison(older.id, { pbTotalDifferenceSeconds: 2 }),
      comparison(selected.id, {
        previousTotalDifferenceSeconds: -2,
        pbResultId: selected.id,
        pbTotalDifferenceSeconds: 0,
        benchmarkMatchStatus: 'exact',
        benchmarkTotalDifferenceSeconds: 1.5,
      }),
    ),
  )

  assert.equal(progression.points[1].isPb, true)
  assert.equal(progression.points[1].previousDifferenceSeconds, -2)
  assert.equal(progression.points[1].pbDifferenceSeconds, 0)
  assert.equal(progression.points[1].benchmarkDifferenceSeconds, 1.5)
  assert.equal(progression.points[1].benchmarkSeconds, 54.5)
})

test('omits benchmark values when no applicable benchmark exists', () => {
  const selected = result('selected', '2026-01-01T00:00:00Z', 56)
  const progression = calculatePerformanceProgression(
    selected,
    [selected],
    comparisonMap(comparison(selected.id)),
  )

  assert.equal(progression.points[0].benchmarkDifferenceSeconds, undefined)
  assert.equal(progression.points[0].benchmarkSeconds, undefined)
})

test('reports insufficient history for one comparable result', () => {
  const selected = result('selected', '2026-01-01T00:00:00Z', 56)
  const progression = calculatePerformanceProgression(
    selected,
    [selected],
    comparisonMap(comparison(selected.id)),
  )

  assert.equal(progression.direction, 'insufficient')
  assert.match(progression.findings[0], /Insufficient comparable results/)
})

test('reports an improving sequence and the latest fastest result', () => {
  const results = [
    result('one', '2026-01-01T00:00:00Z', 59),
    result('two', '2026-02-01T00:00:00Z', 58),
    result('three', '2026-03-01T00:00:00Z', 57),
  ]
  const progression = calculatePerformanceProgression(
    results[2],
    results,
    comparisonMap(
      comparison('one'),
      comparison('two', { previousTotalDifferenceSeconds: -1 }),
      comparison('three', {
        previousTotalDifferenceSeconds: -1,
        pbResultId: 'three',
        pbTotalDifferenceSeconds: 0,
      }),
    ),
  )

  assert.equal(progression.direction, 'positive')
  assert.match(progression.findings.join(' '), /Improved across the last 3/)
  assert.match(progression.findings.join(' '), /fastest in the series/)
})

test('includes final-only results in total-time progression', () => {
  const earlier = result('earlier', '2026-01-01T00:00:00Z', 58, {
    segments: [],
  })
  const selected = result('selected', '2026-02-01T00:00:00Z', 57, {
    segments: [],
  })
  const progression = calculatePerformanceProgression(
    selected,
    [selected, earlier],
    comparisonMap(
      comparison(earlier.id),
      comparison(selected.id, {
        previousTotalDifferenceSeconds: -1,
        pbResultId: selected.id,
        pbTotalDifferenceSeconds: 0,
      }),
    ),
  )

  assert.deepEqual(
    progression.points.map((point) => point.totalSeconds),
    [58, 57],
  )
  assert.equal(progression.direction, 'positive')
})

test('distinguishes flat and deteriorating recent sequences', () => {
  const flatResults = [
    result('flat-one', '2026-01-01T00:00:00Z', 57),
    result('flat-two', '2026-02-01T00:00:00Z', 57.03),
    result('flat-three', '2026-03-01T00:00:00Z', 57.01),
  ]
  const slowerResults = [
    result('slow-one', '2026-01-01T00:00:00Z', 57),
    result('slow-two', '2026-02-01T00:00:00Z', 58),
    result('slow-three', '2026-03-01T00:00:00Z', 59),
  ]

  const flat = calculatePerformanceProgression(
    flatResults[2],
    flatResults,
    comparisonMap(...flatResults.map((item) => comparison(item.id))),
  )
  const deteriorating = calculatePerformanceProgression(
    slowerResults[2],
    slowerResults,
    comparisonMap(...slowerResults.map((item) => comparison(item.id))),
  )

  assert.equal(flat.direction, 'flat')
  assert.match(flat.findings[0], /No meaningful improvement/)
  assert.equal(deteriorating.direction, 'negative')
  assert.match(deteriorating.findings[0], /Slower across/)
})
