# Ripe Performance — initial integration assessment

## Baseline inspected

The checkout began at `eb56c73` (the remote master tip). The named branch
`codex/athlete-performance-workspace` was not returned by the remote branch
lookup. Implementation is on `codex/ripe-performance-integration`. The initial
assessment and milestone were completed before the product owner authorized a
commit and push of that branch. No merge into master is authorized.

- React 19, TypeScript 6, Vite 8; no server or production database.
- `Athlete.id` is the shared identity for profiles, coaching and performance.
  Athlete profiles are source-controlled development seeds, not a verified roster.
- `InMemoryCoachingRepository` provides the existing domain boundary. Browser
  localStorage already retains observations, interpretations, priorities,
  decisions and performance records under `squad-boss:coaching-data` (version 1).
  The old README's claim of no persistence was outdated.
- Existing CSV import, total/split comparison, PB selection, previous comparable
  results, progression, QAS pacing and S14 Para benchmarks are reused.
- Dashboard sessions, readiness and block information are static examples.
  No attendance ledger, individual completed-volume records, IAPP or PST storage
  workflow existed. Legacy testing and PB profile fields are presentation seeds.
- Baseline: 93 individual tests passed; build and lint passed.

## Implemented boundary

Archive state is an optional additive section of the same local snapshot. It
references the existing athlete IDs; no parallel athlete database is introduced.
Verified session evidence stays immutable. Verified timed performances are
derived into the existing result interface at read time, so rollback removes
their effect on comparisons without deleting evidence or duplicating stored
performance histories. Planned distance, completed distance, null measurements
and provisional measurements have separate fields and handling.

The Ripe-branded athlete workspace adds calendar-year training summaries,
attendance, completed volume, recorded PBs and timed testing. Existing benchmark,
progression, CSV and coaching tools remain available. Optional IAPP and PST
fields use the same athlete record and show an explicit empty state; editing
and dedicated planning workflows are future work.

## Integrity and limitations

Ajv validates the explicit application-side JSON contract. Sessions with unknown
IDs, conflicts, duplicated identities or provisional approval do not enter
confirmed records. Ready sessions are staged and persisted in one snapshot before
being published in memory. Failed writes leave archive state unchanged. Audit,
rollback and archive-only backup recovery are implemented. Stale-tab writes are
rejected by comparing the last loaded/saved local snapshot; this is best-effort
local protection, not a distributed transaction or multi-user locking system.

No Windows files or actual Bridge exports were accessed. The request supplied a
format identifier and high-level concepts, not Bridge v0.2's field schema. The
adapter contract here must be checked against a redacted real export before
claiming Bridge interoperability or ingesting private archive data.

This remains a trusted-device development application. It has no authenticated
coach identity, RBAC, encryption at rest, tamper-proof audit, automated off-device
backups or production concurrency controls. Browser-local records are readable by
scripts running on the app origin. Use synthetic data in cloud demonstrations;
production private-data use requires a separate backend/security milestone.
Existing source-controlled profiles and authoritative public benchmark evidence
were preserved; new fixtures contain only an explicitly fictional athlete.

Next priorities: verify the Bridge adapter using a redacted export; build an
authenticated persistent backend with access controls and tested recovery; add
training planning/recording, IAPP/PST editing, and season/mesocycle/microcycle
workflows. No paid infrastructure was introduced.
