import type { Athlete } from '../types/athlete'
import type {
  BenchmarkProfile,
  PerformanceComparison,
  PerformanceFinding,
  PerformanceResult,
  PerformanceSegment,
  PerformanceSegmentComparison,
  SwimmingStroke,
} from '../types/performance'

function round(value: number) {
  return Math.round(value * 100) / 100
}

function sameSegmentBoundaries(
  left: PerformanceSegment[],
  right: PerformanceSegment[],
) {
  return (
    left.length === right.length &&
    left.every(
      (segment, index) =>
        segment.distanceFrom === right[index].distanceFrom &&
        segment.distanceTo === right[index].distanceTo,
    )
  )
}

function isComparable(left: PerformanceResult, right: PerformanceResult) {
  return (
    left.athleteId === right.athleteId &&
    left.distance === right.distance &&
    left.stroke === right.stroke &&
    left.course === right.course &&
    right.qualityStatus === 'valid' &&
    sameSegmentBoundaries(left.segments, right.segments)
  )
}

function parseTime(time: string) {
  const parts = time.split(':').map(Number)

  if (parts.some(Number.isNaN)) return undefined
  if (parts.length === 1) return parts[0]
  if (parts.length === 2) return parts[0] * 60 + parts[1]

  return undefined
}

function legacyStrokeName(stroke: SwimmingStroke) {
  const names: Record<SwimmingStroke, string> = {
    freestyle: 'Free',
    backstroke: 'Back',
    breaststroke: 'Breast',
    butterfly: 'Fly',
    'individual-medley': 'IM',
  }

  return names[stroke]
}

function getLegacyPbSeconds(result: PerformanceResult, athlete: Athlete) {
  const course = result.course === 'LCM' ? 'LC' : 'SC'
  const expectedEvent = `${result.distance} ${legacyStrokeName(result.stroke)}`
  const personalBest = athlete.personalBests.find(
    (candidate) =>
      candidate.course === course && candidate.event === expectedEvent,
  )

  return personalBest ? parseTime(personalBest.time) : undefined
}

function segmentLabel(segment: PerformanceSegmentComparison) {
  return `${segment.distanceFrom}–${segment.distanceTo} m`
}

function differenceSummary(
  subject: string,
  difference: number,
  reference: string,
) {
  if (difference === 0) return `${subject} matched ${reference}.`

  return difference < 0
    ? `${subject} was ${Math.abs(difference).toFixed(2)} s faster than ${reference}.`
    : `${subject} was ${difference.toFixed(2)} s slower than ${reference}.`
}

