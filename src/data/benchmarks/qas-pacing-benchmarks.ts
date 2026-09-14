import type {
  BenchmarkProfile,
  BenchmarkSet,
} from '../../types/performance'

export const qasPacingBenchmarkSet: BenchmarkSet = {
  id: 'qas-pacing-charts',
  name: 'QAS Pacing Benchmarks',
  source: "Swimming Australia 'SpeedChart' - coach-supplied source PDF",
  sourceVersion: 'December 2011',
  benchmarkType: 'race-pacing',
  status: 'active',
}

type Cumulative200Row = readonly [
  targetTotalSeconds: number,
  fifty: number,
  hundred: number,
  hundredFifty: number,
]

const female200LcmFreestyle: Cumulative200Row[] = [
  [111, 26.56, 54.76, 83.05], [111.5, 26.66, 54.98, 83.4],
  [112, 26.76, 55.2, 83.76], [112.5, 26.85, 55.42, 84.12],
  [113, 26.95, 55.64, 84.48], [113.5, 27.05, 55.86, 84.84],
  [114, 27.15, 56.08, 85.2], [114.5, 27.24, 56.29, 85.56],
  [115, 27.34, 56.51, 85.92], [115.5, 27.44, 56.73, 86.28],
  [116, 27.54, 56.95, 86.64], [116.5, 27.63, 57.17, 87],
  [117, 27.73, 57.39, 87.36], [117.5, 27.83, 57.61, 87.72],
  [118, 27.92, 57.83, 88.08], [118.5, 28.02, 58.05, 88.44],
  [119, 28.12, 58.27, 88.8], [119.5, 28.22, 58.49, 89.15],
  [120, 28.31, 58.71, 89.51], [120.5, 28.41, 58.92, 89.87],
  [121, 28.51, 59.14, 90.23], [121.5, 28.61, 59.36, 90.59],
  [122, 28.7, 59.58, 90.95], [122.5, 28.8, 59.8, 91.31],
  [123, 28.9, 60.02, 91.67], [123.5, 28.99, 60.24, 92.03],
  [124, 29.09, 60.46, 92.39], [124.5, 29.19, 60.68, 92.75],
  [125, 29.29, 60.9, 93.11], [125.5, 29.38, 61.12, 93.47],
  [126, 29.48, 61.33, 93.83], [126.5, 29.58, 61.55, 94.19],
  [127, 29.67, 61.77, 94.54], [127.5, 29.77, 61.99, 94.9],
  [128, 29.87, 62.21, 95.26],
]

const male200LcmFreestyle: Cumulative200Row[] = [
  [100, 23.89, 49.29, 74.82], [100.5, 23.99, 49.51, 75.17],
  [101, 24.09, 49.73, 75.53], [101.5, 24.18, 49.95, 75.89],
  [102, 24.28, 50.17, 76.25], [102.5, 24.37, 50.39, 76.61],
  [103, 24.47, 50.61, 76.96], [103.5, 24.56, 50.83, 77.32],
  [104, 24.66, 51.05, 77.68], [104.5, 24.76, 51.27, 78.04],
  [105, 24.85, 51.49, 78.4], [105.5, 24.95, 51.71, 78.75],
  [106, 25.04, 51.93, 79.11], [106.5, 25.14, 52.15, 79.47],
  [107, 25.23, 52.37, 79.83], [107.5, 25.33, 52.59, 80.18],
  [108, 25.43, 52.81, 80.54], [108.5, 25.52, 53.02, 80.9],
  [109, 25.62, 53.24, 81.26], [109.5, 25.71, 53.46, 81.62],
  [110, 25.81, 53.68, 81.97], [110.5, 25.9, 53.9, 82.33],
  [111, 26, 54.12, 82.68], [111.5, 26.1, 54.34, 83.05],
  [112, 26.19, 54.56, 83.41], [112.5, 26.29, 54.78, 83.76],
  [113, 26.38, 55, 84.12], [113.5, 26.48, 55.22, 84.48],
  [114, 26.57, 55.44, 84.84], [114.5, 26.67, 55.66, 85.19],
  [115, 26.77, 55.88, 85.55], [115.5, 26.86, 56.1, 85.91],
  [116, 26.96, 56.32, 86.27], [116.5, 27.05, 56.54, 86.63],
  [117, 27.15, 56.75, 86.98],
]

function create200Profiles(
  sex: 'female' | 'male',
  rows: Cumulative200Row[],
): BenchmarkProfile[] {
  return rows.map(([targetTotalSeconds, fifty, hundred, hundredFifty]) => {
    const cumulative = [0, fifty, hundred, hundredFifty, targetTotalSeconds]

    return {
      id: `qas-200-lcm-freestyle-${sex}-${targetTotalSeconds.toFixed(1)}`,
      benchmarkSetId: qasPacingBenchmarkSet.id,
      event: '200 m freestyle',
      distance: 200,
      stroke: 'freestyle',
      course: 'LCM',
      sex,
      targetTotalSeconds,
      basis: "Swimming Australia 'SpeedChart' cumulative 50 m marks",
      segments: cumulative.slice(1).map((value, index) => ({
        segmentIndex: index + 1,
        distanceFrom: index * 50,
        distanceTo: (index + 1) * 50,
        expectedSeconds: Math.round((value - cumulative[index]) * 100) / 100,
        metricCode: `qas-200-${sex}-${targetTotalSeconds.toFixed(1)}-${index + 1}`,
        unit: 'seconds' as const,
      })),
    }
  })
}

export const qasPacingBenchmarkProfiles: BenchmarkProfile[] = [
  ...create200Profiles('female', female200LcmFreestyle),
  ...create200Profiles('male', male200LcmFreestyle),
]
