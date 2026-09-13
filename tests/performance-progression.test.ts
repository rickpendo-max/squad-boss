import assert from 'node:assert/strict'
import test from 'node:test'

import { athletes } from '../src/data/athletes.ts'
import { calculatePerformanceComparison } from '../src/domain/performance-comparison.ts'
import { calculatePerformanceProgression } from '../src/domain/performance-progression.ts'
import type {
  BenchmarkProfile,
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
  assert.match(flat.findings.join(' '), /No meaningful improvement/)
  assert.equal(deteriorating.direction, 'negative')
  assert.match(deteriorating.findings.join(' '), /Slower across/)
})

test('highlights a repeated back-half fade from comparable split evidence', () => {
  const results = [
    result('one', '2026-01-01T00:00:00Z', 57),
    result('two', '2026-02-01T00:00:00Z', 58),
    result('three', '2026-03-01T00:00:00Z', 59),
  ]

  const progression = calculatePerformanceProgression(
    results[2],
    results,
    comparisonMap(...results.map((item) => comparison(item.id))),
  )

  assert.match(progression.findings[0], /Repeated back-half fade/)
  assert.match(progression.findings[0], /3 of the last 3/)
})

test('does not infer a back-half fade from final-time-only results', () => {
  const results = [
    result('one', '2026-01-01T00:00:00Z', 57, { segments: [] }),
    result('two', '2026-02-01T00:00:00Z', 58, { segments: [] }),
    result('three', '2026-03-01T00:00:00Z', 59, { segments: [] }),
  ]

  const progression = calculatePerformanceProgression(
    results[2],
    results,
    comparisonMap(...results.map((item) => comparison(item.id))),
  )

  assert.doesNotMatch(progression.findings.join(' '), /back-half fade/)
})

test('isolates PB, previous, progression and benchmarks by course', () => {
  const lcmOlder = result('lcm-older', '2026-01-01T00:00:00Z', 59)
  const scmOlder = result('scm-older', '2026-02-01T00:00:00Z', 57, {
    course: 'SCM',
  })
  const lcmLatest = result('lcm-latest', '2026-03-01T00:00:00Z', 58.5)
  const scmLatest = result('scm-latest', '2026-04-01T00:00:00Z', 56.5, {
    course: 'SCM',
  })
  const results = [lcmOlder, scmOlder, lcmLatest, scmLatest]
  const benchmarks: BenchmarkProfile[] = [
    {
      id: 'lcm-benchmark',
      benchmarkSetId: 'test-benchmarks',
      event: '100 m freestyle',
      distance: 100,
      stroke: 'freestyle',
      course: 'LCM',
      basis: 'Course-isolation test',
      segments: [
        { segmentIndex: 1, distanceFrom: 0, distanceTo: 50, expectedSeconds: 29, metricCode: 'lcm-1', unit: 'seconds' },
        { segmentIndex: 2, distanceFrom: 50, distanceTo: 100, expectedSeconds: 30, metricCode: 'lcm-2', unit: 'seconds' },
      ],
    },
    {
      id: 'scm-benchmark',
      benchmarkSetId: 'test-benchmarks',
      event: '100 m freestyle',
      distance: 100,
      stroke: 'freestyle',
      course: 'SCM',
      basis: 'Course-isolation test',
      segments: [
        { segmentIndex: 1, distanceFrom: 0, distanceTo: 50, expectedSeconds: 28, metricCode: 'scm-1', unit: 'seconds' },
        { segmentIndex: 2, distanceFrom: 50, distanceTo: 100, expectedSeconds: 29, metricCode: 'scm-2', unit: 'seconds' },
      ],
    },
  ]
  const athlete = { ...athletes[0], personalBests: [] }
  const comparisons = new Map(
    results.map((item) => [
      item.id,
      calculatePerformanceComparison(item, results, athlete, benchmarks),
    ]),
  )
  const lcmComparison = comparisons.get(lcmLatest.id)!
  const scmComparison = comparisons.get(scmLatest.id)!
  const lcmProgression = calculatePerformanceProgression(
    lcmLatest,
    results,
    comparisons,
  )
  const scmProgression = calculatePerformanceProgression(
    scmLatest,
    results,
    comparisons,
  )

  assert.equal(lcmComparison.pbResultId, lcmLatest.id)
  assert.equal(lcmComparison.previousResultId, lcmOlder.id)
  assert.equal(lcmComparison.previousTotalDifferenceSeconds, -0.5)
  assert.equal(lcmComparison.pbTotalDifferenceSeconds, 0)
  assert.equal(lcmComparison.benchmarkProfileId, 'lcm-benchmark')
  assert.deepEqual(
    lcmProgression.points.map((point) => [point.resultId, point.totalSeconds]),
    [['lcm-older', 59], ['lcm-latest', 58.5]],
  )
  assert.equal(
    lcmProgression.points.find((point) => point.isPb)?.totalSeconds,
    58.5,
  )

  assert.equal(scmComparison.pbResultId, scmLatest.id)
  assert.equal(scmComparison.previousResultId, scmOlder.id)
  assert.equal(scmComparison.previousTotalDifferenceSeconds, -0.5)
  assert.equal(scmComparison.pbTotalDifferenceSeconds, 0)
  assert.equal(scmComparison.benchmarkProfileId, 'scm-benchmark')
  assert.deepEqual(
    scmProgression.points.map((point) => [point.resultId, point.totalSeconds]),
    [['scm-older', 57], ['scm-latest', 56.5]],
  )
  assert.equal(
    scmProgression.points.find((point) => point.isPb)?.totalSeconds,
    56.5,
  )

  assert.equal(comparisons.get(lcmOlder.id)?.pbTotalDifferenceSeconds, 0.5)
  assert.equal(comparisons.get(scmOlder.id)?.pbTotalDifferenceSeconds, 0.5)
})
