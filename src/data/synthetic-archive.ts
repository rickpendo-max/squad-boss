import type { Athlete } from '../types/athlete'
import type { VerifiedArchiveExport } from '../types/archive'

export const syntheticAthlete: Athlete = {
  id: 'demo-athlete-001',
  firstName: 'Demo',
  lastName: 'Athlete',
  status: 'Ready',
  statusNote: 'Synthetic demonstration identity; not a real athlete.',
  primaryEvents: [],
  secondaryEvents: [],
  personalBests: [],
  testing: [],
  coachNotes: [],
}

/** Fictional sessions and measurements. Never presented as the owner's archive. */
export const syntheticArchive: VerifiedArchiveExport = {
  format: 'ripe-verified-archive-v1',
  archiveId: 'synthetic-demo',
  exportedAt: '2026-11-01T00:00:00Z',
  sessions: [0, 1, 2].map((index) => ({
    id: `demo-session-${index + 1}`,
    title: `Synthetic pool session ${index + 1}`,
    startsAt: `2026-10-${26 + index}T06:00:00+10:00`,
    approval: {
      status: 'verified',
      verifiedBy: 'synthetic-coach',
      verifiedAt: '2026-10-29T00:00:00Z',
    },
    source: {
      fileName: `synthetic-session-${index + 1}.json`,
      checksum: `sha256:${String(index + 1).repeat(64)}`,
    },
    plannedDistanceMeters: 4500,
    participants: [
      {
        athleteId: syntheticAthlete.id,
        attendance: index === 2 ? 'absent' : 'present',
        completedDistanceMeters: index === 0 ? 4200 : index === 1 ? null : 0,
        performances:
          index === 2
            ? []
            : [
                {
                  id: 'demo-100-free',
                  resultType: 'test',
                  distance: 100,
                  stroke: 'freestyle',
                  course: 'LCM',
                  totalSeconds: index === 0 ? 65.4 : 64.8,
                  verificationStatus: 'verified',
                },
                {
                  id: 'demo-provisional',
                  resultType: 'training',
                  distance: 50,
                  stroke: 'freestyle',
                  course: 'LCM',
                  totalSeconds: 30.1,
                  verificationStatus: 'provisional',
                },
                {
                  id: 'demo-missing',
                  resultType: 'training',
                  distance: 50,
                  stroke: 'backstroke',
                  course: 'LCM',
                  totalSeconds: null,
                  verificationStatus: 'verified',
                },
              ],
      },
    ],
  })),
}
