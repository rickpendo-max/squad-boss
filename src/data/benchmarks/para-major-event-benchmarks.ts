import type {
  BenchmarkProfile,
  BenchmarkSet,
  ParaBenchmarkSourcePerformance,
} from '../../types/performance'

const sourceTitle = 'Paris 2024 Paralympic Games Para Swimming Results Book'
const sourceUrl =
  'https://paralympic.cz/wp-content/uploads/PG2024_SWM_B99_SWM-.pdf'
const reportCode = 'SWMW200MFR--14010-----FNL-000100--_73A1'

export const paraMajorEventBenchmarkSet: BenchmarkSet = {
  id: 'para-major-event-results',
  name: 'Para major-event results benchmarks',
  source: sourceTitle,
  sourceVersion: 'Paris 2024 report v1.0',
  benchmarkType: 'classification-specific-race-pacing',
  status: 'active',
}

type SourceRow = readonly [
  athleteName: string,
  nation: string,
  placing: number,
  medal: 'gold' | 'silver' | 'bronze' | undefined,
  result: string,
  totalSeconds: number,
  cumulativeSplits: readonly [string, number, string, number, string, number],
]

const sourceRows: SourceRow[] = [
  ['SHABALINA Valeriia', 'NPA', 1, 'gold', '2:05.10', 125.1, ['29.32', 29.32, '1:01.20', 61.2, '1:33.06', 93.06]],
  ['MASKILL Poppy', 'GBR', 2, 'silver', '2:07.16', 127.16, ['29.59', 29.59, '1:02.33', 62.33, '1:34.44', 94.44]],
  ['FIDDES Louise', 'GBR', 3, 'bronze', '2:07.91', 127.91, ['29.69', 29.69, '1:02.00', 62, '1:35.23', 95.23]],
  ['NEWMAN-BARONIUS Olivia', 'GBR', 4, undefined, '2:08.41', 128.41, ['29.81', 29.81, '1:02.64', 62.64, '1:35.70', 95.7]],
  ['McTERNAN Madeleine', 'AUS', 5, undefined, '2:12.48', 132.48, ['30.64', 30.64, '1:04.01', 64.01, '1:38.37', 98.37]],
  ['KINOSHITA Aira', 'JPN', 6, undefined, '2:12.84', 132.84, ['30.10', 30.1, '1:03.07', 63.07, '1:37.86', 97.86]],
  ['STORM Ruby', 'AUS', 7, undefined, '2:13.13', 133.13, ['30.61', 30.61, '1:03.69', 63.69, '1:38.33', 98.33]],
  ['LINDBERG Pernilla', 'SWE', 8, undefined, '2:14.31', 134.31, ['30.13', 30.13, '1:04.56', 64.56, '1:39.15', 99.15]],
]

function formatSeconds(seconds: number) {
  return seconds.toFixed(2)
}

export const paraMajorEventSourcePerformances: ParaBenchmarkSourcePerformance[] =
  sourceRows.map(
    ([athleteName, nation, placing, medal, result, totalSeconds, cumulative]) => {
      const cumulativeSeconds = [cumulative[1], cumulative[3], cumulative[5], totalSeconds]
      const cumulativeTimes = [cumulative[0], cumulative[2], cumulative[4], result]

      return {
        id: `paris-2024-women-s14-200-free-final-${placing}`,
        competition: 'Paris 2024 Paralympic Games',
        competitionDate: '2024-08-31',
        round: 'Final',
        placing,
        medal,
        athleteName,
        nation,
        sex: 'female',
        classification: 'S14',
        event: '200 m freestyle',
        distance: 200,
        stroke: 'freestyle',
        course: 'LCM',
        result,
        totalSeconds,
        splits: cumulativeSeconds.map((value, index) => {
          const previous = index === 0 ? 0 : cumulativeSeconds[index - 1]
          const segmentSeconds = Math.round((value - previous) * 100) / 100

          return {
            distance: (index + 1) * 50,
            cumulativeTime: cumulativeTimes[index],
            cumulativeSeconds: value,
            segmentTime: formatSeconds(segmentSeconds),
            segmentSeconds,
          }
        }),
        provenance: {
          sourceTitle,
          sourceUrl,
          reportCode,
          reportVersion: 'v1.0',
          retrievedAt: '2026-09-14',
        },
      }
    },
  )

function median(values: number[]) {
  const sorted = values.toSorted((left, right) => left - right)
  const middle = sorted.length / 2
  return (sorted[middle - 1] + sorted[middle]) / 2
}

const cumulativePercentages = [0, 1, 2].map((splitIndex) =>
  median(
    paraMajorEventSourcePerformances.map(
      (performance) =>
        (performance.splits[splitIndex].cumulativeSeconds /
          performance.totalSeconds) *
        100,
    ),
  ),
)
const segmentPercentages = [
  cumulativePercentages[0],
  cumulativePercentages[1] - cumulativePercentages[0],
  cumulativePercentages[2] - cumulativePercentages[1],
  100 - cumulativePercentages[2],
]

export const paraMajorEventBenchmarkProfiles: BenchmarkProfile[] = [
  {
    id: 'paris-2024-women-s14-200-lcm-freestyle-final-median-distribution',
    benchmarkSetId: paraMajorEventBenchmarkSet.id,
    event: '200 m freestyle',
    distance: 200,
    stroke: 'freestyle',
    course: 'LCM',
    sex: 'female',
    classification: 'S14',
    modelCategory: 'classification-para',
    label: 'Women S14 major-event pacing benchmark',
    source: sourceTitle,
    sourceVersion: 'Paris 2024 report v1.0',
    sourceUrl,
    isPublished: false,
    sampleSize: paraMajorEventSourcePerformances.length,
    evidenceIds: paraMajorEventSourcePerformances.map(({ id }) => id),
    basis:
      'Median cumulative split percentage from all eight Women S14 200 m freestyle finalists; n=8; no interpolation or missing-result imputation',
    segments: segmentPercentages.map((expectedPercentageOfTotal, index) => ({
      segmentIndex: index + 1,
      distanceFrom: index * 50,
      distanceTo: (index + 1) * 50,
      expectedPercentageOfTotal,
      metricCode: `paris-2024-women-s14-200-free-distribution-${index + 1}`,
      unit: 'percentage',
    })),
  },
]
