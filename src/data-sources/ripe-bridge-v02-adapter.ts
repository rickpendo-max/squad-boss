import type {
  VerifiedArchiveExport,
  ArchiveParticipant,
} from '../types/archive'
import {
  canonical,
  parseArchivePerformance,
  parseRipeArchive,
} from './ripe-archive.ts'

/**
 * Bridge v0.2 uses a different wire format from the application importer.
 * This adapter requires explicit identity and session-time reconciliation.
 * Never pass original source_location through to UI, logs or exported records.
 */
export interface BridgeConversionOptions {
  archiveId: string
  athleteIdsBySourceName: Record<string, string>
  /** ISO 8601 offset-qualified timestamps, keyed by source archive_id. */
  startsAtBySessionId: Record<string, string>
  /** Explicit review attestation, NOT a claim about who approved the original source. */
  attestedBy: string
  attestedAt: string
  previousSessions?: VerifiedArchiveExport['sessions']
}

type UnknownRecord = Record<string, unknown>
const object = (v: unknown): v is UnknownRecord =>
  v !== null && typeof v === 'object' && !Array.isArray(v)
function fail(message: string): never {
  throw new Error(`Bridge conversion blocked: ${message}`)
}
const string = (v: unknown): v is string =>
  typeof v === 'string' && v.trim().length > 0
const datePattern = /^\d{4}-\d{2}-\d{2}$/
const timestampPattern =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/
const checksumPattern = /^[a-f0-9]{64}$/

function distanceMap(value: unknown, label: string): Record<string, number> {
  if (value === undefined) return {}
  if (!object(value)) return fail(`invalid ${label}`)
  const result: Record<string, number> = Object.create(null)
  for (const [name, meters] of Object.entries(value)) {
    if (
      !string(name) ||
      typeof meters !== 'number' ||
      !Number.isFinite(meters) ||
      meters < 0 ||
      meters > 100000
    )
      fail(`invalid completed distance in ${label}`)
    result[name] = meters as number
  }
  return result
}

