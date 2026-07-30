# exedra-ts Skill Guide

Usage cheat sheet for AI agents building applications with exedra-ts.

---

## 1. Quick Setup

### Install

```bash
npm i @rosengate/exedra-ts express
npm i -D @types/express typescript ts-node
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "target": "ES2022",
    "module": "commonjs",
    "strict": true,
    "esModuleInterop": true
  }
}
```

Both `experimentalDecorators` and `emitDecoratorMetadata` are **required**. TC39 Stage 3 decorators do not work.

### Minimal App

```typescript
import 'reflect-metadata';
import express from 'express';
import { Controller, Path, Get, createExedra } from '@rosengate/exedra-ts';

@Path('/users')
class UsersController extends Controller {
  @Get('')
  list() {
    return { data: [] };
  }

  @Get('/:id')
  getOne() {
    return { id: 1 };
  }
}

class RootController extends Controller {
  groupUsers() {
    return UsersController;
  }
}

const app = express();
createExedra(app, { controller: RootController });
app.listen(3000);
```

### Import Convention

- User code: `import { ... } from '@rosengate/exedra-ts'`
- Always add `import 'reflect-metadata'` at the top of entry files

---

## 2. Controller Patterns

Controllers extend `Controller`. They are **singletons** — one instance per class, reused across all requests.

```typescript
import { Controller, Path, Get, Post } from '@rosengate/exedra-ts';

@Path('/items')
class ItemController extends Controller {
  @Get('')
  list() {
    return [];
  }

  @Post('')
  create() {
    return { created: true };
  }
}
```

### Class-Level @Path

Sets the base path for **all** routes in the controller:

```typescript
@Path('/api/v1/users')
class UserController extends Controller {
  @Get('') // GET /api/v1/users
  list() {}

  @Get('/:id') // GET /api/v1/users/:id
  getOne() {}
}
```

### Method Prefix Convention

Every handler method MUST have a prefix OR a decorator. Methods without either are silently skipped.

| Prefix        | Role                 | Example               | Behavior                                          |
| ------------- | -------------------- | --------------------- | ------------------------------------------------- |
| `middleware*` | Group middleware     | `middlewareAuth()`    | Runs for ALL routes. Receives `(req, res, next)`. |
| `decorate*`   | Response decorator   | `decorateTransform()` | Wraps response for all routes.                    |
| `setup*`      | Manual group setup   | `setupRoutes(group)`  | Receives Group for manual route registration.     |
| `execute*`    | Named route          | `executeIndex()`      | Route name from suffix. Use `@Method` for verb.   |
| `group*`      | Deferred subrouting  | `groupUsers()`        | Returns a child controller class.                 |
| `get*`        | GET route            | `getProducts()`       | GET method, name from suffix.                     |
| `post*`       | POST route           | `postUser()`          | POST method, name from suffix.                    |
| `put*`        | PUT route            | `putUser()`           | PUT method, name from suffix.                     |
| `delete*`     | DELETE route         | `deleteUser()`        | DELETE method, name from suffix.                  |
| `patch*`      | PATCH route          | `patchStatus()`       | PATCH method, name from suffix.                   |
| `sub*`        | Immediate subrouting | `subDashboard(group)` | Receives Group for inline nesting.                |
| `route*`      | Route customization  | `routeFaq(route)`     | Receives Route for OO customization.              |

### Verb-Only vs Verb+Suffix

```typescript
@Path('/users')
class UserController extends Controller {
  get() {} // GET /users — verb-only maps to group base path
  post() {} // POST /users
  getUsers() {} // GET /users — suffix is route NAME only, NOT path. Use @Path for path.
}
```

### Explicit Decorators

For routes that don't follow naming conventions:

```typescript
class SearchController extends Controller {
  @Get('/search')
  search() {}

  @Post('/bulk-delete')
  bulkDelete() {}
}
```

### @FailRoute — Catch-All

Marks a method as the group-level catch-all for unmatched routes:

