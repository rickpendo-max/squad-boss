/** Fictional wire variants only; no actual archive or athlete data. */
export const sha = (c: string) => c.repeat(64)
export function bridge() {
  return {
    schema: 'ripe-verified-archive-v1',
    exported_utc: '2026-11-02T05:28:13Z',
    sessions: [
      {
        archive_id: 'A',
        source_sha256: sha('a'),
        source_location: 'D:\\PRIVATE\\do-not-expose.json',
        record: {
          session_id: 'A',
          date: '2026-10-29',
          course: 'LCM',
          status: 'coach_verified',
          distance_m: { 'Fictional One': 4000 },
          timed_results_count: 10,
        },
      },
      {
        archive_id: 'B',
        source_sha256: sha('b'),
        source_location: 'D:\\PRIVATE\\do-not-expose-2.json',
        record: {
          archive_id: 'B',
          date: '2026-10-29',
          session: 'PM',
          status: 'coach_verified',
          athlete_distances_m: { 'Fictional One': 4300 },
          timed_results: [],
        },
      },
      {
        archive_id: 'C',
        source_sha256: sha('c'),
        source_location: 'D:\\PRIVATE\\do-not-expose-3.json',
        record: {
          archive_id: 'C',
          date: '2026-10-30',
          period: 'AM',
          review_status: 'coach_confirmed',
          planned_main_group_m: 5300,
          present: ['Fictional One'],
          absent: { 'Fictional Two': 'not attending' },
          provisional_early_exit: {
            distance_m: 3200,
            distance_status: 'provisional',
          },
          performance_protocols: [{ note: 'timing not transcribed' }],
        },
      },
    ],
  }
}
export function options() {
  return {
    archiveId: 'bridge-synthetic',
    athleteIdsBySourceName: {
      'Fictional One': 'athlete-1',
      'Fictional Two': 'athlete-2',
    },
    startsAtBySessionId: {
      A: '2026-10-29T06:00:00+10:00',
      B: '2026-10-29T16:00:00+10:00',
      C: '2026-10-30T06:00:00+10:00',
    },
    attestedBy: 'synthetic-reviewer',
    attestedAt: '2026-11-02T16:00:00+10:00',
  }
}
