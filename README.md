# exedra-ts

Class/convention-based routing for Express.js. A TypeScript port of [exedra-php](https://github.com/rosengate/exedra)'s Routeller system.

Define your routes through **method name conventions** and **decorators** on controller classes. No manual `app.get()` / `app.post()` calls — the framework reads your controllers and wires Express under the hood.

## Installation

```bash
npm i exedra-ts express reflect-metadata
```

**Requirements**: TypeScript with `experimentalDecorators` and `emitDecoratorMetadata` enabled.

## Quick Start

```typescript
import 'reflect-metadata';
import express from 'express';
import { Controller, Path, Get, Post, createExedra } from 'exedra-ts';

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
  middlewareCors(context: Context, next: () => Promise<any>) {
    context.res.setHeader('Access-Control-Allow-Origin', '*');
    return next();
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
  middlewareLog(context: Context, next: () => Promise<any>) {
    console.log(`[${new Date().toISOString()}] ${context.req.method} ${context.req.path}`);
    return next();
  }

  get(context: Context) {
    return [{ id: 1, name: 'John' }];
  }

  post(context: Context) {
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
  post(context: Context) { }         // POST /users
  put(context: Context) { }          // PUT  /users
  delete(context: Context) { }       // DELETE /users

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

Define middleware as methods on the controller using the `middleware*` prefix:

```typescript
@Path('/admin')
class AdminController extends Controller {
  middlewareAuth(context: Context, next: () => Promise<any>) {
    if (!context.req.session.user) {
      return context.redirect('/login');
    }
    return next();
  }

  middlewareRateLimit(context: Context, next: () => Promise<any>) {
    // rate limiting logic
    return next();
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
  middlewareAuth(context: Context, next: () => Promise<any>) {
    return next();
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
  middlewareAuth(context: Context, next: () => Promise<any>) {
    return next();
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

## Decorator Methods

Decorator methods wrap the response for all routes in the controller:

```typescript
@Path('/api')
class ApiController extends Controller {
  decorateTransform(context: Context, next: () => Promise<any>) {
    const result = await next();
    return { data: result, timestamp: Date.now() };
  }

  @Get('/users')
  getUsers() {
    return [{ id: 1, name: 'John' }];
    // Response: { data: [...], timestamp: 1234567890 }
  }
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

## Validation

Store validation rules via `@Validation` and provide your own validator:

```typescript
import { createValidationMiddleware, Validation } from 'exedra-ts';

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

Transform responses via `@Transformer`. The transformer is an object with a `transform` method:

```typescript
import { Transformer, createTransformerMiddleware } from 'exedra-ts';

class UserTransformer {
  transform(user: any) {
    return { id: user.id, name: user.name };
  }
}

class UserController extends Controller {
  @Path('/users/:id')
  @Get('')
  @Transformer(UserTransformer)
  getUser() {
    return { id: 1, name: 'John', password: 'secret' };
    // Response: { id: 1, name: 'John' }
  }
}

app.use(createTransformerMiddleware());
```

## DI Container

exedra-ts includes a lightweight IoC container with three registries:

```typescript
import { Container } from 'exedra-ts';

const container = new Container();

// Singletons
container.service('db', createDatabaseConnection());

// Factories (new instance per resolve)
container.factory('mailer', () => new Mailer(config.smtp));

// Callables
container.func('hash', (password: string) => bcrypt.hash(password));

// Resolution
container.resolve('db');           // the singleton
container.resolve('mailer');       // new Mailer instance
container.resolve('hash');         // the function
container.canResolve('db');        // true
```

## Context

The `Context` object is available in middleware methods and route handlers. It provides access to the request, response, parameters, and state:

```typescript
class UsersController extends Controller {
  @Path('/users/:id')
  getProfile(context: Context) {
    const id = context.param('id');
    const auth = context.state('auth');
    const isAjax = context.hasFlag('ajax');

    context.json({ id, auth, isAjax });
  }
}
```

### Context API

| Method | Description |
|---|---|
| `param(name)` | Get route parameter |
| `hasParam(name)` | Check if parameter exists |
| `state(key, default?)` | Get state value (merged from route chain) |
| `hasState(key)` | Check if state exists |
| `hasFlag(flag)` | Check if flag is set |
| `flags()` | Get all flags |
| `series(key)` | Get series values |
| `hasSeries(key)` | Check if series exists |
| `next()` | Call next middleware in the pipeline |
| `redirect(url)` | Redirect to URL |
| `json(data)` | Send JSON response |
| `send(body?)` | Send response body |
| `status(code)` | Set status code |

## Router Primitives

These are the internal routing objects, available for advanced use:

```typescript
import { Route, Group, Finding, CallStack, Call, Factory } from 'exedra-ts';
```

| Class | Description |
|---|---|
| `Route` | A single route definition with properties |
| `Group` | Wraps Express Router, supports nesting |
| `Finding` | A resolved route match, builds callstack |
| `CallStack` | Ordered pipeline of middleware + handler calls |
| `Call` | A single callable in the pipeline |
| `Factory` | Creates groups, routes, and findings |

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
