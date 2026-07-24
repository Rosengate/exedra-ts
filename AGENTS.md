# AGENTS.md

## 1. Project Overview

**exedra-ts** — a TypeScript port of [exedra-php](https://github.com/rosengate/exedra)'s Routeller system. Class/convention-based routing for Express.js.

- Wraps Express, does not replace it
- Peer dependency: `express ^4 || ^5`
- Dependency: `reflect-metadata ^0.2`
- Requires `experimentalDecorators: true` and `emitDecoratorMetadata: true` in tsconfig
- Must use legacy decorators (TC39 Stage 3 decorators do not support parameter decorators)

## 2. Architecture

### 2.1 File Map

```
src/
  index.ts                      Public API barrel export
  controller.ts                 Singleton base class (globalThis registry)
  handler.ts                    Core engine: reflects controllers, builds routes, createExedra()
  metadata.ts                   Symbol keys + Reflect read/write/merge helpers
  decorators.ts                 HTTP verb decorators: @Get, @Post, @Put, @Delete, @Patch, @Head, @Options
  container.ts                  IoC container (service/callable/factory registries)
  attributes/
    index.ts                    Re-exports all attributes
    path.ts                     @Path — class + method level
    name.ts                     @Name — route name
    method.ts                   @Method — HTTP verb for execute* methods
    middleware.ts                @Middleware — external middleware classes
    decorator.ts                 @Decorator — response decorators
    requestable.ts               @Requestable — dispatch visibility
    fail-route.ts                @FailRoute — marks fail route
    tag.ts                       @Tag — route tagging
    state.ts                     @State — generic key/value route state
    series.ts                    @Series — repeatable key/value
    flag.ts                      @Flag — boolean flags
    config.ts                    @Config — configuration values
    validation.ts                @Validation — validation rules (route state)
    transformer.ts               @Transformer — transformer class (route state)
    param.ts                     ParamBinding interface + Reflect metadata storage
    bind.ts                      @Param, @Body, @Query, @Header, @Req, @Res, @Next
  routing/
    factory.ts                   Creates groups, routes; carries namedParamAutoInject flag
    group.ts                     Wraps express.Router; registerOnRouter(), listRoutes(), buildHandlers()
    route.ts                     Single route definition + properties
    finding.ts                   Resolved route match, builds CallStack
    call.ts                      Single callable in the pipeline
    callstack.ts                 Ordered pipeline of Calls
  runtime/
    context.ts                   Request context (extends Container)
    call-handler.ts              Executes a Call with DI-resolved params
    response.ts                  Response wrapper
  support/
    kebab-case.ts                camelCase → kebab-case
    dot-array.ts                 Nested dot-notation get/set
    wireman.ts                   DI parameter resolver (reads emitDecoratorMetadata)
    param-names.ts               getParamNames() via Function.toString()

tests/
  kebab-case.test.ts
  controller.test.ts
  decorators.test.ts
  handler.test.ts
  param-injection.test.ts

examples/
  app.ts                         Bootstrap (Express setup + createExedra)
  data.ts                        Fake data
  controllers/
    RootController.ts            Subrouting hub (group* methods)
    UsersController.ts           GET/POST/PUT/DELETE /users
    PostController.ts            GET/POST/PATCH /posts
    HealthController.ts          GET /health (verb-only)
    DevicesController.ts         Decorator-based param injection examples
    admin/
      AdminController.ts         GET /admin + subrouting
      SettingsController.ts      GET/PUT /admin/settings
      StatsController.ts         GET /admin/stats
```

### 2.2 Module Dependencies

```
index.ts ──→ controller, handler, decorators, attributes, routing, runtime, container

handler.ts ──→ controller, metadata, factory, group, route, kebab-case
group.ts ──→ route, factory, param (bindings), param-names
factory.ts ──→ group, route
route.ts ──→ group (back-reference for path resolution)

attributes/* ──→ metadata (via mergeMetadata)
bind.ts ──→ param.ts (setParamBinding)
```

### 2.3 Request Lifecycle

```
HTTP Request
  → Express Router (registered by group.registerOnRouter)
    → Express Router mounting for subroutes (router.use('/path', childRouter))
      → Middleware pipeline (middleware* methods + @Middleware)
        → buildHandlers resolves parameters:
            1. Check for @Param/@Body/@Query/etc decorators → use decorator
            2. If namedParamAutoInject enabled → resolve by parameter name
        → Handler method executes with resolved args
          → Return value auto-sent as JSON via res.json() (if !res.headersSent)
```

## 3. Key Concepts

### 3.1 Controllers

Controllers extend the `Controller` base class. They are **singletons** — the class is just a static bag for routing, no request-scoped state on the instance.

```typescript
import { Controller, Path, Get } from 'exedra-ts';

@Path('/users')
class UsersController extends Controller {
  @Get('')
  listUsers() {
    return { data: [] };
  }
}
```

The singleton registry lives on `globalThis` to survive ts-node module duplication.

### 3.2 Method Prefix Convention

Every method in a controller MUST have a prefix OR a decorator. Methods without either are silently skipped.

| Prefix | Role | Example | Behavior |
|---|---|---|---|
| `middleware*` | Group middleware | `middlewareAuth()` | Runs for ALL routes in the controller. Receives `(req, res, next)`. |
| `decorate*` | Decorator | `decorateTransform()` | Wraps the response for all routes. |
| `setup*` | Direct group setup | `setupRoutes(group)` | Receives Group for manual route registration. Case-insensitive. |
| `execute*` | Named route | `executeIndex()` | Route with name derived from suffix (`index`). |
| `group*` | Deferred subrouting | `groupUsers()` | Returns a child controller class. |
| `get*` | GET route | `getProducts()` | GET method, name from suffix. |
| `post*` | POST route | `postUser()` | POST method, name from suffix. |
| `put*` | PUT route | `putUser()` | PUT method, name from suffix. |
| `delete*` | DELETE route | `deleteUser()` | DELETE method, name from suffix. |
| `patch*` | PATCH route | `patchStatus()` | PATCH method, name from suffix. |
| `sub*` | Immediate subrouting | `subDashboard(group)` | Receives Group for inline nesting. |
| `route*` | Route customization | `routeFaq(route)` | Receives Route for OO customization. |

**RESTful verb-only**: `get()` → GET on group base path. Verb+suffix (`getUsers()`) → suffix is route name only, NOT path. Use `@Path` for path.

**Non-prefixed methods with decorators**: If a method has `@Get`/`@Post`/`@Path` but no verb prefix, the handler detects it via `methodMeta.method || methodMeta.path` and registers it as a route.

### 3.3 Decorators

Decorators set properties on routes. They can be applied at class level (base path) or method level (route-specific).

```typescript
@Path('/users')                    // class-level: base path
@Tag('api')                        // class-level: tags all routes

class UsersController extends Controller {
  @Get('/:id')                     // method-level: HTTP verb + path
  @Name('users.show')              // method-level: route name
  @Validation({ id: 'required' })  // method-level: validation rules
  @Transformer(UserTransformer)    // method-level: response transformer
  getUser(id: string) {
    return {};
  }
}
```

### 3.4 Subrouting

Subrouting nests controllers under a parent path.

```typescript
class RootController extends Controller {
  groupUsers() {
    return UsersController;  // UsersController's @Path is appended to parent
  }

  groupAdmin() {
    return AdminController;  // AdminController's @Path is appended to parent
  }
}
```

The handler recursively resolves child controllers and mounts them via `router.use('/path', childRouter)`.

### 3.5 Parameter Injection

Two approaches, layered:

**Decorators** (always active, no config needed):
```typescript
import { Param, Body, Query, Header, Req } from 'exedra-ts';

getDevice(@Param('device') id: string) { return { id }; }
createUser(@Body('name') name: string, @Body('email') email: string) { ... }
getUsers(@Query('limit') limit: number) { ... }
getAuth(@Header('authorization') token: string) { ... }
getRaw(@Req() req: any) { return req.ip; }
```

**Named auto-injection** (opt-in via `namedParamAutoInject: true`):
```typescript
createExedra(app, { controller: RootController, namedParamAutoInject: true });

// Parameter names resolve automatically:
getDevice(device: string) { return { device }; }        // req.params.device
getUsers(limit: number) { return { limit }; }            // req.query.limit
handler(req: any) { return req.ip; }                     // Express Request
```

**Resolution priority**: Decorator > named auto-injection > undefined.

**Middleware methods** (`middleware*`) always receive Express `(req, res, next)` — param injection does NOT apply to them.

## 4. Development Commands

```bash
npm run build         # Compile src/ → dist/
npm test              # Run Jest (5 test suites, 39 tests)
npm run dev           # Start example app on http://localhost:3000
npm run dev:watch     # Start with auto-reload (ts-node-dev)
npm run routes        # List all registered routes as a table
```

## 5. TypeScript Configuration

### `tsconfig.json` (main — library compilation)

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "target": "ES2022",
    "module": "commonjs",
    "strict": true,
    "esModuleInterop": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

### `tsconfig.example.json` (examples — extends main)

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "rootDir": ".",
    "outDir": null,
    "declaration": false
  },
  "include": ["src/**/*", "examples/**/*"]
}
```

### `jest.config.js`

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
};
```