```typescript
class UsersController extends Controller {
  @Get('')
  list() {
    return [];
  }

  @FailRoute
  notFound() {
    return { error: 'not found' };
  }
}
// GET /users      → list()
// GET /users/xyz  → notFound()
```

---

## 3. Parameter Injection

### Decorator-Based (always active)

```typescript
import { Param, Body, Query, Header, Req, Res, Next, Ctx, Inject } from '@rosengate/exedra-ts';

class UserController extends Controller {
  // Route params
  @Get('/:id')
  getOne(@Param('id') id: string) { return { id }; }

  // Body fields
  @Post('')
  create(@Body('name') name: string, @Body('email') email: string) { ... }

  // Query params
  @Get('/search')
  search(@Query('q') query: string, @Query('limit') limit: number) { ... }

  // Headers
  @Get('/auth')
  checkAuth(@Header('authorization') token: string) { ... }

  // Raw Express objects
  @Get('/raw')
  getRaw(@Req() req: express.Request) { return req.ip; }

  // Response (for streaming)
  @Get('/stream')
  stream(@Res() res: express.Response) {
    res.write('chunk');
    res.end();
  }

  // Per-request Context
  @Get('/profile')
  getProfile(@Ctx() ctx: Context) {
    const user = ctx.resolve(User);
    return { name: user.name };
  }

  // Explicit token injection
  @Get('/:id')
  getDB(@Param('id') id: string, @Inject(Database) db: Database) { ... }
}
```

### @Param / @Body / @Query / @Header — With Key

With a key, reads that specific field. Without a key, reads the entire object:

```typescript
@Get('/:id')
getOne(@Param('id') id: string) { ... }     // req.params.id

@Get('')
list(@Query() query: Record<string, any>) { ... }  // entire req.query

@Post('')
create(@Body() body: any) { ... }            // entire req.body
```

### Named Auto-Injection (opt-in)

```typescript
createExedra(app, { controller: RootController, namedParamAutoInject: true });

// Parameters resolve by name automatically:
getDevice(device: string) { return { device }; }        // req.params.device
getUsers(limit: number) { return { limit }; }            // req.query.limit
getUser(req: express.Request) { return req.ip; }         // Express Request
getContext(ctx: Context) { return ctx.resolve(User); }   // Per-request Context
```

Reserved names:

| Name              | Resolves to          |
| ----------------- | -------------------- |
| `req`, `request`  | Express Request      |
| `res`, `response` | Express Response     |
| `next`            | Express NextFunction |
| `ctx`, `context`  | Per-request Context  |
| `body`            | `req.body`           |
| `query`           | `req.query`          |

Route params take priority over reserved names.

### Express Fallback (positional)

When no decorator or named injection matches, the framework fills `undefined` slots positionally from `[req, res, next]`:

```typescript
// All equivalent — position determines resolution:
getUser(req: any, res: any, next: any) {}
getUser(_req: express.Request, res: express.Response) {}
getUser(r: any, response: any) {}

// Decorators override specific slots:
getUser(@Param('id') id: string, res: express.Response) {}
// slot 0 → @Param decorator, slot 1 → Express Response via fallback
```

### Resolution Priority

`@Param`/`@Body`/etc decorators → named auto-inject → type-based DI (Container) → Express fallback → `undefined`

---

## 4. Middleware

### middleware* Prefix

Runs for ALL routes in the controller. Receives Express `(req, res, next)`:

```typescript
class ApiController extends Controller {
  middlewareAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
    if (!req.headers.authorization) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    next();
  }

  middlewareLog(req: express.Request, _res: express.Response, next: express.NextFunction) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  }

  @Get('/data')
  getData() {
    return [];
  }
}
// Request flow: middlewareAuth → middlewareLog → getData
```

### @Middleware Attribute

Function-based middleware via decorator. Class-level runs for all routes:

```typescript
function cors(req: express.Request, res: express.Response, next: express.NextFunction) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
}

@Middleware(cors)
@Path('/api')
class ApiController extends Controller {
  @Get('/users')
  getUsers() {
    return [];
  }
}
```

Method-level runs for one route only:

