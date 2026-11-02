import { activeSessions } from '../data-sources/ripe-archive.ts'
import type { ArchiveState } from '../types/archive'
import type { PerformanceResult } from '../types/performance'

export function athleteTrainingSummary(
  state: ArchiveState,
  athleteId: string,
  year: string,
) {
  const rows = activeSessions(state)
    .filter(({ session }) => session.startsAt.startsWith(year))
    .flatMap(({ session, archiveId }) =>
      session.participants
        .filter((p) => p.athleteId === athleteId)
        .map((participant) => ({ session, archiveId, participant })),
    )
    .toSorted((a, b) => b.session.startsAt.localeCompare(a.session.startsAt))
  const knownAttendance = rows.filter(
    (r) => r.participant.attendance !== 'unknown',
  )
  const attended = rows.filter(
    (r) => r.participant.attendance === 'present',
  ).length
  const knownDistance = rows.filter(
    (r) => r.participant.completedDistanceMeters !== null,
  )
  return {
    rows,
    attended,
    knownAttendance: knownAttendance.length,
    attendancePercent: knownAttendance.length
      ? Math.round((attended / knownAttendance.length) * 100)
      : null,
    completedMeters: knownDistance.length
      ? knownDistance.reduce(
          (sum, r) => sum + r.participant.completedDistanceMeters!,
          0,
        )
      : null,
    missingDistance: rows.length - knownDistance.length,
    provisionalMeasurements: rows.reduce(
      (sum, r) =>
        sum +
        r.participant.performances.filter(
          (p) => p.verificationStatus === 'provisional',
        ).length,
      0,
    ),
    missingTimes: rows.reduce(
      (sum, r) =>
        sum +
        r.participant.performances.filter((p) => p.totalSeconds === null)
          .length,
      0,
    ),
  }
}

export function recordedPersonalBests(results: PerformanceResult[]) {
  const groups = new Map<string, PerformanceResult>()
  for (const r of results.filter((r) => r.qualityStatus === 'valid')) {
    const key = `${r.distance}|${r.stroke}|${r.course}|${r.resultType}`
    const current = groups.get(key)
    if (!current || r.totalSeconds < current.totalSeconds) groups.set(key, r)
  }
  return [...groups.values()].sort(
    (a, b) => a.distance - b.distance || a.stroke.localeCompare(b.stroke),
  )
}
