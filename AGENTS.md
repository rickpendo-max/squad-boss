# Squad Boss Implementation Rules

## Architecture
- Preserve the existing React + Vite + TypeScript architecture.
- Inspect the repository before making changes.
- Do not redesign architecture unless explicitly approved.
- Reuse existing domain, repository and UI patterns wherever practical.
- Avoid broad refactors unless required to complete the approved task.

## Product Direction
- Athlete / Performance is the primary product workflow.
- The normal workflow is:
  Capture → Compare → Track → Highlight → Decide → Plan → Review
- Benchmark-led deterministic comparison takes precedence over speculative AI interpretation.
- Observation, Interpretation and Priority remain valid domain entities but must not dominate the normal coaching workflow.
- Minimise manual coaching administration.
- Prefer visible coach value over additional forms or process steps.

## Benchmark and Performance Rules
- Do not fabricate benchmark values.
- Preserve source, version and applicability of benchmark data.
- Compare athlete performance with authoritative benchmarks, previous comparable performances and PB/personal models where available.
- Use factual deterministic findings before causal interpretation.
- Do not infer physiological, psychological or behavioural causes from a performance difference unless explicitly supported by coach input or evidence.

## Desktop Direction
- Do not start Tauri or desktop packaging unless explicitly instructed.
- The approved future desktop direction is:
  React + Vite + TypeScript → Tauri desktop shell.
- Preserve the existing web UI architecture for that future milestone.

## Implementation Behaviour
- Keep implementation tasks narrow and tied to a clear user-visible outcome.
- Inspect current behaviour before editing.
- Do not ask the user to inspect code.
- Do not add unrelated features.
- Do not silently change established domain rules.
- If requirements conflict with the existing architecture, stop and report the conflict rather than guessing.
- Prefer the smallest implementation that materially improves the coach workflow.

## Git and Change Control
- Do not push directly to master unless explicitly instructed.
- Prefer a working branch or reviewable change for implementation work.
- Do not commit or push unless explicitly requested.
- Preserve existing functionality unless the task explicitly replaces it.

## Validation
Before declaring a task complete, run:
- npm test
- npm run build
- npm run lint
- git diff --check

## Completion Report
Always report:
1. files created;
2. files modified;
3. specific user-visible change;
4. domain or repository changes;
5. tests added or modified;
6. total test result;
7. build result;
8. lint result;
9. git diff --check result;
10. material implementation decisions;
11. any unresolved issue or blocker.