## 6. Testing

- Framework: Jest + ts-jest
- Test files are flat in `tests/` directory
- 5 suites, 39 tests covering: kebab-case utility, controller singleton, decorator metadata, handler prefix detection, parameter injection decorators

### What is tested

| Suite | Coverage |
|---|---|
| `kebab-case.test.ts` | camelCase → kebab-case conversion |
| `controller.test.ts` | Singleton pattern (globalThis registry) |
| `decorators.test.ts` | @Get/@Post/@Put/@Delete/@Patch store correct metadata |
| `handler.test.ts` | All 8 prefix parsers (middleware, decorate, setup, execute, group, restful, sub, route) |
| `param-injection.test.ts` | getParamNames utility + all 7 parameter decorators |

### What is NOT tested (yet)

- Integration tests (full Express app with real HTTP requests)
- Subrouting path merging
- Middleware execution order
- Transformer/Validation middleware pipeline
- `listRoutes()` output
- `namedParamAutoInject` name resolution at runtime

## 7. Code Conventions & Rules

1. **Every controller method must have a prefix or decorator.** Methods without either are skipped.
2. **Controllers extend `Controller`.** Path set via `@Path('/path')` at class level. No `@Controller` decorator.
3. **Middleware methods receive Express `(req, res, next)`**, not Context objects.
4. **Handler return values are auto-sent as JSON.** If handler calls `res.json()`/`res.send()` directly, it must not return a value (or `buildHandlers` checks `!res.headersSent`).
5. **Route paths use Express `:param` syntax.** No custom syntax like PHP's `[:id]`.
6. **Metadata stored via `Reflect.defineMetadata()` with Symbol keys.**
7. **`globalThis` for singleton registry** — survives ts-node module duplication.
8. **`Function.toString()` for param name extraction** — same technique as NestJS/InversifyJS.
9. **Verb prefix does NOT set path.** `getProducts()` → route name `get-products`, HTTP method GET, but path stays at group base. Use `@Path` explicitly.
10. **Subrouting path merging**: parent path + child `@Path` are concatenated.
11. **IDEs may not auto-import `express`** from peer dependency. Use `@Param`/`@Body`/etc decorators instead.
12. **Import from `'exedra-ts'`** in user code, from `'../../src'` in examples, from relative `'../src/...'` in tests.

