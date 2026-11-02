# PR #2 — Bridge adapter and import workflow verification

Tested the head of `codex/bridge-v02-adapter`, initially
`f309b39f97ad7819b6bd71c23c6819ad68130382`. This PR targets the existing
integration branch; no merge into that branch or master was performed.

## Failures found and corrected

The initial 118 Node tests passed, but `npm run build` failed with TypeScript
control-flow errors for untrusted envelope/session/attendance values. Declaring
the throwing validation helper as a function with an explicit `never` return
restores narrowing without unsafe casts or weakened compiler settings. The
adapter now validates its complete output through the canonical JSON schema.

Additional regression checks exposed unsafe cases that the original three adapter
tests did not cover:

- Conflicting source approval markers could pass when any one marker was positive.
  All supplied recognized markers must now have their exact approved value, with
  at least one present. A review attestation cannot override a rejected source.
- The two completed-distance fields could silently overwrite one another. Conflicting
  values now block conversion; agreeing values remain accepted.
- Explicit non-verified `distance_status` now blocks conversion. A nested
  provisional early-exit estimate is not promoted to completed volume.
- A known zero completed distance no longer invents attendance. Explicit attendance
  or positive completed distance can establish presence; zero alone remains unknown.
- Source date, AM/PM metadata and confirmed start time must agree. Date-only export
  or attestation metadata, impossible timestamps and empty exports fail closed.
- Identity and start-time mappings must be explicit own properties. Prototype
  properties cannot count as reviewed mappings.
- Editing a coach, attestation time, session time or athlete mapping invalidates
  the prior conversion/review. A failed conversion cannot leave an old importable
  result active. Switching to the canonical demo clears Bridge reconciliation.

## Verified outcomes

- `npm test`: six files passed.
- Detailed Node runner: **128 individual tests passed**, none failed or skipped.
- `npm run build`, `npm run lint`, `git diff --check`: passed.
- `npm run test:browser`: **five Chromium tests passed** using an isolated server
  and fresh browser contexts. Browser artifacts are ignored by Git.

The browser tests cover actual JSON file upload, explicit identity reconciliation,
offset-qualified session times, review acknowledgement, import, reload persistence,
duplicates, changed-source conflicts, rollback, backup download/recovery, blocked
source approval, stale-review prevention, and the original canonical importer.
No original Windows files are read or changed. Private source-location fields do
not appear in the converted UI, persisted records or downloaded backup.

The synthetic three-session Bridge fixture produces 8,300 recorded completed metres
plus one missing distance for the first fictional athlete. Its planned 5,300 m
session and provisional 3,200 m estimate never enter completed volume. Timed-result
counts and protocol descriptions produce **no performance times**. The separate
canonical synthetic demo still produces its expected completed volume and timed
performance comparisons.

## Reproduce

With Node.js 24, from the checkout:

```sh
npm ci
npm test
node --test --test-isolation=none tests/*.test.ts
npm run build
npm run lint
git diff --check
npx playwright install --with-deps chromium
npm run test:browser
```

On this managed machine Chromium is preinstalled; the verified browser command is:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:browser
```

Playwright starts and stops its own Vite process on port 5175 and does not reuse
the development preview. Only the fictional fixture is used; no private exports,
browser profiles, traces or build files should be committed.

## Remaining boundaries

These checks validate the three synthetic wire variants represented in this PR,
not an actual export from the owner's Windows archive. Real-source interoperability,
original checksum authentication and source coach identity require separate local
verification. Application coach labels remain local attestations, not authenticated
identities. Changing attestation/provenance on an already imported session can be
reported as a conflict; source evidence is never overwritten.

GitHub GraphQL check inspection returned HTTP 403; the public PR page and native
Git confirmed the PR head and target. No remote CI success is claimed from these
local checks. The environment publishing/forwarding issue remains documented in
`preview-and-publishing.md` and does not block these tests or branch development.

## Files and implementation decisions

Modified: the adapter, archive import panel, adapter tests, package manifest/lockfile,
README and `.gitignore`. Added: `playwright.config.ts`, the browser regression suite,
the shared synthetic fixture factory and this report. Playwright is a development
dependency only. The existing repository, storage key and performance domain are
unchanged. No athlete database, benchmark or historical performance data was edited.
