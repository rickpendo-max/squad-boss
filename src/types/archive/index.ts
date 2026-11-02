import type {
  PerformanceCourse,
  PerformanceResultType,
  SwimmingStroke,
} from '../performance'

export type Verification = 'verified' | 'provisional' | 'unverified'

export interface ArchivePerformance {
  id: string
  resultType: PerformanceResultType
  distance: number
  stroke: SwimmingStroke
  course: PerformanceCourse
  totalSeconds: number | null
  verificationStatus: Verification
}

export interface ArchiveParticipant {
  athleteId: string
  attendance: 'present' | 'absent' | 'unknown'
  completedDistanceMeters: number | null
  performances: ArchivePerformance[]
}

export interface ArchiveSession {
  id: string
  title: string
  startsAt: string
  approval: { status: Verification; verifiedBy?: string; verifiedAt?: string }
  source: { fileName: string; checksum: string }
  plannedDistanceMeters: number | null
  participants: ArchiveParticipant[]
}

/** Application-side contract. Bridge v0.2 field compatibility is not yet verified. */
export interface VerifiedArchiveExport {
  format: 'ripe-verified-archive-v1'
  archiveId: string
  exportedAt: string
  sessions: ArchiveSession[]
}

export interface ArchiveProvenance {
  archiveId: string
  sessionId: string
  sourceFileName: string
  sourceChecksum: string
  verificationStatus: 'verified'
  verifiedBy: string
  verifiedAt: string
  batchId: string
}

export interface ImportedSession {
  archiveId: string
  batchId: string
  session: ArchiveSession
}

export interface ImportReviewRow {
  sessionId: string
  title: string
  status: 'ready' | 'duplicate' | 'conflict' | 'unverified' | 'unresolved'
  reason: string
}

export interface ArchiveBatch {
  id: string
  archiveId: string
  fileName: string
  exportedAt: string
  importedAt: string
  importedBy: string
  review: ImportReviewRow[]
  status: 'active' | 'rolled-back'
  rollback?: { at: string; by: string; reason: string }
  sourceChecks?: {
    checksum: string
    method: 'sha256-selected-json'
    checkedAt: string
  }[]
}

export interface BridgeIdentityLink {
  connectionId: string
  sourceName: string
  athleteId: string
  verifiedBy: string
  verifiedAt: string
  active: boolean
}

export interface BridgeSessionLink {
  connectionId: string
  sessionId: string
  checksum: string
  startsAt: string
}

export interface BridgeMappingAudit {
  connectionId: string
  sourceName: string
  athleteId: string
  action: 'verify' | 'revoke'
  by: string
  at: string
  reason?: string
}

export interface ArchiveState {
  version: 1
  sessions: ImportedSession[]
  batches: ArchiveBatch[]
  recovery?: { restoredAt: string; restoredBy: string }
  bridge?: {
    identities: BridgeIdentityLink[]
    sessions: BridgeSessionLink[]
    audit: BridgeMappingAudit[]
  }
}
