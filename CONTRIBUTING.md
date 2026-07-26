# Contributing to exedra-ts

Thanks for your interest in contributing! Here's how to get started.

## Development Setup

```bash
# Clone the repo
git clone https://github.com/rosengate/exedra-ts.git
cd exedra-ts

# Install dependencies
npm install

# Run the example app
npm run example
```

## Available Scripts

| Script | Description |
|---|---|
| `npm test` | Run the test suite (Jest) |
| `npm run build` | Compile src/ to dist/ |
| `npm run lint` | Check for lint errors |
| `npm run lint:fix` | Auto-fix lint errors |
| `npm run format` | Format src/ with Prettier |
| `npm run format:check` | Check formatting without writing |
| `npm run typecheck` | Type-check without emitting |
| `npm run example` | Start the example app on port 3000 |

## Project Structure

```
src/
  index.ts              Public API barrel export
  controller.ts         Singleton base class
  handler.ts            Core engine: reflects controllers, builds routes
  metadata.ts           Symbol keys + Reflect helpers
  decorators.ts         HTTP verb decorators
  container.ts          IoC container
  attributes/           All attribute decorators
  routing/              Group, Route, Factory, Finding, CallStack
  runtime/              Context, Response, CallHandler
  support/              Utilities (kebab-case, wireman, param-names)
```

## Code Conventions

1. **Legacy decorators** — the project uses `experimentalDecorators: true`. TC39 Stage 3 decorators are not supported.
2. **No `any` errors** — `@typescript-eslint/no-explicit-any` is set to `warn`. The codebase intentionally uses `any` in many places.
3. **Prefix conventions** — every controller method must have a prefix (`get*`, `post*`, `middleware*`, etc.) or a decorator (`@Get`, `@Post`, etc.).
4. **Metadata via Reflect** — all decorator metadata is stored using `Reflect.defineMetadata()` with Symbol keys.

## Testing

Tests are in `tests/` and use Jest + ts-jest. Each test file focuses on a specific feature:

```bash
# Run all tests
npm test

# Run a specific test file
npm test -- --testPathPattern=decorators

# Run with open handle detection
npx jest --detectOpenHandles
```

## Pull Requests

1. Fork the repo and create a branch from `main`
2. Make your changes
3. Add tests for new functionality
4. Run `npm test` and `npm run lint` to verify
5. Submit a pull request

## Reporting Issues

Open an issue on GitHub with:
- A clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- TypeScript version and Node.js version
