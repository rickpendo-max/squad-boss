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
  isPb: boolean
  isLatest: boolean
  isSelected: boolean
}

export interface PerformanceProgression {
  points: PerformanceProgressionPoint[]
  direction: ProgressionDirection
  findings: string[]
  distributionHighlight?: string
  recurringPattern?: string
}

const MEANINGFUL_DIFFERENCE_SECONDS = 0.05
const DISTRIBUTION_DIFFERENCE_THRESHOLD_SECONDS = 0.05

function comparisonFinding(difference: number) {
  if (Math.abs(difference) <= MEANINGFUL_DIFFERENCE_SECONDS) {
    return 'Latest performance matches the PB.'
  }

  return difference < 0
    ? `Latest performance is ${Math.abs(difference).toFixed(2)} s faster than PB.`
    : `Latest performance is ${difference.toFixed(2)} s slower than PB.`
}

function signedDifference(value: number) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)} s`
}

function distributionHighlight(comparison?: PerformanceComparison) {
  const distribution = comparison?.distributionSummary
  const largest = comparison?.largestAbsoluteSegmentDeviation

  if (!distribution || largest?.benchmarkDifferenceSeconds === undefined) {
    return undefined
  }

  const backEndIsMainDifference =
    distribution.secondHalfDifferenceSeconds >
      DISTRIBUTION_DIFFERENCE_THRESHOLD_SECONDS &&
    Math.abs(distribution.secondHalfDifferenceSeconds) >=
      Math.abs(distribution.firstHalfDifferenceSeconds)
  const frontEndIsMainDifference =
    distribution.firstHalfDifferenceSeconds >
      DISTRIBUTION_DIFFERENCE_THRESHOLD_SECONDS &&
    Math.abs(distribution.firstHalfDifferenceSeconds) >
      Math.abs(distribution.secondHalfDifferenceSeconds)
  const mainDifference = backEndIsMainDifference
    ? 'Back end was the main difference in this performance.'
    : frontEndIsMainDifference
      ? 'Front end was the main difference in this performance.'
      : 'The performance was close to the expected first-half and second-half distribution.'
  const halfDetail = backEndIsMainDifference
    ? `Final half was ${signedDifference(distribution.secondHalfDifferenceSeconds)} versus the expected distribution`
    : frontEndIsMainDifference
      ? `First half was ${signedDifference(distribution.firstHalfDifferenceSeconds)} versus the expected distribution`
      : undefined
  const segmentDetail = `largest segment difference was ${largest.distanceFrom}–${largest.distanceTo} m (${signedDifference(largest.benchmarkDifferenceSeconds)})`

  return `${mainDifference}${halfDetail ? ` ${halfDetail}, and the ${segmentDetail}.` : ` The ${segmentDetail}.`}`
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

    return {
      resultId: result.id,
      occurredAt: result.occurredAt,
      totalSeconds: result.totalSeconds,
      previousDifferenceSeconds: comparison?.previousTotalDifferenceSeconds,
      pbDifferenceSeconds: comparison?.pbTotalDifferenceSeconds,
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
      distributionHighlight: distributionHighlight(
        comparisonsByResultId.get(selectedResult.id),
      ),
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

  const recentComparisons = comparableResults
    .slice(-Math.min(3, comparableResults.length))
    .map((result) => comparisonsByResultId.get(result.id))
    .filter(
      (comparison): comparison is PerformanceComparison =>
        comparison?.distributionSummary !== undefined,
    )
  const backEndDifferenceCount = recentComparisons.filter(
    (comparison) =>
      comparison.distributionSummary!.secondHalfDifferenceSeconds >
        DISTRIBUTION_DIFFERENCE_THRESHOLD_SECONDS &&
      comparison.distributionSummary!.secondHalfDifferenceSeconds >=
        Math.abs(
          comparison.distributionSummary!.firstHalfDifferenceSeconds,
        ),
  ).length
  const recurringPattern =
    recentComparisons.length >= 2 && backEndDifferenceCount >= 2
      ? `Recurring back-end distribution difference in ${backEndDifferenceCount} of the last ${recentComparisons.length} comparable performances.`
      : undefined

  return {
    points,
    direction,
    findings: findings.slice(0, 3),
    distributionHighlight: distributionHighlight(
      comparisonsByResultId.get(selectedResult.id),
    ),
    recurringPattern,
  }
}
