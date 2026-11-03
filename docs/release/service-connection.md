# Ripe service connection: evidence and required handoff

Checked 3 November 2026, 19:32 Australia/Brisbane, after the owner reported
publication. This document describes what this task can establish; it does not
identify an unobserved backend as Supabase, Firebase or another vendor.

## Observed connections

| Component | Actual connection in supplied source | What it proves |
| --- | --- | --- |
| Vite Ripe workspace | `src/repositories/in-memory-coaching-repository.ts` hydrates `squad-boss:coaching-data` via browser localStorage | Device/origin-local coaching and archive data only |
| Next.js foundation | `app/providers.tsx` subscribes to `lib/athlete-storage.ts`, keys `squadboss-athletes-v2`/`v1` | Separate device/origin-local athlete records only |
| Bridge importer | User-selected export/source files, source SHA-256 and explicit identity reconciliation | A local file contract; its archive connection ID is not a network service credential |
| Live website | HTTPS page URL supplied by owner | A web origin, not a database or authenticated service connection |
| Task credentials/tools | No Ripe tool, configured secret/runtime-variable binding or outbound identity; identity manifest has no connections | No available authenticated Ripe backend access |

No live HTTP client, API route, database driver/schema, deployment service binding,
API base URL, project identifier, authentication authority or Ripe credential name
is present in either inspected checkout. The Next.js build routes are pages only.
A repository name, working website or browser storage key cannot identify the
service behind the separately reported 732-record system.

## Exact access retry

At **2026-11-03T09:32:32Z (19:32:32 Brisbane)**:

```text
GET/CONNECT destination: griffith-first-block-2026.rick-pendo.chatgpt.site:443
curl: (56) CONNECT tunnel failed, response 403
HTTP/1.1 403 Forbidden
content-length: 16
content-type: text/plain
server: envoy
connection: close
```

TLS/HTTP application access was not reached. There was no observed Ripe response,
login page, redirect, data query or database denial. Both Git reads succeed.
PR inspection and creation for both branches fail with:

```text
Post "https://api.github.com/graphql": Forbidden
```

The saved draft contains `api.github.com` and the exact Ripe website domain.
The current runtime still reports enforced restricted access with custom
`allowed_hosts: []`, spec revision 1; the draft is revision 5 when inspected.
This discrepancy needs runtime-policy application/reconnection, not another
invented token or duplicate domain entry. The site should be retried after that
state changes; do not bypass the platform proxy or disable TLS.

## Required service connection, without guessing secrets

Expose the **existing Ripe service connection used by the ChatGPT Ripe plugin**
to this task, or provide its authoritative API/OpenAPI/MCP connection specification
and the owning deployment/backend source. The non-secret handoff must identify:

- Actual server/API hostname and base path (may differ from the website),
  service/project/workspace identity and deployment owner.
- Authentication scheme and the service's existing credential binding names,
  destinations and permissions. Credential values belong only in secure environment
  settings or the existing connector binding. This task has no evidence for an
  environment variable called `RIPE_API_KEY`, `DATABASE_URL`, etc.; none is declared.
- Operations for stable athlete IDs and existing session/revision/provenance reads;
  explicitly approved-manifest import with idempotency/conflict semantics;
  backup inventory, latest verified success and recovery procedure; existing job
  definitions and run status. Start with read access; authorise required writes
  through the existing service's supported interface.
- Existing coach/staff/athlete authentication and controlled test identities for
  permission/isolation checks. Do not send real invitations.

Allow the **actual API/auth destinations** once identified, preserving current
network settings. Bind credentials according to the actual scheme; a proxy-backed
HTTPS secret is not a raw SQL credential. A direct database connection is not
required if the existing service supports the necessary reads/import/backup
operations. Do not provision a replacement database or parallel tracker.

## Real-data gate and Maddie acceptance

No approved real exports or originals have been supplied in this workspace.
The only export fixture found is explicitly synthetic. Request **approved JSON
exports 005–007 and original source/checksum/approval material first**. SQLite is
needed only if those exports cannot establish an essential fact.

Once connected, do this against protected real evidence, without adding it to Git:

1. Read backup inventory and recovery instructions; verify a usable recovery point
   before any migration or production change. Preserve originals and revisions.
2. Read current Ripe records with stable session/athlete IDs and export/checksum
   identities. Validate each supplied export against its actual schema and source,
   approval record and corrections; reconcile 005–007 before writes.
3. Classify every session as unchanged duplicate, ready approved import, conflicting
   revision or unresolved. Keep uncertain facts provisional. Never infer athlete
   identity, approval, actual metres, PBs, targets, results or support decisions.
4. Import only ready explicitly approved facts via the existing service. Repeat the
   request and compare record counts/IDs/checksums to establish safe retries.
5. Verify actual attendance/metres, corrections/removal/reload and season/week
   boundaries. Confirm Maddie's source-verified event/course/date/PBs, results,
   season/IAPP/PST and missing-profile states against the same real records.
6. Use controlled staff/athlete sessions to verify permitted edits and cross-athlete
   isolation; verify refresh/new-session persistence and exports/print/download.
7. Confirm a post-workflow backup and run supported non-destructive recovery
   verification in an isolated recovery target. Record actual job last-success
   timestamps. Synthetic archive recovery does not satisfy this production gate.

Nothing in this document substitutes a passing local test for those live checks.
