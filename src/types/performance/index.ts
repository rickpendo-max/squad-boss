export type PerformanceResultType = 'competition' | 'test' | 'training'
export type PerformanceCourse = 'LCM' | 'SCM'
export type PerformanceSource = 'manual' | 'import'
export type PerformanceQualityStatus = 'valid' | 'estimated' | 'excluded'
export type SwimmingStroke =
  | 'freestyle'
  | 'backstroke'
  | 'breaststroke'
  | 'butterfly'
  | 'individual-medley'

export interface PerformanceSegment {
  segmentIndex: number
  distanceFrom: number
  distanceTo: number
  seconds: number
}

export interface PerformanceResult {
  id: string
  athleteId: string
  resultType: PerformanceResultType
  occurredAt: string
  event: string
  distance: number
  stroke: SwimmingStroke
  course: PerformanceCourse
  totalSeconds: number
  segments: PerformanceSegment[]
  source: PerformanceSource
  qualityStatus: PerformanceQualityStatus
  createdAt: string
  createdBy: string
}

export interface BenchmarkSet {
  id: string
  name: string
  source: string
  sourceVersion: string
  benchmarkType: string
  status: 'active' | 'inactive'
}

export interface BenchmarkSegment {
  segmentIndex: number
  distanceFrom: number
  distanceTo: number
  expectedSeconds?: number
  expectedPercentageOfTotal?: number
  metricCode: string
  unit: 'seconds' | 'percentage'
}

export interface BenchmarkProfile {
  id: string
  benchmarkSetId: string
  event: string
  distance: number
  stroke: SwimmingStroke
  course: PerformanceCourse
  sex?: string
  classification?: string
  basis: string
  segments: BenchmarkSegment[]
}

export type BenchmarkMatchStatus =
  | 'exact'
  | 'partial'
  | 'unavailable'
  | 'incompatible'

export interface PerformanceSegmentComparison {
  segmentIndex: number
  distanceFrom: number
  distanceTo: number
  actualSeconds: number
  actualPercentageOfTotal: number
  previousSeconds?: number
  previousDifferenceSeconds?: number
  previousCumulativeDifferenceSeconds?: number
  benchmarkSeconds?: number
  benchmarkDifferenceSeconds?: number
  benchmarkPercentageOfTotal?: number
  benchmarkPercentageDifference?: number
}

export interface PerformanceFinding {
  findingType: 'total' | 'segment' | 'availability'
  comparisonType: 'previous' | 'pb' | 'benchmark'
  metricOrSegment: string
  actualValue?: number
  referenceValue?: number
  difference?: number
  summary: string
}

export interface PerformanceComparison {
  resultId: string
  previousResultId?: string
  pbResultId?: string
  benchmarkProfileId?: string
  previousTotalDifferenceSeconds?: number
  pbTotalDifferenceSeconds?: number
  benchmarkTotalDifferenceSeconds?: number
  segmentComparisons: PerformanceSegmentComparison[]
  benchmarkMatchStatus: BenchmarkMatchStatus
  largestPositiveSegmentDeviation?: PerformanceSegmentComparison
  largestImprovementFromPrevious?: PerformanceSegmentComparison
  largestDeteriorationFromPrevious?: PerformanceSegmentComparison
  findings: PerformanceFinding[]
}
