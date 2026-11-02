# Verified session archive integration

## Supported contract and scope

The runnable importer supports the application-side contract in
[`ripe-verified-archive.schema.json`](ripe-verified-archive.schema.json).
Its runtime source is `src/data-sources/ripe-archive-schema.ts`; a test checks
that the published schema matches it. The checked-in
`tests/fixtures/ripe-synthetic-export.json` is a fictional working example.

**This is not a claim that Bridge v0.2 uses these field names.** Only the format
identifier `ripe-verified-archive-v1` and high-level session/checksum/provenance
concepts were supplied. No actual Bridge JSON or Windows archive was available.
Do not rename a real export's format identifier and assume compatibility.
First map its fields explicitly and validate against this contract.

An export contains `format`, stable `archiveId`, offset-qualified `exportedAt`
and `sessions`. Each session requires:

- Stable `id`, `title`, offset-qualified `startsAt` and `approval.status`.
- Verified approval also requires `verifiedBy` and `verifiedAt`.
- `source.fileName` (a label, never a path to fetch) and lower-case
  `source.checksum` in `sha256:<64 hex digits>` form.
- Explicit `plannedDistanceMeters`: a nonnegative number or `null`.
- `participants`, each with the canonical application `athleteId`, `attendance`
  (`present`, `absent`, `unknown`), explicit `completedDistanceMeters` (number or
  `null`), and a `performances` array (which can be empty).
- Performances require a stable participant-local `id`, `resultType`
  (`training`, `test`, `competition`), distance in metres, stroke, course
  (`LCM`, `SCM`), `totalSeconds` (positive number or `null`), and
  `verificationStatus` (`verified`, `provisional`). No split times are invented.

Unknown fields, invalid dates, malformed checksums, negative values and oversized
exports fail validation. The JSON size limit is 5 MiB; use separate exports for
larger archives. The schema documents further collection and value limits.

## Review, commit and recovery

1. Open **Athlete workspace → Verified session archive · Import & audit**.
2. Choose a JSON export, or **Review synthetic demonstration**. The latter uses
   only `demo-athlete-001`, displayed as **Demo Athlete**, with three fictional
   sessions. These are not sessions 005–007 from the owner's archive.
3. Review every row and inspect source values. Enter a coach audit label and
   acknowledge the ready-session review. The label is not authentication.
4. Import ready sessions. A mixed file can import its ready rows while other rows
   remain explicitly skipped and recorded in the batch review. One session is
   indivisible: an unknown participant blocks that whole session.
5. Select the relevant athlete. Attendance, recorded completed volume, testing,
   PBs and existing performance comparisons use that same athlete ID.

The identity key is `(archiveId, session.id)`. Identical content is a duplicate;
changed content or checksum is a conflict. The same source checksum under another
session/archive identity is also a conflict. Repeated IDs inside one export are
flagged. No name-based matching or automatic athlete creation occurs. Keep
archive IDs, session IDs and checksum meaning stable in the Bridge adapter.

Provisional sessions cannot create confirmed records. Within verified sessions,
provisional times and missing times stay in retained evidence but do not create
performance results. A missing completed distance never uses the planned value.
Known zero is displayed as zero. Totals with missing values are labelled partial;
unknown attendance is excluded from the attendance percentage denominator.
Calendar-year summaries use source-local dates, not an invented season schedule.

Archive results cannot be edited through the result editor. For a correction,
download a backup, review rollback of the affected batch, enter a reason, and
confirm. Rollback retains source evidence and the review/audit report while
excluding that batch from active totals and comparisons. It does not alter CSV,
manual or unrelated coaching records. Re-export/review all desired sessions from
that batch after correction; sessions are not silently merged or overwritten.

**Download archive backup** saves only imported archive sessions and audit state.
It does not include manual/CSV results, coaching records or profiles. Protect the
download as private data. **Recover an archive backup** validates a saved backup
and restores it only into an empty archive; it never overwrites existing batches.
Recovery is labelled with its time and coach. For complete-device recovery,
also retain a protected browser-profile/storage backup. Never clear local storage
as a routine troubleshooting step. Invalid persisted state is preserved and new
writes are blocked for recovery rather than overwriting it with seed data.

## Connecting the owner's Windows archive

Codex Cloud has no access to `D:\Ripe Performance\Session Archive` and does not
observe the daily Bridge schedule. There is no cloud watcher or auto-import.

1. On the Windows machine, run the existing Bridge export command according to
   its local documentation. Do not modify or relocate source archive files.
2. Work on a copy of the generated JSON export in a separate protected folder.
   Do not place private exports inside the repository or upload them to GitHub.
3. Verify the actual Bridge field schema using a redacted export or its schema.
   If it differs, implement a narrow adapter outside the originals. Map stable
   source IDs explicitly to existing application IDs; never infer by names.
   Preserve unknown times/distances as null and approval/provenance unchanged.
4. Check source SHA-256 values locally against original source bytes. The cloud
   importer validates checksum syntax and retains the supplied provenance; it
   cannot authenticate unseen originals or a coach's identity.
5. Use the app on a trusted local browser profile and import the copied/adapted
   JSON through the review flow. Before private production use, resolve the
   security/backend limitations in the technical assessment. For cloud acceptance
   testing, use only the included synthetic export.
6. Reconcile imported session IDs, participant IDs, attendance, completed metres
   and verified times with the local source. Verify sessions 005, 006 and 007
   individually after access is available. Until then, none are claimed imported.

## Validation

From `/workspace/squad-boss` (or your local checkout), with Node 24:

```sh
npm ci
npm test
node --test --test-isolation=none tests/*.test.ts
npm run build
npm run lint
git diff --check
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Use one development server and one browser writer. The explicit non-isolated test
command reports individual tests on this cloud runner. Browser acceptance covers
synthetic import, volume/attendance, PB/comparison integration, persistence,
duplicate handling, stale-tab rejection, quota-failure atomicity, rollback,
backup recovery, mobile layout and the preserved squad overview.
