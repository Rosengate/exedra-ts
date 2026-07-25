# @rosengate/exedra-ts

Class/convention-based routing for Express.js. A TypeScript port of [exedra-php](https://github.com/rosengate/exedra)'s Routeller system.

Define your routes through **method name conventions** and **decorators** on controller classes. No manual `app.get()` / `app.post()` calls — the framework reads your controllers and wires Express under the hood.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 16 or later
- [TypeScript](https://www.typescriptlang.org/) 5 or later

### Step 1: Install

```bash
npm i @rosengate/exedra-ts express reflect-metadata
npm i -D @types/express typescript
```

### Step 2: Configure TypeScript

Your `tsconfig.json` **must** include these two options or decorators won't work:

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

### Step 3: Create Your First Controller

Create a file `src/controllers/UserController.ts`:

```typescript
import express from 'express';
import { Controller, Path, Get, Post, Param, Body } from '@rosengate/exedra-ts';

@Path('/users')
export default class UserController extends Controller {
  // middleware* prefix = runs for ALL routes in this controller
  middlewareAuth(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) {
    if (!req.headers.authorization) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    next();
  }

  // verb-only method = maps to the group's base path
  get() {
    return {
      data: [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ],
    };
  }

  // @Param decorator = reads from req.params
  @Get('/:id')
  getUser(@Param('id') id: string) {
    return { id, name: 'Alice' };
  }

  // @Body decorator = reads from req.body
  @Post('')
  createUser(@Body('name') name: string) {
    return { id: 3, name };
  }
}
```

### Step 4: Create a Root Controller

Create `src/controllers/RootController.ts`:

```typescript
import { Controller } from '@rosengate/exedra-ts';
import UserController from './UserController';

export default class RootController extends Controller {
  // group* prefix = returns a child controller for subrouting
  groupUsers() {
    return UserController;
  }
}
```

### Step 5: Bootstrap

Create `src/app.ts`:

```typescript
import 'reflect-metadata';
import express from 'express';
import { createExedra } from '@rosengate/exedra-ts';
import RootController from './controllers/RootController';

const app = express();
app.use(express.json());

createExedra(app, { controller: RootController });

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
```

### Step 6: Run

```bash
npx ts-node src/app.ts
```

Test it:

```bash
curl http://localhost:3000/users          # GET /users
curl http://localhost:3000/users/1        # GET /users/1
curl -X POST -H "Content-Type: application/json" -d '{"name":"Charlie"}' http://localhost:3000/users
```

---

## Quick Start

```typescript
import 'reflect-metadata';
import express from 'express';
import { Controller, Path, Get, Post, createExedra } from '@rosengate/exedra-ts';

// --- Root controller (subrouting) ---
class RootController extends Controller {
  groupWeb() {
    return WebController;
  }
  groupApis() {
    return ApisController;
  }
}

// --- Web routes ---
@Path('/')
class WebController extends Controller {
  middlewareCors(req: express.Request, res: express.Response, next: express.NextFunction) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    next();
  }

  @Get('/')
  getIndex() {
    return { page: 'home' };
  }

  @Get('/about')
  getAbout() {
    return { page: 'about' };
  }
}

// --- API routes ---
@Path('/apis')
class ApisController extends Controller {
  middlewareLog(req: express.Request, _res: express.Response, next: express.NextFunction) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  }

  get() {
    return [{ id: 1, name: 'John' }];
  }

  post() {
    return { created: true };
  }

  @Path('/hello-world')
  getHelloWorld() {
    return { message: 'Hello, World!' };
  }
}

// --- Bootstrap ---
const app = express();
app.use(express.json());

createExedra(app, { controller: RootController });

app.listen(3000);
```

## How It Works

1. Extend `Controller` — the base class marks a class as a controller and provides singleton support
2. Use `@Path('/path')` at class level to set the base route path
3. Define route methods with **verb prefixes** (`get*`, `post*`, `put*`, `delete*`, `patch*`) or **explicit decorators** (`@Get`, `@Post`, etc.)
4. Define **middleware methods** with the `middleware*` prefix
5. Use `group*` methods to return child controller classes for subrouting
6. Call `createExedra(app, { controller: RootController })` to wire everything

## Method Prefix Convention

Every method in a controller must follow a prefix convention. The method name prefix determines its role:

| Prefix | Role | Example | Behavior |
|---|---|---|---|
| `middleware*` | Group middleware | `middlewareAuth()` | Runs for ALL routes in the controller |
| `decorate*` | Decorator | `decorateTransform()` | Wraps the response for all routes |
| `setup*` | Direct group setup | `setupRoutes(group)` | Receives Group for manual route registration |
| `execute*` | Named route | `executeIndex()` | Route with name derived from suffix |
| `group*` | Deferred subrouting | `groupUsers()` | Returns a controller class |
| `get*` | GET route | `getProducts()` | GET method, name from suffix |
| `post*` | POST route | `postUser()` | POST method, name from suffix |
| `put*` | PUT route | `putUser()` | PUT method, name from suffix |
| `delete*` | DELETE route | `deleteUser()` | DELETE method, name from suffix |
| `patch*` | PATCH route | `patchStatus()` | PATCH method, name from suffix |
| `sub*` | Immediate subrouting | `subDashboard(group)` | Receives Group for inline nesting |
| `route*` | Route customization | `routeFaq(route)` | Receives Route for OO customization |

### RESTful Verb Convention

The verb prefix determines the **HTTP method only**. The suffix is used for the **route name only**. To set the path, use `@Path` explicitly.

```typescript
@Path('/users')
class UserController extends Controller {
  get() { }                          // GET  /users
  post() { }                         // POST /users
  put() { }                          // PUT  /users
  delete() { }                       // DELETE /users

  @Path('/profile')
  getProfile() { }                   // GET  /users/profile

  @Path('/settings')
  putSettings() { }                  // PUT  /users/settings
}
```

Verb-only methods (`get()`, `post()`) map to the group's base path. Methods with a suffix (`getProducts()`) use the suffix for the route name but still need `@Path` for the path.

### Explicit Decorators

For routes that don't follow the naming convention, use explicit decorators:

```typescript
class SearchController extends Controller {
  @Get('/search')
  getSearch() { }        // GET /search

  @Post('/bulk-delete')
  postBulkDelete() { }   // POST /bulk-delete
}
```

## Middleware

### Method-Based Middleware

Define middleware as methods on the controller using the `middleware*` prefix. Middleware methods receive Express `(req, res, next)`:

```typescript
@Path('/admin')
class AdminController extends Controller {
  middlewareAuth(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) {
    if (!req.session.user) {
      res.redirect('/login');
      return;
    }
    next();
  }

  middlewareRateLimit(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) {
    // rate limiting logic
    next();
  }

  @Get('/dashboard')
  getDashboard() {
    return { page: 'dashboard' };
  }
}
// Request: middlewareAuth → middlewareRateLimit → getDashboard()
```

### Attribute-Based Middleware

Attach external middleware classes using the `@Middleware` attribute:

```typescript
@Middleware(AuthMiddleware)
@Middleware(RateLimitMiddleware)
@Path('/api')
class ApiController extends Controller {
  // CorsMiddleware → RateLimitMiddleware → controller routes
}
```

### Combining Both

```typescript
@Middleware(CorsMiddleware)
@Path('/api')
class ApiController extends Controller {
  middlewareAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
    next();
  }

  @Get('/users')
  getUsers() {
    return [];
  }
}
// Execution: CorsMiddleware → middlewareAuth → getUsers()
```

### Subrouting Inherits Parent Middleware

```typescript
@Path('/admin')
class AdminController extends Controller {
  middlewareAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
    next();
  }

  groupSettings() {
    return SettingsController;  // inherits middlewareAuth
  }
}

@Path('/settings')
class SettingsController extends Controller {
  // middlewareAuth from parent runs before all routes here

  @Get('/')
  getIndex() { return {}; }
}
```

## Subrouting

### Deferred Subrouting (`group*`)

Returns a child controller class. The child's `@Path` is appended to the parent's path:

```typescript
class RootController extends Controller {
  groupWeb() {
    return WebController;
  }
  groupApis() {
    return ApisController;
  }
}

@Path('/web')
class WebController extends Controller {
  @Get('/')
  getIndex() { return {}; }
  // Route: GET /web/
}

@Path('/apis')
class ApisController extends Controller {
  @Get('/hello')
  getHello() { return {}; }
  // Route: GET /apis/hello
}
```

### Immediate Subrouting (`sub*`)

Receives a Group for inline route registration:

```typescript
class AdminController extends Controller {
  subDashboard(group: Group) {
    group.get('/stats', (req, res) => res.json({ stats: true }));
    group.post('/reports', (req, res) => res.json({ reports: true }));
  }
}
```

### How Routing Works Under the Hood

There are two routing modes, controlled by the `useFlatRouting` config option:

```typescript
// Default — Express sub-routers with mergeParams
createExedra(app, { controller: RootController });

// Flat mode — direct registration on parent router
createExedra(app, { controller: RootController, useFlatRouting: true });
```

**Express mode (default)**: Each child group gets its own `express.Router({ mergeParams: true })`, mounted via `router.use()`. Express merges parent params into child `req.params` automatically. This is the standard, idiomatic Express approach.

**Flat mode**: All routes from all groups are registered directly on the parent Express Router with accumulated full paths. No sub-routers are used. This was the original approach and is retained for cases where Express sub-router behavior is undesirable.

Both modes ensure `req.params` has ALL params from ALL path segments:

```typescript
// @Path('/:deviceId/screens') on child controller
// @Get('/:screenId') on handler
// GET /dev123/screens/screen456

req.params.deviceId  // "dev123"
req.params.screenId  // "screen456"
```

**Class-level `@Path`**: Set the base path for all routes in a controller. The path is stored as `group.basePath` and applied as a prefix during registration.

```typescript
@Path('/api/v1/users')
class UserController extends Controller {
  @Get('/:id')
  getUser() { }    // Route: GET /api/v1/users/:id

  @Post('')
  createUser() { } // Route: POST /api/v1/users
}
```

## Decorator Methods

Decorator methods wrap the response for all routes in the controller:

```typescript
@Path('/api')
class ApiController extends Controller {
  decorateTransform(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) {
    const result = next();
    // Wrap result before sending
    return { data: result, timestamp: Date.now() };
  }

  @Get('/users')
  getUsers() {
    return [{ id: 1, name: 'John' }];
    // Response: { data: [...], timestamp: 1234567890 }
  }
}
```

## Parameter Injection

### Decorator-Based (always active)

```typescript
import { Param, Body, Query, Header, Req, Res } from '@rosengate/exedra-ts';

class UserController extends Controller {
  @Get('/:id')
  getUser(@Param('id') id: string) { return { id }; }

  @Post('')
  createUser(@Body('name') name: string, @Body('email') email: string) { ... }

  @Get('/search')
  search(@Query('q') query: string) { ... }

  @Get('/auth')
  checkAuth(@Header('authorization') token: string) { ... }

  @Get('/raw')
  getRaw(@Req() req: express.Request) { return req.ip; }
}
```

### Named Auto-Injection (opt-in)

```typescript
createExedra(app, { controller: RootController, namedParamAutoInject: true });

// Parameter names resolve automatically:
getDevice(device: string) { return { device }; }        // req.params.device
getUsers(limit: number) { return { limit }; }            // req.query.limit
```

#### Reserved Parameter Names

When using `namedParamAutoInject: true`, these names are reserved:

| Name | Resolves to |
|---|---|
| `req`, `request` | Express Request |
| `res`, `response` | Express Response |
| `next` | Express NextFunction |
| `ctx`, `context` | Per-request Context |
| `body` | `req.body` |
| `query` | `req.query` |

**Route params take priority**: if your route has `/:context`, the parameter `context` resolves from `req.params.context`, not the Context object. Use `@Ctx()` or `@Inject(Context)` for explicit injection when there's a naming conflict.

### Type-Based Injection (via Container)

Register services by class reference, and handler parameters are auto-injected by type using TypeScript's `emitDecoratorMetadata`:

```typescript
import { Container, createExedra } from '@rosengate/exedra-ts';

class Database {
  query(sql: string) { /* ... */ }
}

class Cache {
  get(key: string) { /* ... */ }
}

const container = new Container();
container.service(Database, new Database());
container.factory(Cache, () => new Cache());

createExedra(app, { controller: RootController, container });

// Handler — types resolved from Container automatically
@Get('/:id')
getUser(db: Database, cache: Cache, @Param('id') id: string) {
  const user = db.query(`SELECT * FROM users WHERE id = ${id}`);
  const cached = cache.get(`user:${id}`);
  return { user, cached };
}
```

**Resolution priority**: `@Param`/`@Body`/etc decorators > named auto-inject > type-based DI > `undefined`

**Requirements**:
- `emitDecoratorMetadata: true` and `experimentalDecorators: true` in tsconfig
- Must compile with `tsc` (not ts-jest's isolated mode) for `design:paramtypes` metadata to be emitted
- Primitives (`String`, `Number`, `Boolean`) are never resolved from the Container

### Request-Level Context

Each request gets its own `Context` instance — a per-request Container that inherits from the app Container. Middleware can register request-scoped services, and handlers can inject them via `@Ctx()`:

```typescript
import { Controller, Path, Get, Ctx, Context } from '@rosengate/exedra-ts';

class User {
  constructor(public id: number, public name: string) {}
}

class ProfileController extends Controller {
  // Middleware: 4th param is the per-request Context
  middlewareAuth(req: any, res: any, next: any, ctx: Context) {
    const user = verifyToken(req.headers.authorization);
    ctx.service(User, user);     // request-scoped — not shared with other requests
    next();
  }

  @Get('')
  getProfile(@Ctx() ctx: Context) {
    const user = ctx.resolve(User);  // resolved from this request's Context
    return { id: user.id, name: user.name };
  }
}
```

```
GET /profile (token: alice)  → { id: 1, name: 'Alice' }
GET /profile (token: bob)    → { id: 2, name: 'Bob' }   // isolated
```

**How it works**:
- A `Context` is created per-request, stored on `req._exedra_context`
- Middleware receives it as the **4th parameter**: `fn(req, res, next, ctx)`
- Handlers inject via `@Inject(token)` decorator, `@Ctx()` decorator, named auto-inject, or type-based DI
- Context is a child scope: `ctx.resolve(X)` checks its own registrations first, then falls back to the app Container

### @Inject — Explicit Token Injection

`@Inject(token)` is the most reliable way to inject services. It works with **any** TypeScript runner (ts-node, ts-node-dev, tsx, etc.) because the token is stored at decoration time, not emitted by the compiler:

```typescript
import { Controller, Get, Param, Inject, Ctx, Context } from '@rosengate/exedra-ts';

class User {
  constructor(public id: number, public name: string) {}
}

class ProfileController extends Controller {
  middlewareAuth(req: any, res: any, next: any, ctx: Context) {
    ctx.service(User, verifyToken(req.headers.authorization));
    next();
  }

  // Inject User by class token — resolved from per-request Context
  @Get('/:id')
  getProfile(@Param('id') id: string, @Inject(User) user: User) {
    return { id, name: user.name };
  }

  // Inject by string key — resolved from app Container
  @Get('/config')
  getConfig(@Inject('appName') appName: string) {
    return { appName };
  }
}
```

`@Inject` resolves from the per-request Context first (middleware-registered services), then falls back to the app Container.

**Accessing Context in middleware**: The 4th parameter is always the Context, even if your middleware uses only 3 params:

```typescript
// This works — ctx is the 4th arg
middlewareLog(req: any, res: any, next: any, ctx: Context) {
  ctx.service('requestId', crypto.randomUUID());
  next();
}

// This also works — 3 params, backward compatible
middlewareLegacy(req: any, res: any, next: any) {
  req.headers['x-powered-by'] = 'exedra';
  next();
}
```

## Attributes Reference

| Attribute | Target | Repeatable | Description |
|---|---|---|---|
| `@Path(path)` | class + method | No | Sets the route path |
| `@Name(name)` | class + method | No | Sets the route name |
| `@Method(verb)` | class + method | No | Sets HTTP method(s) |
| `@Middleware(Class)` | class + method | Yes | Attaches external middleware |
| `@Decorator(Class)` | class + method | Yes | Attaches response decorator |
| `@Requestable(bool)` | class + method | No | Whether route appears in dispatch |
| `@FailRoute` | method | No | Marks as fail route |
| `@Tag(name)` | class + method | No | Tags the route |
| `@State(key, val)` | class + method | Yes | Generic key/value state |
| `@Series(key, val)` | class + method | Yes | Repeatable key/value pairs |
| `@Flag(name)` | class + method | Yes | Boolean flags |
| `@Config(key, val)` | class + method | Yes | Configuration values |
| `@Validation(rules)` | class + method | No | Validation rules (as route state) |
| `@Transformer(Class)` | class + method | No | Transformer class (as route state) |
| `@Include(key)` | method (on transformer) | Yes | Registers optional include for transformer |
| `@Param(key?)` | parameter | Yes | Reads from `req.params[key]` |
| `@Body(key?)` | parameter | Yes | Reads from `req.body[key]` |
| `@Query(key?)` | parameter | Yes | Reads from `req.query[key]` |
| `@Header(key?)` | parameter | Yes | Reads from `req.headers[key]` |
| `@Req()` | parameter | No | Raw Express Request |
| `@Res()` | parameter | No | Raw Express Response |
| `@Next()` | parameter | No | Express NextFunction |
| `@Ctx()` | parameter | No | Per-request Context (child scope of app Container) |
| `@Inject(token)` | parameter | Yes | Explicit injection by class or string token (transpile-safe) |
| `@State(key?)` | parameter | Yes | Reads from route state |
| `@Flag(name?)` | parameter | Yes | Checks if flag is set |
| `@Series(key?)` | parameter | Yes | Reads from route series |

## Validation

Store validation rules via `@Validation` and provide your own validator:

```typescript
import { createValidationMiddleware, Validation } from '@rosengate/exedra-ts';

class UserController extends Controller {
  @Path('/users')
  @Post('')
  @Validation({ name: 'required', email: 'required|email' })
  postUser() {
    return { created: true };
  }
}

// Provide your own validator function
const validate = (data: any, rules: Record<string, any>) => {
  // your validation logic
};

app.use(createValidationMiddleware(validate));
```

## Transformer

Transform responses via `@Transformer`. The transformer class implements a `transform` method that shapes the response:

```typescript
import { Transformer } from '@rosengate/exedra-ts';

class UserTransformer {
  transform(user: any) {
    return { id: user.id, name: user.name, email: user.email };
  }
}

class UserController extends Controller {
  @Get('/:id')
  @Transformer(UserTransformer)
  getUser() {
    return { id: 1, name: 'John', email: 'john@test.com', password: 'secret' };
    // Response: { id: 1, name: 'John', email: 'john@test.com' }
  }
}
```

`@Transformer` is wired in automatically — no manual middleware setup needed.

### Includes (Fractal-style)

Add optional `@Include` methods to your transformer. Clients request them via `?include=`:

```typescript
import { Transformer, Include } from '@rosengate/exedra-ts';

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

class UserController extends Controller {
  @Get('/:id')
  @Transformer(UserTransformer)
  getUser(@Param('id') id: string) {
    return db.findUser(id); // full user with relations
  }
}
```

```
GET /users/1                       → { id: 1, name: 'John' }
GET /users/1?include=posts         → { id: 1, name: 'John', posts: [...] }
GET /users/1?include=posts,settings → { id: 1, name: 'John', posts: [...], settings: {...} }
```

- `@Include` methods receive the **original raw data** (not the transformed output)
- Unknown includes are silently ignored
- Multiple includes are comma-separated

## DI Container

exedra-ts includes a lightweight IoC container with three registries. Supports both string and class reference keys:

```typescript
import { Container } from '@rosengate/exedra-ts';

const container = new Container();

// Singletons — by string key
container.service('db', createDatabaseConnection());

// Singletons — by class reference (for type-based injection)
container.service(Database, createDatabaseConnection());

// Factories (new instance per resolve)
container.factory('mailer', () => new Mailer(config.smtp));
container.factory(Cache, () => new RedisCache());

// Callables
container.func('hash', (password: string) => bcrypt.hash(password));

// Resolution
container.resolve('db');           // the singleton
container.resolve(Database);       // the Database singleton
container.resolve('mailer');       // new Mailer instance
container.resolve('hash');         // the function
container.canResolve('db');        // true
container.canResolve(Database);    // true
```

Pass the container to `createExedra` to enable type-based injection in handlers (see [Type-Based Injection](#type-based-injection-via-container)):

## Router Primitives

These are the internal routing objects, available for advanced use:

```typescript
import { Route, Group, Finding, CallStack, Call, Factory } from '@rosengate/exedra-ts';
```

| Class | Description |
|---|---|
| `Route` | A single route definition with properties |
| `Group` | Wraps Express Router, supports nesting |
| `Finding` | A resolved route match, builds callstack |
| `CallStack` | Ordered pipeline of middleware + handler calls |
| `Call` | A single callable in the pipeline |
| `Factory` | Creates groups, routes, and findings |

## Configuration

`createExedra` accepts these options:

```typescript
createExedra(app, {
  controller: RootController,      // Required — root controller class
  namedParamAutoInject: false,     // Auto-inject handler params by name from req.params/req.query
  useFlatRouting: false,           // false = Express sub-routers (default), true = flat direct registration
  middlewares: [],                  // Global middleware functions
  decorators: [],                  // Global response decorators
  container: undefined,            // IoC Container for type-based method injection
});
```

| Option | Default | Description |
|---|---|---|
| `controller` | (required) | Root controller class that defines the routing tree |
| `namedParamAutoInject` | `false` | When `true`, handler method params are resolved by name from `req.params` and `req.query` |
| `useFlatRouting` | `false` | When `false`, uses Express `router.use()` with `mergeParams: true` (default, recommended). When `true`, registers all routes directly on parent router |
| `middlewares` | `[]` | Global middleware applied to all routes |
| `decorators` | `[]` | Global response decorators applied to all routes |
| `container` | `undefined` | IoC Container for type-based method injection. When provided, handler params are resolved by their TypeScript type from the container |

## TypeScript Configuration

Your `tsconfig.json` must include:

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

## License

MIT