export function adaptBridgeV02(
  raw: unknown,
  options: BridgeConversionOptions,
): VerifiedArchiveExport {
  if (
    !object(raw) ||
    raw.schema !== 'ripe-verified-archive-v1' ||
    !string(raw.exported_utc) ||
    !timestampPattern.test(raw.exported_utc) ||
    !Number.isFinite(Date.parse(raw.exported_utc)) ||
    !Array.isArray(raw.sessions)
  )
    fail('invalid Bridge envelope')
  if (
    !string(options.archiveId) ||
    !string(options.attestedBy) ||
    !timestampPattern.test(options.attestedAt) ||
    !Number.isFinite(Date.parse(options.attestedAt))
  )
    fail('explicit archive identity and coach attestation required')

  const seen = new Set<string>()
  const sessions: VerifiedArchiveExport['sessions'] = raw.sessions.map(
    (entry: unknown) => {
      if (!object(entry) || !object(entry.record)) fail('invalid session entry')
      const record = entry.record as UnknownRecord
      if (
        record.timed_results !== undefined &&
        !Array.isArray(record.timed_results)
      )
        fail(
          'Unsupported timed_results structure. No measurements were imported.',
        )
      const measured = ((record.timed_results ?? []) as unknown[]).map(
        (row) => {
          if (!object(row) || !string(row.athlete_name))
            fail(
              'A measured result needs an explicit source athlete_name; unknown layouts cannot be guessed.',
            )
          const { athlete_name, ...performance } = row
          return {
            name: athlete_name,
            performance: parseArchivePerformance(performance),
          }
        },
      )
      const id = entry.archive_id
      if (!string(id) || seen.has(id))
        fail('missing or repeated session identity')
      seen.add(id)
      if (
        (record.archive_id !== undefined && record.archive_id !== id) ||
        (record.session_id !== undefined && record.session_id !== id)
      )
        fail(`conflicting identity for session ${id}`)
      if (
        !string(record.date) ||
        !datePattern.test(record.date) ||
        Number.isNaN(Date.parse(record.date + 'T00:00:00Z')) ||
        new Date(record.date + 'T00:00:00Z').toISOString().slice(0, 10) !==
          record.date
      )
        fail(`invalid date for session ${id}`)
      const startsAt = Object.hasOwn(options.startsAtBySessionId, id)
        ? options.startsAtBySessionId[id]
        : record.starts_at
      if (record.starts_at !== undefined && record.starts_at !== startsAt)
        fail(`session ${id} has conflicting source and reconciled start times`)
      if (
        !string(startsAt) ||
        !timestampPattern.test(startsAt) ||
        !Number.isFinite(Date.parse(startsAt))
      )
        fail(`session ${id} needs a valid confirmed offset-qualified start time`)
      if (startsAt.slice(0, 10) !== record.date)
        fail(`session ${id} start date ${startsAt.slice(0, 10)} does not match verified source date ${record.date}; check the archive record before proceeding`)
      const approvalFields = [
        ['status', 'coach_verified'],
        ['review_status', 'coach_confirmed'],
        ['coach_approval', 'approved_and_verified'],
      ] as const
      const suppliedApprovals = approvalFields.filter(([key]) =>
        Object.hasOwn(record, key),
      )
      if (
        !suppliedApprovals.length ||
        suppliedApprovals.some(([key, approved]) => record[key] !== approved)
      )
        fail(`session ${id} is not coach-verified`)
      if (
        !string(entry.source_sha256) ||
        !checksumPattern.test(entry.source_sha256)
      )
        fail(`invalid source checksum for session ${id}`)

      const firstDistances = distanceMap(record.distance_m, 'distance_m')
      const secondDistances = distanceMap(
        record.athlete_distances_m,
        'athlete_distances_m',
      )
      for (const [name, meters] of Object.entries(firstDistances)) {
        if (
          Object.hasOwn(secondDistances, name) &&
          secondDistances[name] !== meters
        )
          fail(`conflicting completed distance fields in session ${id}`)
      }
      if (
        Object.hasOwn(record, 'distance_status') &&
        record.distance_status !== 'verified'
      )
        fail(`session ${id} has unverified or unsupported distance status`)
      const completed = { ...firstDistances, ...secondDistances }
      const present = record.present === undefined ? [] : record.present
      const absent = record.absent === undefined ? {} : record.absent
      if (!Array.isArray(present) || !present.every(string) || !object(absent))
        fail(`invalid attendance in session ${id}`)
      const names = new Set([
        ...Object.keys(completed),
        ...present,
        ...Object.keys(absent),
        ...measured.map((result) => result.name),
      ])
      const ids = new Set<string>()
      const participants: ArchiveParticipant[] = [...names].map((name) => {
        const athleteId = Object.hasOwn(options.athleteIdsBySourceName, name)
          ? options.athleteIdsBySourceName[name]
          : undefined
        if (!string(athleteId)) fail(`unmapped source athlete in session ${id}`)
        if (ids.has(athleteId))
          fail(`multiple source names map to one athlete in session ${id}`)
        ids.add(athleteId)
        const isAbsent = Object.hasOwn(absent, name)
        if (
          isAbsent &&
          (present.includes(name) || Object.hasOwn(completed, name))
        )
          fail(`conflicting attendance for session ${id}`)
        return {
          athleteId,
          attendance: isAbsent
            ? 'absent'
            : present.includes(name) || completed[name] > 0
              ? 'present'
              : 'unknown',
          completedDistanceMeters: Object.hasOwn(completed, name)
            ? completed[name]
            : null,
          // Counts, descriptions and protocols never become measured results.
          performances: measured
            .filter((result) => result.name === name)
            .map((result) => result.performance),
        }
      })
      if (!participants.length)
        fail(`session ${id} has no resolved participants`)
      const planned = record.planned_main_group_m
      if (
        planned !== undefined &&
        (typeof planned !== 'number' ||
          !Number.isFinite(planned) ||
          planned < 0 ||
          planned > 100000)
      )
        fail(`invalid planned metres in session ${id}`)
      const period = record.period ?? record.session
      if (
        record.period !== undefined &&
        record.session !== undefined &&
        record.period !== record.session
      )
        fail(`conflicting session period in session ${id}`)
      if (period !== undefined && period !== 'AM' && period !== 'PM')
        fail(`invalid session period in session ${id}`)
      if (
        period !== undefined &&
        period !== (Number(startsAt.slice(11, 13)) < 12 ? 'AM' : 'PM')
      )
        fail(`session ${id} start time conflicts with its period`)
      // Never use source_location: it contains a private absolute Windows path.
      return {
        id,
        title: `Verified training session ${id}`,
        startsAt,
        approval: {
          status: 'verified' as const,
          verifiedBy: options.attestedBy,
          verifiedAt: options.attestedAt,
        },
        source: {
          fileName: `bridge-session-${id}.json`,
          checksum: `sha256:${entry.source_sha256}`,
        },
        plannedDistanceMeters: typeof planned === 'number' ? planned : null,
        participants,
      }
    },
  )
  for (const session of sessions) {
    const previous = options.previousSessions?.find(
      (old) =>
        old.id === session.id &&
        canonical({ ...old, approval: null }) ===
          canonical({ ...session, approval: null }),
    )
    if (previous)
      session.approval = { ...previous.approval } as typeof session.approval
  }
  return parseRipeArchive(
    JSON.stringify({
      format: 'ripe-verified-archive-v1',
      archiveId: options.archiveId,
      exportedAt: raw.exported_utc as string,
      sessions,
    }),
  )
}
