import type { ArchiveState, VerifiedArchiveExport } from '../types/archive'
import type { BridgeConversionOptions } from '../data-sources/ripe-bridge-v02-adapter'
import { bridgeEntries } from '../data-sources/bridge-local-files.ts'

export function savedBridgeReconciliation(
  state: ArchiveState,
  connectionId: string,
  raw: unknown,
) {
  const mapping = Object.fromEntries(
    (state.bridge?.identities ?? [])
      .filter((link) => link.active && link.connectionId === connectionId)
      .map((link) => [link.sourceName, link.athleteId]),
  )
  const times = Object.fromEntries(
    bridgeEntries(raw).flatMap((entry) => {
      const saved = state.bridge?.sessions.find(
        (link) =>
          link.connectionId === connectionId &&
          link.sessionId === entry.archive_id &&
          link.checksum === `sha256:${entry.source_sha256}`,
      )
      const record = entry.record as Record<string, unknown>
      return saved
        ? [[saved.sessionId, saved.startsAt]]
        : typeof record.starts_at === 'string'
          ? [[entry.archive_id as string, record.starts_at]]
          : []
    }),
  )
  return { mapping, times }
}

export function rememberBridgeReconciliation(
  state: ArchiveState,
  input: VerifiedArchiveExport,
  options: BridgeConversionOptions,
  athleteIds: string[],
  at: string,
) {
  const next = structuredClone(state)
  next.bridge ??= { identities: [], sessions: [], audit: [] }
  for (const [sourceName, athleteId] of Object.entries(
    options.athleteIdsBySourceName,
  )) {
    if (!athleteIds.includes(athleteId))
      throw new Error(
        'A verified identity mapping references an unknown athlete ID.',
      )
    const existing = next.bridge.identities.find(
      (link) =>
        link.active &&
        link.connectionId === options.archiveId &&
        link.sourceName === sourceName,
    )
    if (existing && existing.athleteId !== athleteId)
      throw new Error(
        'A saved source identity cannot be reassigned silently. Revoke it with a reason first.',
      )
    if (!existing) {
      next.bridge.identities.push({
        connectionId: options.archiveId,
        sourceName,
        athleteId,
        active: true,
        verifiedBy: options.attestedBy,
        verifiedAt: at,
      })
      next.bridge.audit.push({
        connectionId: options.archiveId,
        sourceName,
        athleteId,
        action: 'verify',
        by: options.attestedBy,
        at,
      })
    }
  }
  for (const session of input.sessions) {
    next.bridge.sessions = next.bridge.sessions.filter(
      (link) =>
        !(
          link.connectionId === input.archiveId && link.sessionId === session.id
        ),
    )
    next.bridge.sessions.push({
      connectionId: input.archiveId,
      sessionId: session.id,
      checksum: session.source.checksum,
      startsAt: session.startsAt,
    })
  }
  return next
}
