import { activeSessions } from '../data-sources/ripe-archive.ts'
import type { ArchiveState } from '../types/archive'
import type { PerformanceResult } from '../types/performance'

export interface TrainingSeason {
  startDate: string
  endDate: string
}

/** Civil dates are always Brisbane dates, independent of browser timezone. */
export function brisbaneDate(timestamp: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Australia/Brisbane', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(timestamp))
}

export function validateSeason(season: TrainingSeason) {
  const valid = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date)
    && Number.isFinite(Date.parse(`${date}T00:00:00Z`))
    && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date
  return valid(season.startDate) && valid(season.endDate)
    && season.startDate <= season.endDate
}

function monday(date: string) {
  const day = new Date(`${date}T00:00:00Z`)
  day.setUTCDate(day.getUTCDate() - (day.getUTCDay() + 6) % 7)
  return day.toISOString().slice(0, 10)
}

export function athleteTrainingSummary(
  state: ArchiveState,
  athleteId: string,
  period: string | TrainingSeason,
) {
  const season = typeof period === 'string'
    ? { startDate: `${period}-01-01`, endDate: `${period}-12-31` } : period
  if (!validateSeason(season)) throw new Error('Select valid season dates in chronological order.')
  const rows = activeSessions(state)
    .filter(({ session }) => {
      const date = brisbaneDate(session.startsAt)
      return date >= season.startDate && date <= season.endDate
    })
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
  const weeks = new Map<string, { week: string; completedMeters: number; missingDistance: number }>()
  for (const row of rows) {
    const week = monday(brisbaneDate(row.session.startsAt))
    const total = weeks.get(week) ?? { week, completedMeters: 0, missingDistance: 0 }
    if (row.participant.completedDistanceMeters === null) total.missingDistance++
    else total.completedMeters += row.participant.completedDistanceMeters
    weeks.set(week, total)
  }
  return {
    weeks: [...weeks.values()].sort((a, b) => a.week.localeCompare(b.week)),
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
    unverifiedMeasurements: rows.reduce(
      (sum, row) =>
        sum +
        row.participant.performances.filter(
          (result) => result.verificationStatus === 'unverified',
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

/** Quality checks alone do not establish source verification. */
export function verifiedPersonalBests(results: PerformanceResult[]) {
  return recordedPersonalBests(results.filter((result) => {
    if (result.archiveProvenance?.verificationStatus === 'verified') return true
    const metadata = result.importMetadata
    if (!metadata || metadata.verificationStatus === 'unverified'
      || metadata.verificationStatus === 'not-applicable') return false
    return metadata.verificationStatus === 'verified' || metadata.verified === true
  }))
}
