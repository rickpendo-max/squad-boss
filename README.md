# Ripe Performance

Ripe Performance integrates the existing Squad Boss performance intelligence
with a unified athlete workspace and a reviewed verified-session archive importer.
React, TypeScript and Vite remain the application foundation.

The app uses development seed profiles plus browser-local persistence for coaching,
performance and imported archive evidence. It has no backend or authenticated
access control. Use the included fictional Demo Athlete for cloud demonstrations.
Actual Windows archive files have not been accessed or imported.

- [Technical assessment and remaining boundaries](docs/technical-assessment.md)
- [Archive contract, local connection and recovery](docs/verified-archive-integration.md)

## Development

Requires Node.js 24 (validated with 24.19.0).

```sh
npm ci
npm run dev
```

## Checks

```sh
npm test
node --test --test-isolation=none tests/*.test.ts
npm run lint
npm run build
git diff --check
```

Browser import regression tests use only synthetic data and an isolated Vite server
on port 5175:

```sh
npx playwright install --with-deps chromium
npm run test:browser
```

For a managed machine with Chromium already installed, use
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:browser`.
See [PR #2 import verification](docs/pr-2-import-verification.md) for the tested
Bridge wire variants, reconciliation rules and remaining real-archive limitation.

## Structure

- `src/components` contains shared interface components.
- `src/context` contains athlete selection state and hooks.
- `src/data` contains the current mock dashboard and athlete data.
- `src/features` contains feature-level screens.
- `src/types` contains domain types.
