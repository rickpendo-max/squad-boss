import type {
  PerformanceCourse,
  PerformanceResult,
  SwimmingStroke,
} from '../types/performance'

export const ALL_PERFORMANCE_EVENTS = 'all'
export type PerformanceCourseFilter = PerformanceCourse | 'all'

export function performanceEventKey(
  result: Pick<PerformanceResult, 'distance' | 'stroke'>,
) {
  return `${result.distance}:${result.stroke}`
}

function strokeLabel(stroke: SwimmingStroke) {
  const labels: Record<SwimmingStroke, string> = {
    freestyle: 'Freestyle',
    backstroke: 'Backstroke',
    breaststroke: 'Breaststroke',
    butterfly: 'Butterfly',
    'individual-medley': 'Individual Medley',
  }
  return labels[stroke]
}

export function getPerformanceEventOptions(results: PerformanceResult[]) {
  const options = new Map<string, string>()

  for (const result of results) {
    options.set(
      performanceEventKey(result),
      `${result.distance} m ${strokeLabel(result.stroke)}`,
    )
  }

  return [...options].map(([value, label]) => ({ value, label }))
}

export function filterPerformanceResults(
  results: PerformanceResult[],
  eventKey: string,
  course: PerformanceCourseFilter,
) {
  return results.filter(
    (result) =>
      (eventKey === ALL_PERFORMANCE_EVENTS ||
        performanceEventKey(result) === eventKey) &&
      (course === 'all' || result.course === course),
  )
}