```typescript
class ApiController extends Controller {
  @Get('/public')
  getPublic() {
    return [];
  } // no auth

  @Get('/admin')
  @Middleware(auth)
  getAdmin() {
    return [];
  } // auth runs before this only
}
```

### Execution Order

Class `@Middleware` → `middleware*` prefix methods → method `@Middleware` → handler

### Onion Model

Middleware runs before AND after downstream:

```typescript
async middlewareTiming(req: any, res: any, next: any) {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  res.setHeader('X-Response-Time', `${ms}ms`);
}
```

### Error Handling Pattern

Wrap `next()` in try/catch to catch downstream errors:

```typescript
async middlewareErrorHandling(req: any, res: any, next: any) {
  try {
    return await next();
  } catch (e: any) {
    return { error: { message: e.message } };
  }
}
```

Key rules:

- Handler throws business errors — no `res.status()` in handlers
- Each middleware catches what it understands, re-throws the rest
- Middleware can return a value instead of calling `res.json()` — the framework sends it

### Response Wrapping via Middleware

Middleware can wrap the response by returning a value:

```typescript
async middlewareDataWrapping(req: any, res: any, next: any) {
  return { data: await next() };
}
// Handler returns [{ id: 1 }]
// Client receives { data: [{ id: 1 }] }
```

### 4th Parameter: Context

Middleware receives the per-request Context as the 4th parameter:

```typescript
middlewareAuth(req: any, res: any, next: any, ctx: Context) {
  const user = verifyToken(req.headers.authorization);
  ctx.service(User, user); // register request-scoped service
  next();
}
```

### Subrouting Inherits Parent Middleware

```typescript
@Path('/admin')
class AdminController extends Controller {
  middlewareAuth(req: any, res: any, next: any) {
    next();
  }

  groupSettings() {
    return SettingsController;
  } // inherits middlewareAuth
}

@Path('/settings')
class SettingsController extends Controller {
  // middlewareAuth from parent runs before all routes here
}
```

---

## 5. Subrouting

### group* — Deferred (Recommended)

Returns a child controller class. The child's `@Path` is appended to the parent:

```typescript
class RootController extends Controller {
  groupUsers() {
    return UsersController;
  }
  groupPosts() {
    return PostController;
  }
}

@Path('/users')
class UsersController extends Controller {
  @Get('')
  list() {
    return [];
  }

  @Get('/:id')
  getOne() {
    return {};
  }
}

@Path('/posts')
class PostController extends Controller {
  @Get('')
  list() {
    return [];
  }
}
// Routes: GET /users, GET /users/:id, GET /posts
```

### sub* — Immediate

Receives a Group for inline route registration:

```typescript
class AdminController extends Controller {
  subDashboard(group: any) {
    group.get('/stats', (req, res) => res.json({ stats: true }));
    group.post('/reports', (req, res) => res.json({ reports: true }));
  }
}
```

### setup* — Manual Group Setup

```typescript
class ApiController extends Controller {
  setupRoutes(group: any) {
    group.get('/health', () => ({ status: 'ok' }));
    group.post('/webhook', (req, res) => {
      /* ... */
    });
  }
}
```

### Path Merging

Parent path + child `@Path` are concatenated:

```
RootController (no @Path)
  └─ groupApis() → ApisController (@Path('/apis'))
       └─ groupUsers() → UsersController (@Path('/users'))
            └─ @Get('/:id') → GET /apis/users/:id
```

### Two Routing Modes

```typescript
// Default — Express sub-routers with mergeParams (recommended)
createExedra(app, { controller: RootController });

// Flat mode — all routes on parent router
createExedra(app, { controller: RootController, useFlatRouting: true });
```

Both ensure `req.params` has ALL params from ALL path segments.

---

## 6. Streaming

Handlers can stream by calling `res.write()`/`res.end()` directly and **returning `undefined`** (no return statement). The framework skips `res.json()` when the handler returns `undefined`.

### Raw Chunked Streaming

