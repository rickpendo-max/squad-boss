# Squad Boss

Squad Boss is a React and TypeScript coaching dashboard for viewing squad
readiness, session completion, training blocks, weekly sessions, and athlete
status information.

The project currently uses local mock data and has no backend or persistence
layer.

## Development

Requires a current Node.js installation.

```sh
npm install
npm run dev
```

## Checks

```sh
npm run lint
npm run build
```

## Structure

- `src/components` contains shared interface components.
- `src/context` contains athlete selection state and hooks.
- `src/data` contains the current mock dashboard and athlete data.
- `src/features` contains feature-level screens.
- `src/types` contains domain types.
