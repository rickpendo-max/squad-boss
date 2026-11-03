# Tested review release — 3 November 2026, Australia/Brisbane

Status: **review release prepared; production integration not established**.
Existing application features, dependencies, branding and athlete facts are unchanged
in this continuation. Added only release verification and connection/evidence docs.

## Preserved branches and review links

| Repository | Branch | Application baseline verified |
| --- | --- | --- |
| `rickpendo-max/squad-boss` | `codex/ripe-completion` | `0d39b6b369a85a00b9a5c7a80647eff0db20566d` |
| `rickpendo-max/Squadboss` | `codex/ripe-foundation-repair` | `94cc6e03d7a9bc2cdac2934de7e4a57aa66c6302` |

The Ripe branch gains only the release docs/script in this continuation; the
source bundle manifest records its final commit. Neither default branch is merged.
Both PR creation retries fail with GitHub GraphQL `Forbidden`; no PR is claimed.
Direct review/creation links:

- https://github.com/rickpendo-max/squad-boss/compare/master...codex/ripe-completion
- https://github.com/rickpendo-max/Squadboss/compare/main...codex/ripe-foundation-repair

PR #2 head is still `61e4aac8a527fd022662dedec2476844fc274ec1`; API access is
required to establish its current review/merge state.

## Current-instance verification

Node.js 24.19.0, npm 11.9.0, system Chromium. All final runs passed:

| Check | Ripe/Vite | Next.js foundation | Evidence type |
| --- | --- | --- | --- |
| Unit tests | 149 individual tests, 9 files | 4 tests | Local/synthetic |
| Chromium workflows | 9 | 3 | Local/synthetic |
| Build, lint, whitespace | Passed | Passed | Current build/source |
| Built-artifact smoke | Import, exact actual metres, refresh, duplicate retry | Profile edit/save/refresh | Local/synthetic |

No approved real export was present, no live Ripe record was read or reconciled,
and no real session was imported. No authenticated staff/athlete permission,
invitation, cross-athlete isolation, production backup, restore or job status
was verified. The 732-record/Maddie/backup reports remain unverified leads.

The Ripe production smoke uses its existing fictional demo import. The Next.js
smoke uses an explicitly fictional profile in a fresh temporary browser context.
The script never reads a normal user's browser profile, writes fixtures to disk,
or prints athlete records. Remote targets are rejected before opening a browser.
It is a manual release check, not a recurring job.

## Repeat the built-artifact checks

Install locked dependencies and run each repository's existing tests/build/lint.
Then, in separate local execution sessions:

```sh
cd /workspace/squad-boss
npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
```

```sh
cd /workspace/Squadboss
npm run start -- --hostname 127.0.0.1 --port 3002
```

Run the new release-only check from the Vite checkout:

```sh
cd /workspace/squad-boss
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium node scripts/verify-production.mjs
```

`VITE_RELEASE_TEST_URL` and `NEXT_RELEASE_TEST_URL` are optional loopback test
addresses only, **not Ripe service credentials or backend configuration**.
Stop only the servers you started after verification. Processes do not survive
snapshots; no background service or schedule is installed by this script.

## Private artifacts and recovery

Prepared artifacts are under `/workspace/release/ripe-review-20261103/`:
Git bundles for both branches, Vite built files, Next.js production built files,
`manifest.json`, this report and a SHA-256 checksum list. The manifest records the
exact source commits, lockfile hashes and evidence classification. Validate with
`sha256sum -c SHA256SUMS` from that directory before use.

Source bundle recovery, into a separate empty directory:

```sh
git clone squad-boss.bundle recovered-ripe
git clone Squadboss.bundle recovered-foundation
```

Use Node.js 24 and `npm ci` in recovered source checkouts. Build artifacts are for
private review with the matching source/lockfile/runtime; the Next.js archive is
not a dependency-free standalone deployment. Existing seed profiles remain in the
builds. **Do not expose these unauthenticated apps publicly as a private athlete
service.** No deployment has been performed. Git bundles protect code, not live
records, browser profiles, original photos or a database recovery point.

Existing pre-change recovery bundles were reverified as valid. Live recovery
verification must use the existing service's protected backup mechanism after
its connection is available.

## Consolidated owner actions

1. Reconnect/apply this task to the published policy containing the exact Ripe
   website domain and `api.github.com`. The observed task runtime still has custom
   allowed hosts `[]`; do not add duplicate entries or supply a new token to fix
   an un-applied domain policy.
2. Expose the existing Ripe plugin's service connection to this task, or provide
   its non-secret API/MCP specification and deployment identity. Bind credentials
   securely in environment settings. Include existing-record, import,
   backup/job inspection and controlled staff/athlete test access. See
   [connection findings](service-connection.md); no secret values in chat.
3. Securely transfer approved JSON exports 005–007 with original source and
   approval/correction material. SQLite is needed only if JSON cannot resolve an
   essential fact. Do not place private exports in the public repository.

These prerequisites gate the real Maddie source-to-backup acceptance workflow;
local passing checks do not waive them.
