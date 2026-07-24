# exedra-ts — Implementation Plan

A TypeScript port of exedra-php's Routeller system — class/annotation-based routing for Express.js.

## Quick Start

```bash
npm i exedra-ts express reflect-metadata
```

```typescript
import 'reflect-metadata';
import express from 'express';
import { Controller, Get, Post, Path, Middleware, createExedra } from 'exedra-ts';

@Controller('/')
class WebController {
  @Get('/')
  index() {
    return { page: 'home' };
  }
}

@Controller('/apis')
@Middleware(AuthMiddleware)
class ApisController {
  @Get('/hello-world')
  helloWorld() {
    return { message: 'Hello, World!' };
  }
}

@Controller('/')
class RootController {
  groupWeb() {
    return WebController;
  }
  groupApis() {
    return ApisController;
  }
}

const app = express();
app.use(express.json());
createExedra(app, { controller: RootController });
app.listen(3000);
```

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [File Structure](#file-structure)
3. [Module Design](#module-design)
   - [Controller Base Class](#controller-base-class)
   - [Decorators](#decorators)
   - [Attributes](#attributes)
   - [Metadata System](#metadata-system)
   - [Handler Engine](#handler-engine)
   - [Routing Primitives](#routing-primitives)
   - [Runtime Pipeline](#runtime-pipeline)
   - [DI Container](#di-container)
   - [Wireman (DI Resolver)](#wireman-di-resolver)
   - [Validation Attribute](#validation-attribute)
   - [Transformer Attribute](#transformer-attribute)
4. [Method Prefix Convention](#method-prefix-convention)
5. [Attribute Reference](#attribute-reference)
6. [Public API](#public-api)
7. [Implementation Phases](#implementation-phases)
8. [Compiler Configuration](#compiler-configuration)
9. [Package Configuration](#package-configuration)

---

## Architecture Overview

exedra-ts wraps Express.js as its HTTP layer. Unlike NestJS which replaces Express routing entirely, exedra-ts reads controller classes via reflection and registers routes directly on Express.

**Request lifecycle:**

```
HTTP Request
  → Express Router
    → Finding (matched route)
      → CallStack (middleware pipeline)
        → Middleware₁ → Middleware₂ → ... → Decorator₁ → Handler
                                                          ↓
                                                    Context (DI, params, states)
                                                          ↓
                                                    Response
```

**Key concepts:**

- **Controller**: A class where method names + decorators define routing. Controllers are singletons.
- **Handler**: The core engine. Reflects controller classes, detects method name prefixes, reads decorators/attributes, builds routes on Express.
- **Group**: Wraps `express.Router`. Supports nesting for subrouting.
- **Route**: A single route definition with properties (path, method, middleware, states, etc.).
- **Finding**: A resolved route match. Builds a CallStack from the full route chain.
- **CallStack**: Ordered pipeline of Calls (middleware → decorators → handler).
- **Context**: Request context passed through the pipeline. Holds params, states, flags, DI scope.
- **Container**: IoC container with service/callable/factory registries.
- **Wireman**: DI resolver that reads `emitDecoratorMetadata` to auto-resolve method parameters.

---

## File Structure

```
exedra-ts/
  package.json
  tsconfig.json
  PLAN.md
  src/
    index.ts
    controller.ts
    handler.ts
    container.ts
    metadata.ts
    decorators.ts
    attributes/
      index.ts
      path.ts
      name.ts
      method.ts
      middleware.ts
      decorator.ts
      requestable.ts
      fail-route.ts
      tag.ts
      state.ts
      series.ts
      flag.ts
      config.ts
      validation.ts
      transformer.ts
    routing/
      factory.ts
      group.ts
      route.ts
      finding.ts
      call.ts
      callstack.ts
    runtime/
      context.ts
      call-handler.ts
      response.ts
    support/
      kebab-case.ts
      dot-array.ts
      wireman.ts
  tests/
    container.test.ts
    handler.test.ts
    decorators.test.ts
    middleware.test.ts
    subrouting.test.ts
    validation.test.ts
    transformer.test.ts
    integration.test.ts
```

---

## Module Design

### Controller Base Class

**File**: `src/controller.ts`

Controllers are singletons — they are anemic static bags for routing. No request-scoped state lives on the controller instance.

```typescript
export abstract class Controller {
  private static instances = new Map<Function, any>();

  static instance<T extends Controller>(this: new () => T): T {
    if (!Controller.instances.has(this)) {
      Controller.instances.set(this, new this());
    }
    return Controller.instances.get(this) as T;
  }

  protected constructor() {}
}
```

Usage:

```typescript
class UserController extends Controller {
  @Get('/')
  list() { return []; }
}

// Controller is instantiated once, reused across all requests
UserController.instance();
```

---

### Decorators

**File**: `src/decorators.ts`

HTTP verb method decorators. These store route metadata on the method.

```typescript
export function Get(path?: string): MethodDecorator {
  return (target, propertyKey, descriptor) => {
    // Stores { method: 'GET', path } in method metadata
  };
}

export function Post(path?: string): MethodDecorator { ... }
export function Put(path?: string): MethodDecorator { ... }
export function Delete(path?: string): MethodDecorator { ... }
export function Patch(path?: string): MethodDecorator { ... }
export function Head(path?: string): MethodDecorator { ... }
export function Options(path?: string): MethodDecorator { ... }
```

These can coexist with method prefix detection. If a method is named `getProducts` AND has `@Get('/items')`, the explicit decorator takes precedence for path/method, but the prefix determines the route name.

---

### Attributes

**Directory**: `src/attributes/`

Each attribute is a decorator factory that stores metadata via `Reflect.defineMetadata()`. They can be applied at class level or method level.

#### @Path

Sets the route path. At class level, it's the base path. At method level, it's appended.

```typescript
@Controller('/users')
@Path('/api')            // class level: /users is relative to parent group
class UserController {
  @Get('/')
  @Path('/list')         // method level: full path becomes /list
  list() { ... }
}
```

#### @Name

Sets the route name (used for URL generation and named route lookup).

```typescript
@Get('/about')
@Name('about-us')
aboutUs() { ... }
// Route name: 'about-us'
```

#### @Method

Sets HTTP methods on execute* methods (which don't have an explicit verb prefix).

```typescript
@Execute('admin-default')
@Method('GET|POST')
adminDefault() { ... }
```

#### @Middleware

Attaches external middleware classes to a route or controller.

```typescript
@Middleware(AuthMiddleware)
@Middleware(RateLimitMiddleware)
@Controller('/admin')
class AdminController { ... }
```

#### @Decorator

Attaches response transformer middleware (decorators wrap the response).

```typescript
@Decorator(TransformResponse)
class ApisController { ... }
```

#### @Requestable

Whether the route appears in dispatch lookup.

```typescript
@Get('/hidden')
@Requestable(false)
hiddenRoute() { ... }
```

#### @FailRoute

Marks a method as the fail route (called when no route matches in the group).

```typescript
@Get('/error')
@FailRoute
@Requestable(false)
handleError() { ... }
```

#### @Tag

Tags a route for grouping/filtering.

```typescript
@Get('/users')
@Tag('admin')
listUsers() { ... }
```

#### @State

Generic key/value state attached to a route. Accessed at runtime via `context.state('key')`.

```typescript
@Get('/admin')
@State('need_auth', true)
adminPanel() { ... }
```

#### @Series

Repeatable key/value pairs (like middleware stacks, validator chains).

```typescript
@Series('transformer', UserTransformer)
@Series('transformer', RoleTransformer)
listUsers() { ... }
```

#### @Flag

Boolean flags on routes.

```typescript
@Get('/api')
@Flag('ajax')
apiRoute() { ... }
```

#### @Config

Configuration values attached to routes.

```typescript
@Get('/upload')
@Config('request_limit', 15)
upload() { ... }
```

#### @Validation

Stores validation rules as route state. Used by a validation middleware.

```typescript
@Post('/users')
@Validation({ name: 'required', email: 'required|email' })
createUser() { ... }
```

#### @Transformer

Stores a transformer class as route state. Used by a transformer middleware.

```typescript
@Get('/users/:id')
@Transformer(UserTransformer)
getUser() { ... }
```

---

### Metadata System

**File**: `src/metadata.ts`

All metadata is stored using `Reflect.defineMetadata()` with Symbol keys to avoid collisions.

```typescript
// Symbol keys
const ROUTE_METADATA = Symbol('route');
const ATTRIBUTES_METADATA = Symbol('attributes');
const STATES_METADATA = Symbol('states');
const SERIES_METADATA = Symbol('serieses');
const FLAGS_METADATA = Symbol('flags');
const MIDDLEWARE_METADATA = Symbol('middleware');
const DECORATOR_METADATA = Symbol('decorator');
const PATH_METADATA = Symbol('path');
const NAME_METADATA = Symbol('name');
const METHOD_METADATA = Symbol('method');
const REQUESTABLE_METADATA = Symbol('requestable');
const FAIL_ROUTE_METADATA = Symbol('failRoute');
const TAG_METADATA = Symbol('tag');
const VALIDATION_METADATA = Symbol('validation');
const TRANSFORMER_METADATA = Symbol('transformer');
const PARAM_METADATA = Symbol('params');

// Helpers
function getRouteMetadata(target: any, propertyKey?: string): RouteMetadata { ... }
function setRouteMetadata(target: any, propertyKey: string, metadata: Partial<RouteMetadata>): void { ... }
function getAttributes(target: any, propertyKey?: string): AttributeEntry[] { ... }
function addAttribute(target: any, propertyKey: string | undefined, attribute: AttributeEntry): void { ... }
```

---

### Handler Engine

**File**: `src/handler.ts`

The core engine. Mirrors `Exedra\Routeller\Handler`. This is the largest and most complex module (~250 lines).

```typescript
class Handler {
  private static HTTP_VERBS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];
  private controllerInstances: Map<Function, Controller>;
  private reflectionCache: Map<Function, Reflection>;

  resolveGroup(factory: Factory, controllerClass: Function, parentRoute?: Route): Group {
    // 1. Get singleton controller instance
    // 2. Reflect on the class
    // 3. Read class-level attributes
    // 4. Iterate methods, detect prefixes
    // 5. For each detected route, read method-level attributes
    // 6. Merge class + method properties
    // 7. Register routes on Group
  }

  // Prefix detection methods
  parseMiddlewareMethod(name: string): boolean { return name.startsWith('middleware'); }
  parseDecorateMethod(name: string): boolean { return name.startsWith('decorate'); }
  parseSetupMethod(name: string): boolean { return name.startsWith('setup'); }
  parseExecuteMethod(name: string): string | null { ... }  // returns route name
  parseGroupMethod(name: string): string | null { ... }    // returns route name
  parseRestfulMethod(name: string): [string, string] | null { ... } // returns [routeName, verb]
  parseSubMethod(name: string): string | null { ... }      // returns route name
  parseRouteMethod(name: string): string | null { ... }    // returns route name
}
```

**Property merging** (from PHP `propertiesDeferringMerge`):

When a `group*` method returns a child controller class, the child's class-level `@Path` is concatenated with the parent's path:

```
Parent @Path('/admin') + Child @Path('/users') = '/admin/users'
```

Middleware arrays are merged. States are merged (child overrides parent for same key).

---

### Routing Primitives

#### Route

**File**: `src/routing/route.ts`

```typescript
class Route {
  name: string;
  group: Group;
  properties: RouteProperties;

  // Properties
  path: string;
  method: string | null;       // HTTP verb
  middleware: MiddlewareEntry[];
  decorator: Function[];
  states: Record<string, any>;
  serieses: Record<string, any[]>;
  flags: string[];
  config: Record<string, any>;
  requestable: boolean;
  asFailRoute: boolean;
  tag: string | null;
  execute: string | null;       // 'controller@method' reference
  subroutes: string | Function | null;

  // Full properties from parent chain
  fullProperties(): RouteProperties { ... }
  fullPath(): string { ... }
}
```

#### Group

**File**: `src/routing/group.ts`

Wraps `express.Router`. Supports nesting for subrouting.

```typescript
class Group {
  router: express.Router;
  parent: Group | null;
  routes: Route[];
  middlewares: MiddlewareEntry[];
  decorators: Function[];
  factory: Factory;

  addRoute(route: Route): void
  addMiddleware(fn: Function, properties?: any): void
  addDecorator(fn: Function): void

  // HTTP verb shortcuts (for setup* methods)
  get(path: string, handler: Function): this
  post(path: string, handler: Function): this
  put(path: string, handler: Function): this
  delete(path: string, handler: Function): this

  // Dispatch
  findByRequest(request: Request): Finding
  findRoute(name: string): Route | null
  hasFailRoute(): boolean
  getFailRoute(): string | null
}
```

#### Finding

**File**: `src/routing/finding.ts`

A resolved route match. Collects all properties from the full route chain and builds a CallStack.

```typescript
class Finding {
  route: Route;
  parameters: Record<string, string>;
  request: Request;

  getCallStack(): CallStack {
    // 1. Collect middleware from route chain (parent → child)
    // 2. Collect decorators
    // 3. Resolve execute handler
    // 4. Build CallStack: [middleware₁, middleware₂, ..., decorator₁, handler]
  }
}
```

#### Call

**File**: `src/routing/call.ts`

```typescript
class Call {
  callable: Function;
  properties: Record<string, any>;

  hasDependencies(): boolean
  getDependencies(): string[]
  invoke(...args: any[]): any
}
```

#### CallStack

**File**: `src/routing/callstack.ts`

```typescript
class CallStack {
  calls: Call[];
  private pointer: number;

  addCall(call: Call): void
  getNextCallable(): (...args: any[]) => Promise<any>  // returns $next closure
  getNextCaller(): Function
  reset(): void
}
```

The `$next` pattern:

```typescript
// Each middleware receives a next() function that calls the next item in the stack
getNextCallable() {
  const current = this.calls[this.pointer++];
  return (...args) => current.invoke(...args, () => this.getNextCallable()());
}
```

#### Factory

**File**: `src/routing/factory.ts`

```typescript
class Factory {
  createGroup(routes?: any[], parentRoute?: Route): Group
  createRoute(group: Group, name: string, properties: Record<string, any>): Route
  createFinding(route: Route, parameters: Record<string, string>, request: Request): Finding
}
```

---

### Runtime Pipeline

#### Context

**File**: `src/runtime/context.ts`

Extends Container. Carries request-scoped data through the middleware pipeline.

```typescript
class Context extends Container {
  req: Request;
  res: Response;
  params: Record<string, string>;
  private _states: Record<string, any>;
  private _flags: string[];
  private _serieses: Record<string, any[]>;
  private callStack: CallStack;
  private callHandler: CallHandler;

  // Parameter access
  param(name: string): string | undefined
  hasParam(name: string): boolean

  // State access (merged from route chain)
  state(key: string, defaultValue?: any): any
  hasState(key: string): boolean

  // Flag access
  hasFlag(flag: string): boolean
  flags(): string[]

  // Series access
  series(key: string): any[]
  hasSeries(key: string): boolean

  // Pipeline
  next(): Promise<any>   // calls next callable in callstack
  redirect(url: string): void
  forward(routeName: string, params?: Record<string, string>): void
}
```

#### CallHandler

**File**: `src/runtime/call-handler.ts`

```typescript
class CallHandler {
  private wireman: Wireman;

  async handle(call: Call, args: any[]): Promise<any> {
    // 1. If wireman can resolve callable, use resolved args
    // 2. Otherwise use provided args
    // 3. Call the callable
  }
}
```

#### Response

**File**: `src/runtime/response.ts`

```typescript
class Response {
  status: number;
  body: any;
  headers: Record<string, string>;

  setStatus(code: number): this
  setBody(body: any): this
  setHeader(key: string, value: string): this
  json(data: any): this
  send(): void
}
```

---

### DI Container

**File**: `src/container.ts`

Three-registry IoC container (mirrors PHP `Exedra\Container\Container`).

```typescript
class Container {
  private services: Map<string, ServiceEntry>;    // singletons
  private factories: Map<string, FactoryEntry>;   // new instance per resolve
  private callables: Map<string, Function>;       // callable registrations

  // Registration
  service(name: string, value: any): void         // register singleton
  factory(name: string, fn: Function): void       // register factory
  func(name: string, fn: Function): void          // register callable

  // Resolution
  resolve(name: string): any                      // resolve from any registry
  make<T>(Class: new () => T): T                  // resolve by class type
  create(Class: Function, args?: any[]): any      // factory resolution

  // DI helpers
  canResolve(typeName: string): boolean
  tokenResolve(name: string): any                 // resolve 'self.X', 'app.X' patterns
}
```

**Registry priority**: service > factory > callable

**Resolution patterns**:
- `string` → look up in registries
- `Function` (class) → instantiate with DI
- `Function` (closure) → call with resolved params

---

### Wireman (DI Resolver)

**File**: `src/support/wireman.ts`

Reads `emitDecoratorMetadata` output to auto-resolve method parameters.

```typescript
class Wireman {
  private container: Container;

  resolveCallable(callable: Function): any[] {
    // 1. Get parameter types from Reflect.getMetadata('design:paramtypes', target, key)
    // 2. For each parameter type:
    //    a. If param name is 'req' → use Express request
    //    b. If param name is 'res' → use Express response
    //    c. If param name is 'next' → provide next function
    //    d. If container canResolve(type) → use container
    //    e. Otherwise → instantiate the class
    // 3. Return resolved args array
  }
}
```

**Special parameter names**:
- `req` / `request` → Express Request object
- `res` / `response` → Express Response object
- `next` → NextFunction

---

### Validation Attribute

**File**: `src/attributes/validation.ts`

Stores validation rules as route state. The framework provides a `createValidationMiddleware()` factory.

```typescript
export function Validation(rules: Record<string, any>): ClassDecorator & MethodDecorator {
  return (target, propertyKey?, descriptor?) => {
    // Stores rules in states metadata: states['exedra:validation'] = rules
  };
}
```

**Validation middleware factory**:

```typescript
export type ValidatorFn = (data: any, rules: Record<string, any>) => Promise<void> | void;

export function createValidationMiddleware(validator: ValidatorFn) {
  return async (context: Context, next: () => Promise<any>) => {
    const rules = context.state('exedra:validation');
    if (rules) {
      await validator(context.req.body, rules);
    }
    return next();
  };
}
```

Usage:

```typescript
import { createValidationMiddleware } from 'exedra-ts';
import { validate } from 'some-validator'; // user provides this

app.use(createValidationMiddleware(validate));
```

---

### Transformer Attribute

**File**: `src/attributes/transformer.ts`

Stores a transformer class/function as route state. The framework provides a `createTransformerMiddleware()` factory.

```typescript
export interface Transformer<T = any, R = any> {
  transform(data: T): R;
}

export type TransformerFn<T = any, R = any> = (data: T) => R;

export function Transformer(transformerClass: Transformer | TransformerFn | (new () => Transformer)): ClassDecorator & MethodDecorator {
  return (target, propertyKey?, descriptor?) => {
    // Stores transformer class in states metadata: states['exedra:transformer'] = transformerClass
  };
}
```

**Transformer middleware factory**:

```typescript
export function createTransformerMiddleware() {
  return async (context: Context, next: () => Promise<any>) => {
    const result = await next();
    const TransformerClass = context.state('exedra:transformer');
    if (TransformerClass && result !== undefined) {
      const transformer = typeof TransformerClass === 'function' && TransformerClass.prototype?.transform
        ? new TransformerClass()
        : TransformerClass;
      return transformer.transform(result);
    }
    return result;
  };
}
```

Usage:

```typescript
import { Transformer, createTransformerMiddleware } from 'exedra-ts';

class UserTransformer implements Transformer {
  transform(user: any) {
    return { id: user.id, name: user.name, email: user.email };
  }
}

app.use(createTransformerMiddleware());

@Get('/users/:id')
@Transformer(UserTransformer)
getUser(@Param('id') id: string) {
  return userRepository.findById(id);
  // Response: { id: 1, name: 'John', email: 'john@example.com' }
}
```

---

## Method Prefix Convention

Inherited from exedra-php. Method names are prefixed to determine their role:

| Prefix | Role | Example | Behavior |
|---|---|---|---|
| `middleware*` | Group middleware | `middlewareAuth()` | Runs as middleware for all routes in the group |
| `decorate*` | Decorator | `decorateTransform()` | Wraps the response for all routes |
| `setup*` | Direct group setup | `setupRoutes(group)` | Receives Group, can register routes manually |
| `execute*` | Named route | `executeIndex()` | Route with name derived from suffix (`index`) |
| `group*` | Deferred subrouting | `groupUsers()` | Returns a controller class (resolved lazily) |
| `get*` | GET route | `getProducts()` | GET method, name from suffix (`products`) |
| `post*` | POST route | `postUser()` | POST method, name from suffix (`user`) |
| `put*` | PUT route | `putUser()` | PUT method |
| `delete*` | DELETE route | `deleteUser()` | DELETE method |
| `patch*` | PATCH route | `patchUser()` | PATCH method |
| `sub*` | Immediate subrouting | `subAdmin(group)` | Inline subrouting, receives Group |
| `route*` | Route customization | `routeFaq(route)` | Receives Route for OO customization |

**Route name derivation**:

```
executeIndex        → 'index'
getProducts         → 'get-products'
postUser            → 'post-user'
groupAdmin          → 'admin'
subDashboard        → 'dashboard'
routeSettings       → 'settings'
```

**RESTful verb-only methods**:

```
get()               → 'get' (just the verb)
post()              → 'post'
```

---

## Attribute Reference

| Attribute | Target | Metadata Key | Repeatable | Description |
|---|---|---|---|---|
| `@Path(path)` | class + method | `path` | No | Sets route path |
| `@Name(name)` | class + method | `name` | No | Sets route name |
| `@Method(verb)` | class + method | `method` | No | Sets HTTP method(s) |
| `@Middleware(Class)` | class + method | `middleware` | Yes | Attaches middleware |
| `@Decorator(Class)` | class + method | `decorator` | Yes | Attaches response decorator |
| `@Requestable(bool)` | class + method | `requestable` | No | Whether route is requestable |
| `@FailRoute` | method | `asFailRoute` | No | Marks as fail route |
| `@Tag(name)` | class + method | `tag` | No | Tags the route |
| `@State(key, val)` | class + method | `states` | Yes | Generic key/value state |
| `@Series(key, val)` | class + method | `serieses` | Yes | Repeatable key/value pairs |
| `@Flag(name)` | class + method | `flags` | Yes | Boolean flags |
| `@Config(key, val)` | class + method | `config` | Yes | Configuration values |
| `@Validation(rules)` | class + method | `states[exedra:validation]` | No | Validation rules |
| `@Transformer(Class)` | class + method | `states[exedra:transformer]` | No | Transformer class |

---

## Public API

**File**: `src/index.ts`

```typescript
// Core
export { Controller } from './controller';
export { createExedra } from './handler';

// HTTP Verb Decorators
export { Get, Post, Put, Delete, Patch, Head, Options } from './decorators';

// Attributes
export {
  Path, Name, Method, Middleware, Decorator,
  Requestable, FailRoute, Tag,
  State, Series, Flag, Config
} from './attributes';

// Validation
export { Validation, createValidationMiddleware, ValidatorFn } from './attributes/validation';

// Transformer
export { Transformer, createTransformerMiddleware, Transformer as TransformerInterface, TransformerFn } from './attributes/transformer';

// Runtime
export { Context } from './runtime/context';

// DI
export { Container } from './container';
```

**createExedra**:

```typescript
function createExedra(app: Express, options: {
  controller: Function;              // Root controller class
  middlewares?: Function[];           // Global middleware classes
  decorators?: Function[];           // Global decorators
}): void
```

---

## Implementation Phases

### Phase 1 — Foundation (~350 lines)

**Files**: `metadata.ts`, `support/kebab-case.ts`, `support/dot-array.ts`, `controller.ts`, `decorators.ts`, all `attributes/*.ts`

- Define Symbol keys and metadata helpers
- Implement kebab-case conversion
- Implement dot-notation get/set
- Implement Controller singleton base
- Implement HTTP verb decorators (@Get, @Post, etc.)
- Implement all 14 attributes

### Phase 2 — Handler + Route Building (~300 lines)

**Files**: `handler.ts`, `routing/factory.ts`, `routing/group.ts`, `routing/route.ts`

- Implement Route class with properties
- Implement Group class wrapping Express Router
- Implement Factory for creating groups/routes
- Implement Handler engine with prefix detection
- Implement property merging for subrouting

### Phase 3 — Runtime Pipeline (~200 lines)

**Files**: `routing/finding.ts`, `routing/call.ts`, `routing/callstack.ts`, `runtime/context.ts`, `runtime/call-handler.ts`, `runtime/response.ts`

- Implement Call and CallStack
- Implement Finding (resolves route into callstack)
- Implement Context (request context with DI scope)
- Implement CallHandler (executes calls with DI)
- Implement Response wrapper

### Phase 4 — DI Container + Wireman (~200 lines)

**Files**: `container.ts`, `support/wireman.ts`

- Implement 3-registry container
- Implement Wireman DI resolver
- Integration with emitDecoratorMetadata

### Phase 5 — Validation + Transformer (~150 lines)

**Files**: `attributes/validation.ts`, `attributes/transformer.ts`

- Implement Validation attribute
- Implement Transformer attribute + interface
- Implement validation middleware factory
- Implement transformer middleware factory

### Phase 6 — Public API (~100 lines)

**File**: `index.ts`

- Barrel exports
- createExedra bootstrap function

### Phase 7 — Tests + Config (~200 lines)

**Files**: `tests/*.test.ts`, `package.json`, `tsconfig.json`

- Unit tests for each module
- Integration test with full app
- Package configuration

**Total estimated**: ~1500 lines

---

## Compiler Configuration

**tsconfig.json**:

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
    "declaration": true,
    "resolveJsonModule": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

**Required flags**:
- `experimentalDecorators: true` — enables legacy decorators (parameter decorators, emitDecoratorMetadata)
- `emitDecoratorMetadata: true` — emits design:type metadata for auto-DI

---

## Package Configuration

**package.json**:

```json
{
  "name": "exedra-ts",
  "version": "0.1.0",
  "description": "Class/annotation-based routing for Express.js",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist"],
  "scripts": {
    "build": "tsc",
    "test": "jest",
    "prepublishOnly": "npm run build"
  },
  "peerDependencies": {
    "express": "^4.0.0 || ^5.0.0"
  },
  "dependencies": {
    "reflect-metadata": "^2.0.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.0",
    "express": "^4.18.0",
    "typescript": "^5.0.0",
    "jest": "^29.0.0",
    "@types/jest": "^29.0.0",
    "ts-jest": "^29.0.0"
  },
  "keywords": ["express", "routing", "decorators", "controllers", "typescript"],
  "license": "MIT"
}
```

---

## Dependency on Express

exedra-ts uses Express as its HTTP layer. It does NOT replace Express routing — it wraps it.

- `Group` wraps `express.Router`
- Routes are registered via `app.get()`, `app.post()`, etc.
- Users can still use raw Express routes alongside exedra controllers
- Express middleware can be used directly via `@Middleware(ExpressMiddleware)`

---

## Design Decisions

1. **Singleton controllers**: Controllers are instantiated once and reused. They're static bags for routing, not request-scoped.

2. **Method prefix convention + decorators**: Both work simultaneously. Method names provide implicit routing; decorators provide explicit route properties.

3. **Legacy decorators required**: TC39 Stage 3 decorators don't support parameter decorators yet. All existing ecosystem uses legacy decorators.

4. **Interface-based transformer**: Zero extra dependencies. Users implement `{ transform(data): any }`.

5. **Pluggable validation**: The framework provides `createValidationMiddleware(validator)` — users bring their own validation library.

6. **Express as peer dependency**: Users install Express themselves, keeping exedra-ts lean.
