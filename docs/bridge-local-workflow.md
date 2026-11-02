# Integrated local Bridge import workflow

This follow-up continues PR #2 from `f9ecffc9c296679eb4b7065c8503f718a70af72d`
on `codex/bridge-v02-adapter`. It connects the existing importer, athlete repository,
attendance/volume views and Squad Boss intelligence. It does not add a second
athlete database or write to the original archive.

## What is functional

- A read-only directory picker discovers recognized exports in a locally selected
  `.ripe_bridge` folder and reports skipped unsupported/malformed files. The coach
  selects which export to review; nothing is automatically imported.
- Bridge imports require original UTF-8 JSON source files. SHA-256 is computed over
  their exact bytes, checked against each entry's `source_sha256`, and the parsed
  source JSON must equal the entry's `record`. A matching hash cannot conceal an
  edited exported record. Missing/mismatched files block the transaction.
- A successful import saves exact reviewed source aliases linked to **existing**
  athlete IDs within a stable archive connection. There is no fuzzy name matching,
  athlete creation or silent remapping. New aliases/connections need review.
- Session times are reused only for the same connection/session/source checksum.
  An explicit source `starts_at` timestamp can be used as supplied. Date-only or
  AM/PM-only records still need an actual offset-qualified time from the coach;
  the application does not invent midnight or an AM/PM schedule.
- Attendance and recorded completed metres update the selected athlete immediately.
  Planned metres never fill missing completed metres. Known zero remains zero;
  zero alone does not invent attendance. Partial totals remain labelled partial.
- Explicit verified measured results update the existing performance history,
  recorded PBs, previous-result comparison and progression. Provisional/unverified
  times and null totals are retained in evidence but excluded from confirmed
  performance results. Counts, protocol descriptions and estimates never become
  measured times or completed distance.
- Source checks, import review, identity verification/revocation, rollback and
  backup/recovery remain audited. Identity/time links are backed by checked import
  evidence and validated on recovery. Facts, links and source-check receipts save
  atomically; failed writes or concurrent verification publish no partial change.
- Re-reviewing identical evidence with a new local attestation time remains a
  duplicate. Changed content, identity, time or checksum remains a conflict.

## Connect on the Windows machine

The cloud cannot open `D:\Ripe Performance\Session Archive\.ripe_bridge`.
The browser's file picker operates on the computer where that browser runs.

1. Use an existing local checkout of `codex/bridge-v02-adapter` with Node 24.
   Run `npm ci`, then `npm run dev`. Open the local application on port 5173.
   Use HTTPS or localhost: source verification requires Web Crypto's secure context.
2. Open **Athlete workspace → Verified session archive · Import & audit**.
   Choose **Open local .ripe_bridge folder (read-only)** and select
   `D:\Ripe Performance\Session Archive\.ripe_bridge`. Choose a recognized export.
   The single-export JSON picker remains available.
3. Give this archive/roster a stable **Archive connection ID**. Use a different
   connection for a different archive/roster, even if people share names.
4. Select the original JSON files referenced by the export, from the archive's
   source location, using **Original source JSON files**. No absolute paths, file
   bytes, directory handles or automatic write permissions are persisted.
5. On first import, explicitly verify each source alias against an existing athlete
   ID. Supply real session times only where the source lacks them. Confirm the coach
   review label and action time, validate, inspect the ready/duplicate/conflict rows,
   acknowledge review and import. Source checks are repeated immediately before save.
6. Select the athlete and verify attendance, completed volume, testing/PBs and
   performance progression. Subsequent exports from the same connection reuse the
   verified aliases. New source facts still undergo checksum and approval checks.

The picker only reads. Original files, Bridge scheduling and the Windows archive
remain unchanged. Folder selection is not a background watcher or cloud sync.
Selecting a folder never grants this cloud machine direct access to the D: drive.

## Supported export and measured-result contract

The three PR #2 wire variants remain supported: `schema`, `exported_utc`,
`sessions[].archive_id`, `source_sha256` and `record`; date/period, explicit approval
markers, distance maps, present/absent data and optional source `starts_at` are
validated. Every supplied recognized approval marker must agree. An explicit
non-verified `distance_status` blocks conversion; the provisional early-exit
estimate is not substituted into completed distance.

For measured results, the currently supported **normalized row contract** is:

```json
{
  "athlete_name": "Fictional One",
  "id": "synthetic-result-001",
  "resultType": "test",
  "distance": 100,
  "stroke": "freestyle",
  "course": "LCM",
  "totalSeconds": 65.2,
  "verificationStatus": "verified"
}
```

