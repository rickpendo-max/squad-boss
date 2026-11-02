import Ajv from 'ajv'
import { ripeArchiveSchema } from './ripe-archive-schema.ts'
import type {
  ArchiveState,
  ImportReviewRow,
  VerifiedArchiveExport,
} from '../types/archive'
import type { PerformanceResult } from '../types/performance'

export const MAX_ARCHIVE_BYTES = 5 * 1024 * 1024
const ajv = new Ajv({ allErrors: true, strict: true, allowUnionTypes: true })
ajv.addFormat('date-time', {
  type: 'string',
  validate: (value: string) => {
    if (
      !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(
        value,
      )
    )
      return false
    if (
      Number(value.slice(11, 13)) > 23 ||
      Number(value.slice(14, 16)) > 59 ||
      Number(value.slice(17, 19)) > 59
    )
      return false
    const day = value.slice(0, 10)
    const date = new Date(`${day}T00:00:00Z`)
    return (
      Number.isFinite(Date.parse(value)) &&
      Number.isFinite(date.getTime()) &&
      date.toISOString().slice(0, 10) === day
    )
  },
})
const validate = ajv.compile<VerifiedArchiveExport>(ripeArchiveSchema)

export function parseRipeArchive(text: string): VerifiedArchiveExport {
  if (new TextEncoder().encode(text).length > MAX_ARCHIVE_BYTES)
    throw new Error('Archive exceeds the 5 MiB limit.')
  const value: unknown = JSON.parse(text)
  if (!validate(value)) {
    throw new Error(
      `Invalid archive: ${ajv.errorsText(validate.errors, { separator: '; ' })}`,
    )
  }
  return value
}

/** Stable content comparison: property order is immaterial; array order remains evidence. */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

export function emptyArchive(): ArchiveState {
  return { version: 1, sessions: [], batches: [] }
}

export function activeSessions(state: ArchiveState) {
  const active = new Set(
    state.batches.filter((b) => b.status === 'active').map((b) => b.id),
  )
  return state.sessions.filter((s) => active.has(s.batchId))
}

export function reviewRipeArchive(
  input: VerifiedArchiveExport,
  state: ArchiveState,
  athleteIds: string[],
): ImportReviewRow[] {
  // Validate again at the domain boundary; a TypeScript assertion is not validation.
  parseRipeArchive(JSON.stringify(input))
  const known = new Set(athleteIds)
  const current = activeSessions(state)
  return input.sessions.map((session) => {
    const row = (
      status: ImportReviewRow['status'],
      reason: string,
    ): ImportReviewRow => ({
      sessionId: session.id,
      title: session.title,
      status,
      reason,
    })
    if (input.sessions.filter((s) => s.id === session.id).length > 1)
      return row(
        'conflict',
        'Repeated session ID in this export. Split or correct the export.',
      )
    const ids = session.participants.map((p) => p.athleteId)
    if (new Set(ids).size !== ids.length)
      return row('conflict', 'Repeated athlete ID within a session.')
    for (const p of session.participants) {
      if (
        new Set(p.performances.map((r) => r.id)).size !== p.performances.length
      )
        return row('conflict', 'Repeated performance ID for an athlete.')
      if (
        p.attendance === 'absent' &&
        ((p.completedDistanceMeters ?? 0) > 0 ||
          p.performances.some((r) => r.totalSeconds !== null))
      )
        return row(
          'conflict',
          'Absent athlete has completed distance or a timed performance.',
        )
    }
    const previous = current.find(
      (s) => s.archiveId === input.archiveId && s.session.id === session.id,
    )
    if (previous)
      return canonical(previous.session) === canonical(session)
        ? row('duplicate', 'Identical session already imported.')
        : row(
            'conflict',
            'This archive/session identity already has different content. Existing records are unchanged.',
          )
    if (session.approval.status !== 'verified')
      return row(
        'unverified',
        'Session is provisional; no confirmed records will be created.',
      )
    const missing = ids.filter((id) => !known.has(id))
    if (missing.length)
      return row(
        'unresolved',
        `Unknown stable athlete IDs: ${missing.join(', ')}. Reconcile IDs in the export adapter; names are never matched.`,
      )
    // Prevent the same source being counted under a different session or archive ID.
    if (
      current.some((s) => s.session.source.checksum === session.source.checksum)
    )
      return row(
        'conflict',
        'Source checksum is already linked to another session identity.',
      )
    if (
      input.sessions.some(
        (s) =>
          s.id !== session.id && s.source.checksum === session.source.checksum,
      )
    )
      return row(
        'conflict',
        'The same source checksum appears under multiple session IDs.',
      )
    return row('ready', 'Coach-verified session; stable athlete IDs resolved.')
  })
}