```typescript
import { Controller, Path, Get, Res } from '@rosengate/exedra-ts';

@Path('/stream')
class StreamController extends Controller {
  @Get('/raw')
  getRaw(@Res() res: express.Response) {
    res.setHeader('Content-Type', 'text/plain');
    res.write('chunk-1\n');
    res.write('chunk-2\n');
    res.write('chunk-3\n');
    res.end();
    // Do NOT return a value — return undefined so framework skips res.json()
  }
}
```

### SSE (Server-Sent Events)

```typescript
@Path('/stream')
class StreamController extends Controller {
  @Get('/sse')
  getSse(@Res() res: express.Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    res.write('data: event-1\n\n');
    res.write('data: event-2\n\n');
    res.write('data: event-3\n\n');
    res.write('data: [DONE]\n\n');
    res.end();
  }
}
```

### With Express Fallback (no @Res)

```typescript
@Get('/stream')
getStream(_req: express.Request, res: express.Response) {
  res.setHeader('Content-Type', 'text/plain');
  res.write('hello\n');
  res.end();
}
```

Both `@Res()` injection and Express fallback work identically for streaming. Use `@Res()` for explicit intent.

### Why This Works

The framework's default response sender checks `if (result !== undefined && !res.headersSent)` before calling `res.json()`. When the handler returns `undefined` (no return), `_exedra_result` is `undefined`, so the sender skips `res.json()`.

---

## 7. Validation

### @Validation + Custom Validator

Store validation rules via `@Validation`. Provide your own validator function:

```typescript
import {
  Controller,
  Path,
  Get,
  Post,
  Middleware,
  Validation,
  createValidationMiddleware,
} from '@rosengate/exedra-ts';

const validate = async (data: any, rules: Record<string, any>) => {
  for (const [field, rule] of Object.entries(rules)) {
    if (rule === 'required' && (data[field] === undefined || data[field] === '')) {
      throw new Error(`${field} is required`);
    }
  }
};

@Middleware(createValidationMiddleware(validate))
@Path('/users')
class UserController extends Controller {
  @Post('')
  @Validation({ name: 'required', email: 'required' })
  create() {
    return { created: true };
  }
}
```

### Zod Integration

```typescript
import { z } from 'zod';

const validate = async (data: any, rules: Record<string, any>) => {
  for (const [field, schema] of Object.entries(rules)) {
    if (schema instanceof z.ZodType) {
      const result = schema.safeParse(data[field]);
      if (!result.success) {
        throw new Error(`${field}: ${result.error.issues.map((i) => i.message).join(', ')}`);
      }
    }
  }
};
```

### Data Merging

- **GET/HEAD/OPTIONS**: `{ ...req.params, ...req.query }`
- **POST/PUT/PATCH/DELETE**: `{ ...req.params, ...req.query, ...req.body }`

---

## 8. Transformer & Includes

### @Transformer

Wraps the handler response before sending:

```typescript
class UserTransformer {
  transform(user: any) {
    return { id: user.id, name: user.name, email: user.email };
    // password, createdAt, etc. are stripped
  }
}

class UserController extends Controller {
  @Get('/:id')
  @Transformer(UserTransformer)
  getUser(@Param('id') id: string) {
    return { id: 1, name: 'John', email: 'john@test.com', password: 'secret' };
    // Client receives: { id: 1, name: 'John', email: 'john@test.com' }
  }
}
```

### @Include — Fractal-Style

Add optional includes. Clients request them via `?include=`:

```typescript
class UserTransformer {
  transform(user: any) {
    return { id: user.id, name: user.name };
  }

  @Include('posts')
  includePosts(user: any) {
    return user.posts.map((p: any) => ({ id: p.id, title: p.title }));
  }

  @Include('settings')
  includeSettings(_user: any) {
    return { theme: 'dark', notifications: true };
  }
}

// GET /users/1                       → { id: 1, name: 'John' }
// GET /users/1?include=posts         → { id: 1, name: 'John', posts: [...] }
// GET /users/1?include=posts,settings → { id: 1, name: 'John', posts: [...], settings: {...} }
```

Rules:

