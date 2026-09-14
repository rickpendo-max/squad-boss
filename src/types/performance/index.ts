export type PerformanceResultType = 'competition' | 'test' | 'training'
export type PerformanceCourse = 'LCM' | 'SCM'
export type PerformanceSource = 'manual' | 'import'
export type PerformanceQualityStatus = 'valid' | 'estimated' | 'excluded'
export type PerformanceVerificationStatus =
  | 'verified'
  | 'unverified'
  | 'not-applicable'
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
  importMetadata?: PerformanceImportMetadata
}

export interface PerformanceImportMetadata {
  provider: 'Swimming Australia CSV'
  sourceType: 'csv'
  sourceFileName: string
  meetName: string
  externalResultId?: string
  roundStatus?: string
  verified?: boolean
  verificationStatus?: PerformanceVerificationStatus
  age?: number
  duplicateKey: string
  importedAt: string
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
  sex?: 'female' | 'male'
  classification?: string
  targetTotalSeconds?: number
  modelCategory?: BenchmarkModelCategory
  label?: string
  source?: string
  sourceVersion?: string
  isPublished?: boolean
  basis: string
  segments: BenchmarkSegment[]
}

export type BenchmarkModelCategory =
  | 'classification-para'
  | 'athlete-personal'
  | 'coach-selected'
  | 'population-able-bodied'

export interface BenchmarkEquation {
  distance: number
  intercept: number
  totalSecondsCoefficient: number
}

export interface DerivedBenchmarkModel {
  id: string
  benchmarkSetId: string
  label: string
  event: string
  distance: number
  stroke: SwimmingStroke
  course: PerformanceCourse
  sex?: 'female' | 'male'
  classification?: string
  modelCategory: BenchmarkModelCategory
  source: string
  sourceVersion: string
  basis: string
  publishedRange: {
    minimumTotalSeconds: number
    maximumTotalSeconds: number
  }
  cumulativeEquations: BenchmarkEquation[]
}

export type BenchmarkMatchStatus =
  | 'exact'
  | 'partial'
  | 'unavailable'
  | 'incompatible'
  | 'out-of-range'
  | 'derived'

export interface BenchmarkProvenance {
  label: string
  source: string
  sourceVersion: string
  basis: string
  modelCategory: BenchmarkModelCategory
  isPublished: boolean
  isOutsidePublishedRange: boolean
  publishedRange?: {
    minimumTotalSeconds: number
    maximumTotalSeconds: number
  }
}

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
  benchmarkModelId?: string
  benchmarkProvenance?: BenchmarkProvenance
  previousTotalDifferenceSeconds?: number
  pbTotalDifferenceSeconds?: number
  benchmarkTotalDifferenceSeconds?: number
  distributionSummary?: {
    firstHalfActualSeconds: number
    firstHalfExpectedSeconds: number
    firstHalfDifferenceSeconds: number
    secondHalfActualSeconds: number
    secondHalfExpectedSeconds: number
    secondHalfDifferenceSeconds: number
  }
  segmentComparisons: PerformanceSegmentComparison[]
  benchmarkMatchStatus: BenchmarkMatchStatus
  largestPositiveSegmentDeviation?: PerformanceSegmentComparison
  largestAbsoluteSegmentDeviation?: PerformanceSegmentComparison
  largestImprovementFromPrevious?: PerformanceSegmentComparison
  largestDeteriorationFromPrevious?: PerformanceSegmentComparison
  findings: PerformanceFinding[]
}