export function archivePerformanceResults(
  state: ArchiveState,
): PerformanceResult[] {
  return activeSessions(state).flatMap(({ session, archiveId, batchId }) => {
    const batch = state.batches.find((b) => b.id === batchId)!
    return session.participants.flatMap((p) =>
      p.performances
        .filter(
          (r) => r.verificationStatus === 'verified' && r.totalSeconds !== null,
        )
        .map((r) => ({
          id: `ripe:${JSON.stringify([archiveId, session.id, p.athleteId, r.id])}`,
          athleteId: p.athleteId,
          resultType: r.resultType,
          occurredAt: session.startsAt,
          event: `${r.distance} m ${r.stroke.replaceAll('-', ' ')}`,
          distance: r.distance,
          stroke: r.stroke,
          course: r.course,
          totalSeconds: r.totalSeconds!,
          segments: [],
          source: 'import' as const,
          qualityStatus: 'valid' as const,
          createdAt: batch.importedAt,
          createdBy: batch.importedBy,
          archiveProvenance: {
            archiveId,
            sessionId: session.id,
            sourceFileName: session.source.fileName,
            sourceChecksum: session.source.checksum,
            verificationStatus: 'verified' as const,
            verifiedBy: session.approval.verifiedBy!,
            verifiedAt: session.approval.verifiedAt!,
            batchId,
          },
        })),
    )
  })
}

export function validateArchiveState(
  value: ArchiveState,
  athleteIds: string[],
) {
  if (!value || typeof value !== 'object')
    throw new Error('Invalid stored archive state.')
  if (
    value.version !== 1 ||
    !Array.isArray(value.sessions) ||
    !Array.isArray(value.batches)
  )
    throw new Error('Invalid stored archive state.')
  const batches = new Map(value.batches.map((b) => [b.id, b]))
  if (batches.size !== value.batches.length)
    throw new Error('Duplicate archive batch IDs.')
  for (const b of value.batches) {
    if (
      ![b.id, b.archiveId, b.importedBy, b.fileName].every(
        (s) => typeof s === 'string' && s.trim().length,
      ) ||
      !Number.isFinite(Date.parse(b.importedAt)) ||
      !Number.isFinite(Date.parse(b.exportedAt)) ||
      !Array.isArray(b.review) ||
      !['active', 'rolled-back'].includes(b.status)
    )
      throw new Error('Invalid archive audit record.')
    for (const r of b.review) {
      if (
        ![r.sessionId, r.title, r.reason].every(
          (s) => typeof s === 'string' && s.trim().length,
        ) ||
        ![
          'ready',
          'duplicate',
          'conflict',
          'unverified',
          'unresolved',
        ].includes(r.status)
      )
        throw new Error('Invalid archive review report.')
    }
    if (
      b.status === 'rolled-back' &&
      (!b.rollback?.by ||
        !b.rollback.reason ||
        !Number.isFinite(Date.parse(b.rollback.at)))
    )
      throw new Error('Invalid rollback audit record.')
    const sessions = value.sessions.filter((s) => s.batchId === b.id)
    const ready = b.review.filter((r) => r.status === 'ready')
    if (
      !ready.length ||
      sessions.length !== ready.length ||
      new Set(sessions.map((s) => s.session.id)).size !== sessions.length ||
      ready.some((r) => !sessions.some((s) => s.session.id === r.sessionId))
    )
      throw new Error(
        'Archive batch evidence does not match its review report.',
      )
  }
  if (
    value.recovery &&
    (typeof value.recovery.restoredBy !== 'string' ||
      !value.recovery.restoredBy.trim() ||
      !Number.isFinite(Date.parse(value.recovery.restoredAt)))
  )
    throw new Error('Invalid recovery audit record.')
  const seen = emptyArchive()
  for (const s of value.sessions) {
    const batch = batches.get(s.batchId)
    if (!batch || batch.archiveId !== s.archiveId)
      throw new Error('Archive session has no matching batch.')
    const input: VerifiedArchiveExport = {
      format: 'ripe-verified-archive-v1',
      archiveId: s.archiveId,
      exportedAt: batch.importedAt,
      sessions: [s.session],
    }
    const report = reviewRipeArchive(
      input,
      batch.status === 'active' ? seen : emptyArchive(),
      athleteIds,
    )[0]
    if (report.status !== 'ready')
      throw new Error(`Invalid stored archive session: ${report.reason}`)
    // Validate active uniqueness while retaining rolled-back evidence.
    if (batch.status === 'active') {
      if (!seen.batches.some((b) => b.id === batch.id)) seen.batches.push(batch)
      seen.sessions.push(s)
    }
  }
}

export function parseArchiveBackup(
  text: string,
  athleteIds: string[],
): ArchiveState {
  if (new TextEncoder().encode(text).length > 30 * 1024 * 1024)
    throw new Error('Backup exceeds 30 MiB.')
  const value = JSON.parse(text)
  if (value?.format !== 'ripe-archive-backup-v1' || !value.archive)
    throw new Error('Not a Ripe archive backup.')
  validateArchiveState(value.archive, athleteIds)
  return structuredClone(value.archive)
}
