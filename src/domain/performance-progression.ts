import type {
  PerformanceComparison,
  PerformanceResult,
} from '../types/performance'

export type ProgressionDirection =
  | 'positive'
  | 'flat'
  | 'negative'
  | 'mixed'
  | 'insufficient'

export interface PerformanceProgressionPoint {
  resultId: string
  occurredAt: string
  totalSeconds: number
  previousDifferenceSeconds?: number
  pbDifferenceSeconds?: number
  benchmarkDifferenceSeconds?: number
  benchmarkSeconds?: number
  isPb: boolean
  isLatest: boolean
  isSelected: boolean
}

export interface PerformanceProgression {
  points: PerformanceProgressionPoint[]
  direction: ProgressionDirection
  findings: string[]
}

const MEANINGFUL_DIFFERENCE_SECONDS = 0.05

function round(value: number) {
  return Math.round(value * 100) / 100
}

function comparisonFinding(difference: number) {
  if (Math.abs(difference) <= MEANINGFUL_DIFFERENCE_SECONDS) {
    return 'Latest performance matches the PB.'
  }

  return difference < 0
    ? `Latest performance is ${Math.abs(difference).toFixed(2)} s faster than PB.`
    : `Latest performance is ${difference.toFixed(2)} s slower than PB.`
}

export function calculatePerformanceProgression(
  selectedResult: PerformanceResult,
  allResults: PerformanceResult[],
  comparisonsByResultId: ReadonlyMap<string, PerformanceComparison>,
): PerformanceProgression {
  const comparableResults = allResults
    .filter(
      (result) =>
        result.athleteId === selectedResult.athleteId &&
        result.distance === selectedResult.distance &&
        result.stroke === selectedResult.stroke &&
        result.course === selectedResult.course &&
        result.qualityStatus === 'valid',
    )
    .toSorted(
      (left, right) =>
        left.occurredAt.localeCompare(right.occurredAt) ||
        left.createdAt.localeCompare(right.createdAt),
    )

  const latestResult = comparableResults.at(-1)
  const points = comparableResults.map((result) => {
    const comparison = comparisonsByResultId.get(result.id)
    const benchmarkSeconds =
      comparison?.benchmarkTotalDifferenceSeconds === undefined
        ? undefined
        : round(
            result.totalSeconds - comparison.benchmarkTotalDifferenceSeconds,
          )

    return {
      resultId: result.id,
      occurredAt: result.occurredAt,
      totalSeconds: result.totalSeconds,
      previousDifferenceSeconds: comparison?.previousTotalDifferenceSeconds,
      pbDifferenceSeconds: comparison?.pbTotalDifferenceSeconds,
      benchmarkDifferenceSeconds: comparison?.benchmarkTotalDifferenceSeconds,
      benchmarkSeconds,
      isPb: comparison?.pbResultId === result.id,
      isLatest: result.id === latestResult?.id,
      isSelected: result.id === selectedResult.id,
    }
  })

  if (points.length < 2) {
    return {
      points,
      direction: 'insufficient',
      findings: [
        'Insufficient comparable results for a progression conclusion.',
      ],
    }
  }

  const recent = points.slice(-Math.min(3, points.length))
  const recentDifferences = recent.slice(1).map(
    (point, index) => point.totalSeconds - recent[index].totalSeconds,
  )
  const findings: string[] = []
  let direction: ProgressionDirection

  if (
    recentDifferences.every(
      (difference) => difference < -MEANINGFUL_DIFFERENCE_SECONDS,
    )
  ) {
    direction = 'positive'
    findings.push(
      `Improved across the last ${recent.length} comparable performances.`,
    )
  } else if (
    recentDifferences.every(
      (difference) => Math.abs(difference) <= MEANINGFUL_DIFFERENCE_SECONDS,
    )
  ) {
    direction = 'flat'
    findings.push(
      `No meaningful improvement across the last ${recent.length} comparable performances.`,
    )
  } else if (
    recentDifferences.every(
      (difference) => difference > MEANINGFUL_DIFFERENCE_SECONDS,
    )
  ) {
    direction = 'negative'
    findings.push(
      `Slower across the last ${recent.length} comparable performances.`,
    )
  } else {
    direction = 'mixed'
    findings.push(
      `Mixed direction across the last ${recent.length} comparable performances.`,
    )
  }

  const latestPoint = points.at(-1)!
  if (latestPoint.totalSeconds === Math.min(...points.map((point) => point.totalSeconds))) {
    findings.push('Latest performance is the fastest in the series.')
  }
  if (latestPoint.pbDifferenceSeconds !== undefined) {
    findings.push(comparisonFinding(latestPoint.pbDifferenceSeconds))
  }

  return { points, direction, findings: findings.slice(0, 3) }
}