export function calculatePerformanceComparison(
  result: PerformanceResult,
  allResults: PerformanceResult[],
  athlete: Athlete,
  benchmarkProfiles: BenchmarkProfile[],
): PerformanceComparison {
  const comparable = allResults.filter(
    (candidate) => candidate.id !== result.id && isComparable(result, candidate),
  )
  const previous = comparable
    .filter((candidate) => candidate.occurredAt <= result.occurredAt)
    .toSorted(
      (left, right) =>
        right.occurredAt.localeCompare(left.occurredAt) ||
        right.createdAt.localeCompare(left.createdAt),
    )[0]

  const storedPb = allResults
    .filter((candidate) => isComparable(result, candidate))
    .toSorted((left, right) => left.totalSeconds - right.totalSeconds)[0]
  const legacyPbSeconds = getLegacyPbSeconds(result, athlete)
  const useLegacyPb =
    legacyPbSeconds !== undefined &&
    (!storedPb || legacyPbSeconds < storedPb.totalSeconds)
  const pbSeconds = useLegacyPb ? legacyPbSeconds : storedPb?.totalSeconds

  const baseBenchmarkProfiles = benchmarkProfiles.filter(
    (profile) =>
      profile.distance === result.distance &&
      profile.stroke === result.stroke &&
      profile.course === result.course,
  )
  const eligibleBenchmarkProfiles = baseBenchmarkProfiles.filter(
    (profile) =>
      !profile.sex &&
      (!profile.classification ||
        profile.classification === athlete.classification),
  )
  const benchmark = eligibleBenchmarkProfiles[0]
  const benchmarkSegmentsCompatible =
    benchmark !== undefined &&
    benchmark.segments.length === result.segments.length &&
    benchmark.segments.every(
      (segment, index) =>
        segment.distanceFrom === result.segments[index].distanceFrom &&
        segment.distanceTo === result.segments[index].distanceTo,
    )

  const benchmarkMatchStatus =
    baseBenchmarkProfiles.length === 0
      ? 'unavailable'
      : !benchmark
        ? 'incompatible'
        : benchmarkSegmentsCompatible
          ? 'exact'
          : 'partial'

  let previousCumulativeActual = 0
  let previousCumulativeReference = 0
  const segmentComparisons = result.segments.map((segment, index) => {
    const previousSegment = previous?.segments[index]
    const benchmarkSegment = benchmarkSegmentsCompatible
      ? benchmark.segments[index]
      : undefined
    previousCumulativeActual += segment.seconds
    previousCumulativeReference += previousSegment?.seconds ?? 0

    return {
      segmentIndex: segment.segmentIndex,
      distanceFrom: segment.distanceFrom,
      distanceTo: segment.distanceTo,
      actualSeconds: segment.seconds,
      actualPercentageOfTotal: round(
        (segment.seconds / result.totalSeconds) * 100,
      ),
      previousSeconds: previousSegment?.seconds,
      previousDifferenceSeconds: previousSegment
        ? round(segment.seconds - previousSegment.seconds)
        : undefined,
      previousCumulativeDifferenceSeconds: previousSegment
        ? round(previousCumulativeActual - previousCumulativeReference)
        : undefined,
      benchmarkSeconds: benchmarkSegment?.expectedSeconds,
      benchmarkDifferenceSeconds:
        benchmarkSegment?.expectedSeconds !== undefined
          ? round(segment.seconds - benchmarkSegment.expectedSeconds)
          : undefined,
      benchmarkPercentageOfTotal:
        benchmarkSegment?.expectedPercentageOfTotal,
      benchmarkPercentageDifference:
        benchmarkSegment?.expectedPercentageOfTotal !== undefined
          ? round(
              (segment.seconds / result.totalSeconds) * 100 -
                benchmarkSegment.expectedPercentageOfTotal,
            )
          : undefined,
    }
  })

  const byPreviousDifference = segmentComparisons.filter(
    (segment) => segment.previousDifferenceSeconds !== undefined,
  )
  const byBenchmarkDifference = segmentComparisons.filter(
    (segment) => segment.benchmarkDifferenceSeconds !== undefined,
  )
  const largestImprovementFromPrevious = byPreviousDifference.toSorted(
    (left, right) =>
      left.previousDifferenceSeconds! - right.previousDifferenceSeconds!,
  )[0]
  const largestDeteriorationFromPrevious = byPreviousDifference.toSorted(
    (left, right) =>
      right.previousDifferenceSeconds! - left.previousDifferenceSeconds!,
  )[0]
  const positiveDeviations = (
    byBenchmarkDifference.length
      ? byBenchmarkDifference
      : byPreviousDifference
  ).filter(
    (segment) =>
      (segment.benchmarkDifferenceSeconds ??
        segment.previousDifferenceSeconds ??
        0) > 0,
  )
  const largestPositiveSegmentDeviation = positiveDeviations.toSorted(
    (left, right) =>
      (right.benchmarkDifferenceSeconds ??
        right.previousDifferenceSeconds ??
        0) -
      (left.benchmarkDifferenceSeconds ??
        left.previousDifferenceSeconds ??
        0),
  )[0]

  const previousTotalDifferenceSeconds = previous
    ? round(result.totalSeconds - previous.totalSeconds)
    : undefined
  const pbTotalDifferenceSeconds =
    pbSeconds !== undefined ? round(result.totalSeconds - pbSeconds) : undefined
  const benchmarkExpectedTotal =
    benchmarkSegmentsCompatible &&
    benchmark.segments.every(
      (segment) => segment.expectedSeconds !== undefined,
    )
      ? benchmark.segments.reduce(
          (total, segment) => total + segment.expectedSeconds!,
          0,
        )
      : undefined
  const benchmarkTotalDifferenceSeconds =
    benchmarkExpectedTotal !== undefined
      ? round(result.totalSeconds - benchmarkExpectedTotal)
      : undefined

  const findings: PerformanceFinding[] = []

  if (previousTotalDifferenceSeconds !== undefined) {
    findings.push({
      findingType: 'total',
      comparisonType: 'previous',
      metricOrSegment: 'total',
      actualValue: result.totalSeconds,
      referenceValue: previous!.totalSeconds,
      difference: previousTotalDifferenceSeconds,
      summary: differenceSummary(
        'Total time',
        previousTotalDifferenceSeconds,
        'the previous comparable result',
      ),
    })
  }

  if (
    largestPositiveSegmentDeviation?.benchmarkDifferenceSeconds !== undefined
  ) {
    findings.push({
      findingType: 'segment',
      comparisonType: 'benchmark',
      metricOrSegment: segmentLabel(largestPositiveSegmentDeviation),
      actualValue: largestPositiveSegmentDeviation.actualSeconds,
      referenceValue: largestPositiveSegmentDeviation.benchmarkSeconds,
      difference: largestPositiveSegmentDeviation.benchmarkDifferenceSeconds,
      summary: differenceSummary(
        segmentLabel(largestPositiveSegmentDeviation),
        largestPositiveSegmentDeviation.benchmarkDifferenceSeconds,
        'the QAS pacing reference',
      ),
    })
  }

  if (
    largestPositiveSegmentDeviation?.benchmarkDifferenceSeconds ===
      undefined &&
    largestPositiveSegmentDeviation?.previousDifferenceSeconds !== undefined
  ) {
    findings.push({
      findingType: 'segment',
      comparisonType: 'previous',
      metricOrSegment: segmentLabel(largestPositiveSegmentDeviation),
      actualValue: largestPositiveSegmentDeviation.actualSeconds,
      referenceValue: largestPositiveSegmentDeviation.previousSeconds,
      difference: largestPositiveSegmentDeviation.previousDifferenceSeconds,
      summary: differenceSummary(
        segmentLabel(largestPositiveSegmentDeviation),
        largestPositiveSegmentDeviation.previousDifferenceSeconds,
        'the previous comparable result',
      ),
    })
  }

  if (
    largestImprovementFromPrevious?.previousDifferenceSeconds !== undefined &&
    largestImprovementFromPrevious.previousDifferenceSeconds < 0
  ) {
    findings.push({
      findingType: 'segment',
      comparisonType: 'previous',
      metricOrSegment: segmentLabel(largestImprovementFromPrevious),
      actualValue: largestImprovementFromPrevious.actualSeconds,
      referenceValue: largestImprovementFromPrevious.previousSeconds,
      difference: largestImprovementFromPrevious.previousDifferenceSeconds,
      summary: `${segmentLabel(largestImprovementFromPrevious)} improved by ${Math.abs(largestImprovementFromPrevious.previousDifferenceSeconds).toFixed(2)} s from the previous comparable result.`,
    })
  }

  if (findings.length === 0 && benchmarkMatchStatus === 'unavailable') {
    findings.push({
      findingType: 'availability',
      comparisonType: 'benchmark',
      metricOrSegment: 'benchmark',
      summary: 'No applicable QAS benchmark available.',
    })
  }

  return {
    resultId: result.id,
    previousResultId: previous?.id,
    pbResultId: useLegacyPb ? undefined : storedPb?.id,
    benchmarkProfileId: benchmarkSegmentsCompatible
      ? benchmark.id
      : undefined,
    previousTotalDifferenceSeconds,
    pbTotalDifferenceSeconds,
    benchmarkTotalDifferenceSeconds,
    segmentComparisons,
    benchmarkMatchStatus,
    largestPositiveSegmentDeviation,
    largestImprovementFromPrevious,
    largestDeteriorationFromPrevious,
    findings: findings.slice(0, 3),
  }
}
