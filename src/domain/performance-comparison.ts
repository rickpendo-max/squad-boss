import type { Athlete } from '../types/athlete'
import type {
  BenchmarkModelCategory,
  BenchmarkProfile,
  BenchmarkProvenance,
  DerivedBenchmarkModel,
  PerformanceComparison,
  PerformanceFinding,
  PerformanceResult,
  PerformanceSegment,
  PerformanceSegmentComparison,
  SwimmingStroke,
} from '../types/performance'

const benchmarkCategoryPriority: Record<BenchmarkModelCategory, number> = {
  'classification-para': 400,
  'athlete-personal': 300,
  'coach-selected': 200,
  'population-able-bodied': 100,
}

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
    right.qualityStatus === 'valid'
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

function createDerivedProfile(
  model: DerivedBenchmarkModel,
  totalSeconds: number,
): BenchmarkProfile {
  const cumulative = [
    0,
    ...model.cumulativeEquations.map((equation) =>
      round(
        equation.intercept + equation.totalSecondsCoefficient * totalSeconds,
      ),
    ),
    totalSeconds,
  ]

  return {
    id: `${model.id}-${totalSeconds.toFixed(2)}`,
    benchmarkSetId: model.benchmarkSetId,
    event: model.event,
    distance: model.distance,
    stroke: model.stroke,
    course: model.course,
    sex: model.sex,
    classification: model.classification,
    targetTotalSeconds: totalSeconds,
    modelCategory: model.modelCategory,
    label: model.label,
    source: model.source,
    sourceVersion: model.sourceVersion,
    isPublished: false,
    basis: model.basis,
    segments: cumulative.slice(1).map((value, index) => ({
      segmentIndex: index + 1,
      distanceFrom: index * 50,
      distanceTo: (index + 1) * 50,
      expectedSeconds: round(value - cumulative[index]),
      metricCode: `${model.id}-${totalSeconds.toFixed(2)}-${index + 1}`,
      unit: 'seconds',
    })),
  }
}

function materializePercentageProfile(
  profile: BenchmarkProfile,
  totalSeconds: number,
): BenchmarkProfile {
  if (
    profile.segments.length === 0 ||
    !profile.segments.every(
      (segment) => segment.expectedPercentageOfTotal !== undefined,
    )
  ) {
    return profile
  }

  let allocatedSeconds = 0
  return {
    ...profile,
    segments: profile.segments.map((segment, index) => {
      const expectedSeconds =
        index === profile.segments.length - 1
          ? round(totalSeconds - allocatedSeconds)
          : round(
              totalSeconds * (segment.expectedPercentageOfTotal! / 100),
            )
      allocatedSeconds += expectedSeconds

      return { ...segment, expectedSeconds }
    }),
  }
}