- `@Include` methods receive the **original raw data**, not the transformed output
- Unknown includes are silently ignored
- Multiple includes are comma-separated

---

## 9. DI Container

### Setup

```typescript
import { Container, createExedra } from '@rosengate/exedra-ts';

const container = new Container();

// Singletons — by string key or class reference
container.service('db', createDatabaseConnection());
container.service(Database, createDatabaseConnection());

// Factories (new instance per resolve)
container.factory('mailer', () => new Mailer(config.smtp));
container.factory(Cache, () => new RedisCache());

// Callables (named functions)
container.func('hash', (password: string) => bcrypt.hash(password));

createExedra(app, { controller: RootController, container });
```

### Type-Based Injection in Handlers

Handler parameters are auto-resolved by their TypeScript type from the Container:

```typescript
class UserController extends Controller {
  @Get('/:id')
  getUser(db: Database, cache: Cache, @Param('id') id: string) {
    const user = db.query(`SELECT * FROM users WHERE id = ${id}`);
    const cached = cache.get(`user:${id}`);
    return { user, cached };
  }
}
```

Requirements:

- `emitDecoratorMetadata: true` in tsconfig
- Container must have `Database` and `Cache` registered
- Primitives (`String`, `Number`, `Boolean`) are never resolved from Container

### Per-Request Context

Each request gets its own Context — a child scope of the app Container:

```typescript
class User {
  constructor(
    public id: number,
    public name: string,
  ) {}
}

class ProfileController extends Controller {
  middlewareAuth(req: any, res: any, next: any, ctx: Context) {
    const user = verifyToken(req.headers.authorization);
    ctx.service(User, user); // request-scoped — isolated per request
    next();
  }

  @Get('')
  getProfile(@Ctx() ctx: Context) {
    const user = ctx.resolve(User);
    return { id: user.id, name: user.name };
  }
}
```

Context API:

| Method                    | Returns                               |
| ------------------------- | ------------------------------------- |
| `ctx.state(key)`          | Value for that key, or `undefined`    |
| `ctx.state(key, default)` | Value for that key, or `default`      |
| `ctx.hasState(key)`       | `true` if key exists                  |
| `ctx.hasFlag(name)`       | `true` if flag is in the flags array  |
| `ctx.flags()`             | Copy of the entire flags array        |
| `ctx.series(key)`         | Array of values for that key, or `[]` |
| `ctx.hasSeries(key)`      | `true` if key exists in serieses map  |
| `ctx.resolve(token)`      | Resolves from this scope, then parent |

### @Inject — Explicit Token Injection

Most reliable injection method — works with any TypeScript runner:

```typescript
class UserController extends Controller {
  middlewareAuth(req: any, res: any, next: any, ctx: Context) {
    ctx.service(User, verifyToken(req.headers.authorization));
    next();
  }

  @Get('/:id')
  getProfile(@Param('id') id: string, @Inject(User) user: User) {
    return { id, name: user.name };
  }

  @Get('/config')
  getConfig(@Inject('appName') appName: string) {
    return { appName };
  }
}
```

---

## 10. Routing Meta

### @State — Key/Value Metadata

```typescript
@Path('/devices')
@State('resource', 'device') // default for all routes
@State('cache_ttl', 300) // default TTL: 5 minutes
class DeviceController extends Controller {
  @Get('')
  listDevices() {
    // inherits resource='device', cache_ttl=300
  }

  @Get('/:id')
  @State('cache_ttl', 60) // override: 1 minute
  getDevice() {}
}
```

### @Flag — Boolean Flags

```typescript
@Path('/apis')
@Flag('api') // all routes are API routes
@Flag('json') // all routes return JSON
class ApiController extends Controller {
  @Get('/public')
  getPublic() {
    /* flags: ['api', 'json'] */
  }

  @Get('/admin')
  @Flag('auth') // this route also requires auth
  getAdmin() {
    /* flags: ['api', 'json', 'auth'] */
  }
}
```

### @Series — Ordered Collections