Rows belong in `record.timed_results`. `athlete_name` is an explicitly reconciled
source alias, not a heuristic match. `totalSeconds` must be an actual positive
measured value or explicit null. Verification can be `verified`, `provisional` or
`unverified`. No segment times are invented. Unknown result fields/layouts fail
closed rather than silently discarding or guessing measurements. The canonical
application export also remains supported by the original importer.

This normalized measured-row contract and optional `starts_at` handling are tested
application contracts, **not a certification that the actual Windows Bridge emits
those fields**. A redacted export or authoritative Bridge source/schema is still
required to finalize its exact field mapping.

## Identity changes and recovery

Saved aliases are scoped to a connection and exact source spelling. They assume
the coach has verified that archive's roster; they are not provider-issued stable
person IDs. A new person reusing an old alias requires explicit revocation/review.
Open **Saved Bridge identities & audit**, choose the alias, enter a coach and
reason, and revoke it. Historical athlete IDs and records remain unchanged.

Batch rollback excludes that batch from active attendance, volume and performance
views but retains evidence and source-check receipts. Verified identity links
remain available for later imports and can be revoked separately. Corrected source
content requires review; no historical data is silently overwritten.

Archive backup now includes identity/time reconciliation and its audit, as well as
session evidence and source-check receipts. Recovery validates these links and is
allowed only into an empty archive. Backups **do not contain the original source
files**, directory permissions, other CSV/manual coaching data or the entire athlete
roster. Keep a protected backup of the Windows archive and browser profile separately.
Backups contain private aliases/athlete IDs: never add them to GitHub.

## Verification and remaining production blockers

The automated tests use only fictional fixtures. They exercise folder selection,
source verification, explicit/reused identity mappings, persistent athlete facts,
measured intelligence, duplicates/conflicts, source corruption, concurrent/failed
writes, revocation, rollback and backup recovery. Reproduce with:

Final validation passed **144 unit tests across seven files**, **seven Chromium
workflow tests**, production build, lint and `git diff --check`, with no failed or
skipped tests. The full browser pipeline verified five attended sessions and
13,300 recorded metres for one existing fictional athlete, plus two verified
times reaching PB/progression views. Unverified/provisional faster values were
excluded. No file data was posted to the server and no browser page errors occurred.

```sh
npm test
node --test --test-isolation=none tests/*.test.ts
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:browser
npm run build
npm run lint
git diff --check
```

Use `npx playwright install --with-deps chromium` and omit the executable override
on machines without preinstalled Chromium.

Actual Windows archive access was unavailable. No claim is made that sessions 005–007
were imported or that the actual generator's record projection is byte/field
compatible. If its originals are PDF/DOCX/non-UTF-8 JSON, if `record` is a transformed
subset/wrapper of the original JSON, or if measured rows differ, this implementation
blocks import. An authoritative extraction contract and a redacted real export are
needed before safely changing those rules.

This remains a trusted-device local application, not a certified multi-user
production service. Coach labels are not authenticated identities; localStorage
has no role-based access or encryption at rest. SHA-256 plus source comparison
detects mismatches but does not authenticate a coach signature or the Bridge
generator. Production private-data deployment needs authenticated access, protected
storage and an operational recovery/security review. The platform environment
publishing/preview issue remains separate and does not block Git development.

## File changes

Added:

- `src/data-sources/bridge-local-files.ts`
- `src/domain/bridge-reconciliation.ts`
- `tests/bridge-integration.test.ts`
- `tests/fixtures/checked-bridge-synthetic.ts`
- `docs/bridge-local-workflow.md`

Modified:

- `README.md`, `docs/ripe-verified-archive.schema.json`
- `src/types/archive/index.ts`
- `src/data-sources/ripe-archive-schema.ts`, `ripe-archive.ts`, `ripe-bridge-v02-adapter.ts`
- `src/domain/athlete-workspace.ts`
- `src/features/athlete/ArchiveImportPanel.tsx`, `IntegratedWorkspace.tsx`
- `src/components/Header.tsx` (neutral local-storage label instead of labelling imported records as demonstration data)
- `src/repositories/coaching-repository.ts`, `in-memory-coaching-repository.ts`
- `tests/browser/archive-import.spec.ts`

No original athlete seeds, benchmark values, real archive records or credentials
were changed or added. The existing performance intelligence and canonical importer
remain in place. No dependency or lockfile changes were required for this follow-up.
