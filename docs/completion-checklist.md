# Ripe completion checklist — 3 November 2026, Australia/Brisbane

This is the current evidence ledger. Earlier milestone reports are historical leads.
The production completion standard has **not** been met.

## Verified baseline and recovery

- [x] Read AGENTS.md; initial clean checkout `eb56c73a7a6327fc364507b33c42409db1db0f44`.
- [x] Fetch remote refs. `master` remains at that commit. Bridge branch and PR #2 head both resolve to `61e4aac8a527fd022662dedec2476844fc274ec1`; earlier integration branch is its ancestor. PR merge/state/reviews cannot be read: GitHub API returns Forbidden.
- [x] Continue all completed bridge work on `codex/ripe-completion`, without merging or pushing master.
- [x] Create and verify `/workspace/recovery/squad-boss-before-completion.bundle`, a complete Git history bundle. SHA-256: `99dcb98b422483ea22e8f4db031e79eeadb41fb0654adfadac5feb8173dfba33`. Restore into a separate directory with `git clone /workspace/recovery/squad-boss-before-completion.bundle recovered-squad-boss`; this covers committed code, **not** athlete browser data or production data.
- [ ] Verify live database backup, restore procedure and recovery point before any migration. No production schema or data has been accessed; no migration attempted.

## Repository and integration roles

- `rickpendo-max/squad-boss`: inspected React/Vite/TypeScript application, existing bridge importer, localStorage repository, schemas, synthetic tests, archive rollback and archive-only recovery. No server authentication, database migrations, deployment configuration or scheduler found. Dashboard remains seeded example data.
- `rickpendo-max/Squadboss`: user identified a separate repository; HTTPS Git read returns 403 (`Write access to repository not granted`). Role and schemas remain unknown; authorise/attach this repository before implementing its integration.
- User-supplied site: https://griffith-first-block-2026.rick-pendo.chatgpt.site/ . Proxy CONNECT returns 403. Added this exact domain to the saved environment draft; runtime access has not been established.
- No Ripe connector or browser-service connector is exposed in this task's tool inventory. GitHub API is denied even though scoped Git reads work.
- Windows Verified Exports and `.ripe_bridge/verified_archive.sqlite3` exist only as user-reported paths. This machine has no connection to that host. No claim of Samsung D: access or local scheduled-task health.
- The reported 732 records, Maddie import and 3 November backup remain user-supplied reports, not independently verified observations.

## Implemented and tested here

- [x] Explicit inclusive season start/end dates with invalid/reversed range feedback; calendar-year default is labelled as a default, not an approved season.
- [x] Brisbane civil dates and Monday week grouping, including UTC/source-offset and cross-year boundaries.
- [x] Exact completed metres, missing-distance counts and weekly chart; planned distance remains separate. Summaries derive from active archive records, so rollback removes totals without deleting original evidence.
- [x] Verified recorded bests require explicit archive/CSV verification. Faster unverified records and legacy seed PBs cannot become verified bests. Event/course/type/date/source shown; lifetime PB completeness is not asserted.
- [x] Existing duplicate, conflict, identity reconciliation, source checksum, rollback, reload and archive download/recovery paths exercised in Chromium with fictional data.
- [x] Navigation/page-exit warnings protect pending coaching, CSV, performance and archive review forms. Confirmed athlete switches reset observation/interpretation drafts so they cannot be submitted under another athlete.
- [x] Responsive season inputs checked at 390px viewport.
- [x] `npm test`: all 9 files pass. Detailed run: **149 tests passed, 0 failed/skipped**.
- [x] Chromium: **9 workflow tests passed**, including fresh-browser archive recovery and repeat import protection. These are synthetic checks, not authenticated staff/athlete isolation tests.
- [x] Production build, lint and `git diff --check` pass. Saved development startup command starts Vite; HTTP GET returns Ripe index.

New files: this checklist, `tests/season-summary.test.ts`, `tests/unsaved-changes.test.ts`, `src/domain/unsaved-changes.ts` and `src/hooks/useUnsavedChanges.ts`.
Modified: `src/domain/athlete-workspace.ts`, `src/features/athlete/IntegratedWorkspace.tsx`, `src/App.css`, `tests/browser/archive-import.spec.ts`, `tests/ripe-bridge-v02-adapter.test.ts` (stale error-message assertion corrected without weakening date-conflict rejection).
Also modified navigation/athlete selection and the observation, interpretation, priority, performance, CSV and archive panels for pending-change warnings; athlete profile keys prevent drafts following another athlete.
No new dependency, schema migration, benchmark or athlete fact. Existing architecture, branding, archive/repository boundary and source approval gates retained.

## Required live completion, blocked on source/service access

- [ ] Reconcile approved manifests 005–007 with current records, original photos, corrections and revision history; verify actual SQLite/export schema compatibility before importing. No approval inferred and no real imports performed.
- [ ] Complete Maddie's verified PBs, season/IAPP targets, PST, races/tests and approved support information from actual records; expand to other athletes only after pilot passes. Missing facts remain incomplete.
- [ ] Integrate existing real attendance/season planning instead of rebuilding the reported working pilot. Group attendance, corrections/removal, Today/week totals and unsent-edit protection need the owning implementation.
- [ ] Verify production authentication, staff edits, invitations with controlled accounts and cross-athlete isolation. This local app's coach labels are audit labels, not authenticated identities. No real invitations sent.
- [ ] Verify live refresh/session persistence, print/download and recovery. Browser-local archive recovery passed only with synthetic data.
- [ ] Inspect existing daily backup and local transfer tasks before changing schedules. No crontab binary or `/etc/cron.d` here; no recurring job installed, no last-success time asserted.
- [ ] Install source discovery/staging/import/reconciliation automation only after actual source schemas, approval records, destination API and existing scheduler are accessible. Do not install an unverified SQLite exporter against an unknown schema. Original photos must remain preserved.
- [ ] Demonstrate approved real source → approval → import → attendance → Maddie → authorised views → backup, including existing records and repeat execution. Synthetic pipeline is not a substitute.
- [ ] Inspect the actual knowledge/session catalogue. Accessible checkout only contains static dashboard/block examples and benchmark comparison; no connected catalogue found. Preserve distinctions between original/delivered/proposed/AI sessions and cite evidence when that implementation is available.

## Handover and access actions

1. Authorise/attach `rickpendo-max/Squadboss` to this environment.
2. Review/save the environment draft's exact site-domain and `api.github.com` additions and setup/start instructions, then publish the environment. Saving this draft did not apply network access or deploy the app.
3. Securely transfer approved JSON exports and their original source material first, or provide an authorised connection to the Windows host. Request a protected SQLite snapshot only if the exports cannot resolve an essential fact. Enter any service credentials only in environment settings.
4. Supply the live Ripe service connection with database/backup/scheduler inspection and controlled test-account access; no secret values in chat.

Until these are available, no production deployment or readiness claim is made. No notifications, invitations, new schedules or external messages were sent.
