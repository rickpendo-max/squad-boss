import type {
  BenchmarkProfile,
  BenchmarkSet,
} from '../../types/performance'

export const qasPacingBenchmarkSet: BenchmarkSet = {
  id: 'qas-pacing-charts',
  name: 'QAS Pacing Benchmarks',
  source: 'Coach-supplied QAS pacing charts',
  sourceVersion: 'Awaiting source transcription',
  benchmarkType: 'race-pacing',
  status: 'inactive',
}

// Exact chart values are not present in the repository. Profiles must remain
// empty until the coach-supplied source can be transcribed without invention.
export const qasPacingBenchmarkProfiles: BenchmarkProfile[] = []