## 8. Known Quirks / Gotchas

1. **ts-node module duplication**: Different import paths can create duplicate Controller classes. The `globalThis` singleton registry and duck-typed `validateGroup` (`typeof pattern.instance === 'function'`) work around this.

2. **`new (controllerClass as any)()` fallback**: If `instance()` isn't found (duplicate module), the handler falls back to `new`. Works because JavaScript has no runtime `protected` enforcement.

3. **Middleware methods receive Express args**: `middlewareAuth(req, res, next)` — NOT a Context. They are registered as Express middleware via `group.addMiddleware(fn)`.

4. **`buildHandlers` auto-sends return values**: If handler returns a value and `!res.headersSent`, it calls `res.json(result)`. If handler needs to send manually (streaming, redirects), return nothing.

5. **`@Middleware` attribute stores metadata but middleware* methods are what actually work**: The `@Middleware(Class)` attribute stores a string/class reference in metadata. The `middleware*` prefix methods are what get registered as Express middleware via `group.addMiddleware()`. The attribute-based middleware pipeline (`@Middleware` + middleware array in route properties) is wired through `buildHandlers` which reads `routeProps.middleware` entries.

6. **Route `getPath()` returns absolute path, `registerOnRouter` uses relative**: `route.path` is relative to the group. `route.getPath()` walks the parent chain for the full path. `registerOnRouter` uses `route.path` directly because Express Router mounting handles the prefix.

7. **`listRoutes()` trims trailing slashes**: Paths like `/devices/` are normalized to `/devices`.

8. **`PARAM_BINDINGS` Symbol on prototypes**: Parameter decorators store metadata on `target` (the prototype). `getParamBindings(target, propertyKey)` reads from the same prototype. The handler passes `controllerClass.prototype` and the method name.

## 9. PHP Origin Reference

| PHP Concept | TypeScript Equivalent |
|---|---|
| PHPDoc annotations (`@path`, `@method`) | TypeScript decorators (`@Path()`, `@Get()`) |
| PHP 8 Attributes (`#[Path('/')]`) | TypeScript decorators (same syntax) |
| `ReflectionClass` / `ReflectionMethod` | `Reflect.getMetadata()` + `Function.toString()` |
| `Controller::instance()` (singleton) | `Controller.instance()` (globalThis registry) |
| Method prefix conventions | Same prefix conventions, detected by handler |
| `Wireman` (DI resolver) | `wireman.ts` + `emitDecoratorMetadata` |
| `Container` (3-registry: service/callable/factory) | `container.ts` |
| `Group` / `Route` / `Finding` / `CallStack` | Direct equivalents wrapping Express Router |

### Source files for reference

- `exedra-php/Exedra/Routeller/Handler.php` — Original handler with prefix detection
- `exedra-php/Exedra/Routing/Group.php` — Original group routing
- `exedra-php/Exedra/Routing/Route.php` — Original route properties
- `exedra-php/Exedra/Support/Wireman/` — Original DI resolver
- `sigil/src/` — Laravel package using PHP 8 attributes, wired against Laravel's DI container