```typescript
@Path('/pipeline')
class PipelineController extends Controller {
  @Post('/process')
  @Series('step', 'validate')
  @Series('step', 'transform')
  @Series('step', 'persist')
  process() {
    // step: ['validate', 'transform', 'persist']
  }
}
```

### Runtime Access via Parameter Decorators

```typescript
import { State, Flag, Series } from '@rosengate/exedra-ts';

class DeviceController extends Controller {
  @Get('/:device/meta')
  getMeta(
    @State('resource') resource: string, // "device"
    @State('cache_ttl') ttl: number, // 300
    @Flag('ajax') isAjax: boolean,
    @Flag('verbose') isVerbose: boolean,
    @Series('step') steps: any[], // ['validate', 'transform']
    @State('stream') isStreaming: boolean, // true or undefined
  ) {
    return { resource, ttl, isAjax, isVerbose, steps, isStreaming };
  }
}
```

Without a key — injects the entire object:

```typescript
@Get('/debug')
getDebug(@State() allStates: Record<string, any>, @Flag() allFlags: string[]) {
  return { states: allStates, flags: allFlags };
}
```

---

## 11. Common Patterns

### CRUD Controller Template

```typescript
import { Controller, Path, Get, Post, Put, Delete, Param, Body } from '@rosengate/exedra-ts';

@Path('/users')
class UsersController extends Controller {
  middlewareAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
    if (!req.headers.authorization) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    next();
  }

  @Get('')
  list() {
    return db.users.findAll();
  }

  @Get('/:id')
  getOne(@Param('id') id: string) {
    return db.users.findById(id);
  }

  @Post('')
  create(@Body('name') name: string, @Body('email') email: string) {
    return db.users.create({ name, email });
  }

  @Put('/:id')
  update(@Param('id') id: string, @Body('name') name: string) {
    return db.users.update(id, { name });
  }

  @Delete('/:id')
  remove(@Param('id') id: string) {
    return db.users.delete(id);
  }
}
```

### Auth Middleware Pattern

```typescript
class ApiController extends Controller {
  middlewareAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
    const token = req.headers.authorization;
    if (!token) {
      res.status(401).json({ error: 'Missing token' });
      return;
    }
    try {
      const user = verifyToken(token);
      req.user = user; // attach to request
      next();
    } catch (e) {
      res.status(401).json({ error: 'Invalid token' });
    }
  }
}
```

### Error Handling Middleware

```typescript
class ApiController extends Controller {
  async middlewareErrorHandling(req: any, res: any, next: any) {
    try {
      return await next();
    } catch (e: any) {
      return { error: { message: e.message } };
    }
  }
}
```

### Response Wrapping

```typescript
class ApiController extends Controller {
  async middlewareDataWrapping(req: any, res: any, next: any) {
    return { data: await next() };
  }

  @Get('/users')
  getUsers() {
    return [{ id: 1 }]; // Client receives: { data: [{ id: 1 }] }
  }
}
```

### Streaming Controller

```typescript
import { Controller, Path, Get, Res } from '@rosengate/exedra-ts';

@Path('/stream')
class StreamController extends Controller {
  @Get('/sse')
  getSse(@Res() res: express.Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const send = (data: string) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    send('connected');
    send('processing');
    send('[DONE]');
    res.end();
  }
}
```

---

## 12. Gotchas & Fixes