export function calculatePerformanceComparison(
  result: PerformanceResult,
  allResults: PerformanceResult[],
  athlete: Athlete,
  benchmarkProfiles: BenchmarkProfile[],
  derivedBenchmarkModels: DerivedBenchmarkModel[] = [],
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
  const previousSegmentsCompatible =
    previous !== undefined &&
    result.segments.length > 0 &&
    sameSegmentBoundaries(result.segments, previous.segments)

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
      (!profile.sex || profile.sex === athlete.sex) &&
      (!profile.classification ||
        profile.classification === athlete.classification),
  )
  const eligibleDerivedModels = derivedBenchmarkModels.filter(
    (model) =>
      model.distance === result.distance &&
      model.stroke === result.stroke &&
      model.course === result.course &&
      (!model.sex || model.sex === athlete.sex) &&
      (!model.classification || model.classification === athlete.classification),
  )
  const categories = [
    ...eligibleBenchmarkProfiles.map(
      (profile) => profile.modelCategory ?? 'population-able-bodied',
    ),
    ...eligibleDerivedModels.map((model) => model.modelCategory),
  ]
  const selectedCategory = categories.toSorted(
    (left, right) =>
      benchmarkCategoryPriority[right] - benchmarkCategoryPriority[left],
  )[0]
  const selectedProfiles = eligibleBenchmarkProfiles.filter(
    (profile) =>
      (profile.modelCategory ?? 'population-able-bodied') === selectedCategory,
  )
  const selectedDerivedModel = eligibleDerivedModels.find(
    (model) => model.modelCategory === selectedCategory,
  )
  const targetTimedProfiles = selectedProfiles
    .filter(
      (profile): profile is BenchmarkProfile & { targetTotalSeconds: number } =>
        profile.targetTotalSeconds !== undefined,
    )
    .toSorted(
      (left, right) => left.targetTotalSeconds - right.targetTotalSeconds,
    )
  const resultWithinPublishedRange =
    targetTimedProfiles.length > 0 &&
    result.totalSeconds >= targetTimedProfiles[0].targetTotalSeconds &&
    result.totalSeconds <= targetTimedProfiles.at(-1)!.targetTotalSeconds
  const derivedBenchmark =
    targetTimedProfiles.length > 0 &&
    !resultWithinPublishedRange &&
    selectedDerivedModel
      ? createDerivedProfile(selectedDerivedModel, result.totalSeconds)
      : undefined
  const selectedBenchmark = targetTimedProfiles.length
    ? resultWithinPublishedRange
      ? targetTimedProfiles.toSorted(
          (left, right) =>
            Math.abs(left.targetTotalSeconds - result.totalSeconds) -
            Math.abs(right.targetTotalSeconds - result.totalSeconds),
        )[0]
      : derivedBenchmark
    : selectedProfiles[0]
  const benchmark = selectedBenchmark
    ? materializePercentageProfile(selectedBenchmark, result.totalSeconds)
    : undefined
  const benchmarkProvenance: BenchmarkProvenance | undefined = benchmark
    ? {
        label: benchmark.label ?? 'Benchmark',
        source: benchmark.source ?? benchmark.basis,
        sourceVersion: benchmark.sourceVersion ?? 'Not specified',
        basis: benchmark.basis,
        modelCategory:
          benchmark.modelCategory ?? 'population-able-bodied',
        isPublished: benchmark.isPublished === true,
        isOutsidePublishedRange: derivedBenchmark !== undefined,
        sampleSize: benchmark.sampleSize,
        sourceUrl: benchmark.sourceUrl,
        evidenceIds: benchmark.evidenceIds,
        publishedRange: selectedDerivedModel?.publishedRange,
      }
    : undefined
  const benchmarkSegmentsCompatible =
    benchmark !== undefined &&
    result.segments.length > 0 &&
    benchmark.segments.length === result.segments.length &&
    benchmark.segments.every(
      (segment, index) =>
        segment.distanceFrom === result.segments[index].distanceFrom &&
        segment.distanceTo === result.segments[index].distanceTo,
    )

  const benchmarkMatchStatus =
    baseBenchmarkProfiles.length === 0 && eligibleDerivedModels.length === 0
      ? 'unavailable'
      : derivedBenchmark
        ? 'derived'
        : targetTimedProfiles.length > 0 && !resultWithinPublishedRange
        ? 'out-of-range'
        : !benchmark
        ? 'incompatible'
        : benchmarkSegmentsCompatible
          ? 'exact'
          : 'partial'

  let previousCumulativeActual = 0
  let previousCumulativeReference = 0
  const segmentComparisons = result.segments.map((segment, index) => {
    const previousSegment = previousSegmentsCompatible
      ? previous.segments[index]
      : undefined
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
  const largestAbsoluteSegmentDeviation = byBenchmarkDifference.toSorted(
    (left, right) =>
      Math.abs(right.benchmarkDifferenceSeconds!) -
      Math.abs(left.benchmarkDifferenceSeconds!),
  )[0]
  const halfway = segmentComparisons.length / 2
  const canCompareHalves =
    benchmarkSegmentsCompatible &&
    segmentComparisons.length >= 2 &&
    Number.isInteger(halfway)
  const distributionSummary = canCompareHalves
    ? {
        firstHalfActualSeconds: round(
          segmentComparisons
            .slice(0, halfway)
            .reduce((total, segment) => total + segment.actualSeconds, 0),
        ),
        firstHalfExpectedSeconds: round(
          segmentComparisons
            .slice(0, halfway)
            .reduce(
              (total, segment) => total + segment.benchmarkSeconds!,
              0,
            ),
        ),
        firstHalfDifferenceSeconds: round(
          segmentComparisons
            .slice(0, halfway)
            .reduce(
              (total, segment) =>
                total + segment.benchmarkDifferenceSeconds!,
              0,
            ),
        ),
        secondHalfActualSeconds: round(
          segmentComparisons
            .slice(halfway)
            .reduce((total, segment) => total + segment.actualSeconds, 0),
        ),
        secondHalfExpectedSeconds: round(
          segmentComparisons
            .slice(halfway)
            .reduce(
              (total, segment) => total + segment.benchmarkSeconds!,
              0,
            ),
        ),
        secondHalfDifferenceSeconds: round(
          segmentComparisons
            .slice(halfway)
            .reduce(
              (total, segment) =>
                total + segment.benchmarkDifferenceSeconds!,
              0,
            ),
        ),
      }
    : undefined

  const previousTotalDifferenceSeconds = previous
    ? round(result.totalSeconds - previous.totalSeconds)
    : undefined
  const pbTotalDifferenceSeconds =
    pbSeconds !== undefined ? round(result.totalSeconds - pbSeconds) : undefined
  const benchmarkExpectedTotal =
    benchmark?.targetTotalSeconds ??
    (benchmark !== undefined &&
    benchmark.segments.every((segment) => segment.expectedSeconds !== undefined)
      ? benchmark.segments.reduce(
          (total, segment) => total + segment.expectedSeconds!,
          0,
        )
      : undefined)
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
        benchmarkProvenance?.label ?? 'the benchmark distribution',
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

  if (findings.length === 0 && benchmarkMatchStatus === 'out-of-range') {
    findings.push({
      findingType: 'availability',
      comparisonType: 'benchmark',
      metricOrSegment: 'benchmark',
      summary: 'Result is outside the published QAS pacing-chart range.',
    })
  }

  return {
    resultId: result.id,
    previousResultId: previous?.id,
    pbResultId: useLegacyPb ? undefined : storedPb?.id,
    benchmarkProfileId: benchmark?.id,
    benchmarkModelId: derivedBenchmark ? selectedDerivedModel?.id : undefined,
    benchmarkProvenance,
    previousTotalDifferenceSeconds,
    pbTotalDifferenceSeconds,
    benchmarkTotalDifferenceSeconds,
    distributionSummary,
    segmentComparisons,
    benchmarkMatchStatus,
    largestPositiveSegmentDeviation,
    largestAbsoluteSegmentDeviation,
    largestImprovementFromPrevious,
    largestDeteriorationFromPrevious,
    findings: findings.slice(0, 3),
  }
}
