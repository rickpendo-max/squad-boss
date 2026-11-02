# Preview repair and publication diagnosis

## Confirmed preview issues and repair

On inspection, no Vite process was running. Previous saved startup instructions
bound the server to loopback (`127.0.0.1`), which is unsuitable when a preview
proxy connects from outside the machine. Live processes do not survive a cloud
snapshot restore.

`vite.config.ts` now configures development and production-preview servers with
`host: 0.0.0.0`, `port: 5173`, and `strictPort: true`. Start from
`/workspace/squad-boss` with `npm run dev`; keep the terminal session alive. The
explicit equivalent is `npm run dev -- --host 0.0.0.0 --port 5173 --strictPort`.
Vite hostname verification remains enabled. If an actual forwarded preview URL
is rejected by Vite, allow that exact verified hostname using the supported
`__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS` variable. Do not allow every hostname.

Chromium returned HTTP 200 and rendered Ripe Performance on loopback and both
non-loopback machine IPs. The athlete workspace, season overview, Demo Athlete
and synthetic archive review were verified with no page errors. Machine-local
browser validation does not establish reachability from the product's external
preview URL. A forwarded URL was not exposed by the available tools.

## Environment publishing investigation

The environment API reports connected/running with `failure: null`. That reports
runtime readiness, not publication success. Retained diagnostic history returned
`history_status: not_found`, no records, and no legacy diagnostic snapshot. The
available tools do not expose a publish operation or publish-attempt logs. The
actual failure cause therefore remains unconfirmed.

The product owner supplied the exact error on 2 November 2026:

> Couldn't publish environment. Your settings are saved. Try publishing again.

Repeated attempts return the same generic message. The machine still reports
connected/running, and no failed-publish logs or operation IDs are exposed to the
agent. Independent checks found ample disk space and inodes, a clean `git fsck`,
and no broken or escaping project symlinks outside dependency output. These
checks rule out the observed local problems; they do not establish the platform
failure's root cause. The externally forwarded preview URL is also unavailable.
Platform publication/forwarding remains a separate blocker, not an application
development or Git branch publishing prerequisite.

The saved draft had an empty repository mount path while the actual checkout is
`/workspace/squad-boss`. After complete checkout discovery, the draft was normalized
to mount path `squad-boss` with the existing full HEAD
`eb56c73a7a6327fc364507b33c42409db1db0f44`. This fixes a configuration mismatch;
it is not proof that the mismatch caused the failed publish. Updated startup
instructions were also saved and read back successfully (draft revision 3).
The installation script and network/credential requirements were preserved.

The save returned `requires_publish: true`: the draft is saved, not published.
Review/save it in environment settings and use the product's Publish action.
If publication fails, preserve the exact error text and operation time. Do not
reset, discard, commit or push working changes merely to make publishing pass.
No external preview URL or successful publication is claimed by this report.

## Preservation and checks

A verified recovery tar archive, including Git metadata and all source/configuration
files, is stored outside the checkout at
`/workspace/recovery/ripe-before-preview-fix.tar.gz`. A SHA-256 file manifest is
alongside it. Dependencies and generated build output were excluded. Comparison
against the manifest confirmed all completed integration files are unchanged;
only the existing `vite.config.ts` changed. This new report is additive. No
application logic, domain models, tests, dependency declarations or lockfiles were
changed during the preview repair. That repair was initially reviewed before any
commit or push. The product owner subsequently authorized committing and pushing
the completed integration and repair to `codex/ripe-performance-integration`;
merging into master or another branch remains prohibited.

`npm test` passed all five files. The detailed runner passed 115 tests with none
failed or skipped. Build, lint and `git diff --check` passed. No tests were added
or modified for this configuration-only repair.