| Symptom                                         | Cause                                                   | Fix                                                                           |
| ----------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Route not registered                            | Method has no prefix or decorator                       | Add `get`/`post`/etc prefix or `@Get`/`@Post` decorator                       |
| `Cannot read properties of undefined`           | Controller not extending `Controller`                   | Ensure `extends Controller` and `import { Controller }`                       |
| "Headers already sent"                          | Handler returned a value AND called `res.json()`        | Return `undefined` when using `res.json()` directly                           |
| "No route found" for subrouting                 | `group*` returns instance instead of class              | Return the class: `return UsersController` not `return new UsersController()` |
| LSP "Unable to resolve signature" on decorators | TypeScript LSP misconfiguration                         | Ignore — verify with `npm test` instead                                       |
| Middleware doesn't receive Context              | Missing 4th parameter                                   | Add `ctx` as 4th param: `middlewareAuth(req, res, next, ctx)`                 |
| `req.params` missing parent params              | Using `useFlatRouting: false` without `mergeParams`     | Default already uses `mergeParams: true` — check Express version              |
| `design:paramtypes` not emitted                 | Not using `tsc` or missing `emitDecoratorMetadata`      | Ensure tsconfig has `emitDecoratorMetadata: true` and compile with `tsc`      |
| Streaming double-send                           | Handler returned value while also calling `res.write()` | Return `undefined` when streaming — no `return` statement                     |
| Type-based DI not resolving                     | Container not passed to `createExedra`                  | Add `container` option: `createExedra(app, { controller, container })`        |
| `@Middleware` not running                       | Applied to class without parentheses or wrong import    | Use `@Middleware(fn)` with parentheses, import from `@rosengate/exedra-ts`    |

### Key Rules

1. **Every handler needs a prefix or decorator** — no exceptions
2. **Handlers auto-send return values as JSON** — don't call `res.json()` AND return a value
3. **Middleware receives `(req, res, next)`, NOT Context** — Context is the 4th param
4. **Controllers are singletons** — don't store request state on the instance
5. **`group*` returns a class, not an instance** — `return UsersController` not `return new UsersController()`
6. **Use `@Res()` for streaming** — or use Express fallback with explicit `res` parameter
7. **`import 'reflect-metadata'`** — required at the top of entry files
8. **`experimentalDecorators: true`** — TC39 decorators don't support parameter decorators

---

## Configuration Reference

```typescript
createExedra(app, {
  controller: RootController, // Required — root controller class
  namedParamAutoInject: false, // Auto-inject handler params by name
  useFlatRouting: false, // false = Express sub-routers (default)
  middlewares: [], // Global middleware functions
  decorators: [], // Global response decorators
  container: undefined, // IoC Container for type-based DI
});
```

## Attribute Reference

| Attribute             | Target                 | Wired                  | Description                 |
| --------------------- | ---------------------- | ---------------------- | --------------------------- |
| `@Path(path)`         | class + method         | class + method         | Sets route path             |
| `@Name(name)`         | class + method         | class + method         | Sets route name             |
| `@Method(verb)`       | class + method         | class + method         | Sets HTTP method            |
| `@Middleware(fn)`     | class + method         | class + method         | Attaches middleware         |
| `@Requestable(bool)`  | class + method         | class + method         | Controls findability        |
| `@Tag(name)`          | method                 | method                 | Tags the route              |
| `@State(key, val)`    | class + method + param | class + method + param | Key/value state             |
| `@Flag(name)`         | class + method + param | class + method + param | Boolean flag                |
| `@Series(key, val)`   | class + method + param | class + method + param | Ordered values              |
| `@Validation(rules)`  | class + method         | method                 | Validation rules            |
| `@Transformer(Class)` | class + method         | method                 | Response transformer        |
| `@Include(key)`       | method (transformer)   | method                 | Optional include            |
| `@FailRoute`          | method                 | method                 | Group catch-all             |
| `@Decorator(Class)`   | class + method         | metadata only          | Response decorator metadata |
| `@Param(key?)`        | parameter              | parameter              | Route param                 |
| `@Body(key?)`         | parameter              | parameter              | Body field                  |
| `@Query(key?)`        | parameter              | parameter              | Query param                 |
| `@Header(key?)`       | parameter              | parameter              | Header value                |
| `@Req()`              | parameter              | parameter              | Express Request             |
| `@Res()`              | parameter              | parameter              | Express Response            |
| `@Next()`             | parameter              | parameter              | Express NextFunction        |
| `@Ctx()`              | parameter              | parameter              | Per-request Context         |
| `@Inject(token)`      | parameter              | parameter              | Token injection             |
| `@State(key?)`        | parameter              | parameter              | Route state                 |
| `@Flag(name?)`        | parameter              | parameter              | Route flag                  |
| `@Series(key?)`       | parameter              | parameter              | Route series                |
