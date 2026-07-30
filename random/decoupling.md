# Decoupling exedra-ts from Express — Hono Support via Adapter Pattern

RFC / implementation plan.

## TL;DR

exedra-ts is tightly coupled to Express through `handler.ts`, `group.ts`, `context.ts`, `transformer.ts`, and `validation.ts`. The goal is to introduce a `RouterAdapter` interface that abstracts framework-specific operations, allowing Hono (and potentially other frameworks) to be used as the routing layer. The Express adapter wraps existing behavior — zero breaking changes for current users.

---

## Express Coupling Map

### Files with Express dependency

| File             | What it does                                                                                                                                              | Depth  |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `handler.ts`     | `createExedra(app: express.Application)`, creates `express.Router()`, mounts via `app.use()`                                                              | Heavy  |
| `group.ts`       | `registerOnRouter(router: express.Router)`, `buildHandlers()` returns `express.RequestHandler[]`, `express.Router({ mergeParams: true })` for sub-routers | Heavy  |
| `context.ts`     | Stores `req: express.Request`, `res: express.Response`, calls `res.json()`, `res.redirect()`, `res.send()`, `res.status()`                                | Heavy  |
| `transformer.ts` | Reads `req.query?.include`, calls `res.json(transformed)`, checks `res.headersSent`                                                                       | Medium |
| `validation.ts`  | Reads `req.method`, `req.params`, `req.query`, `req.body`, `req._exedra_context`                                                                          | Medium |

### Files with ZERO Express coupling (unchanged)

- `controller.ts` — singleton registry
- `metadata.ts` — Reflect metadata helpers
- `decorators.ts` — verb decorator factories
- `container.ts` — IoC container
- `routing/route.ts` — route properties (data structure)
- `routing/factory.ts` — factory (creates groups/routes)
- `routing/call.ts`, `routing/callstack.ts` — pipeline primitives
- `routing/finding.ts` — resolved route match
- `support/*` — kebab-case, param-names, wireman, dot-array
- Most `attributes/*` — metadata-only decorators (param, bind, path, name, method, tag, state, series, flag, config, include, fail-route, requestable, decorator)

---

## The Core Problem

Express and Hono have fundamentally different handler and middleware signatures:

```
Express handler:   (req, res, next) => { req.params.id; res.json(data); next(); }
Hono handler:      (c) => { c.req.param('id'); return c.json(data); }

Express middleware: (req, res, next) => { /* before */ next(); /* after */ }
Hono middleware:    async (c, next) => { /* before */ await next(); /* after */ }

Express response:  res.json(data)          — imperative, called on res object
Hono response:     return c.json(data)     — declarative, returned from handler
```

And request access:

```
Express:  req.params, req.query, req.body, req.headers, req.get(key), req.method, req.path
Hono:     c.req.param(key), c.req.query(key), c.req.json(), c.req.header(key), c.req.method
```

---

## Proposed Architecture

### New files

```
src/adapters/
  types.ts              ← Interfaces: RouterAdapter, RequestAdapter, ResponseAdapter
  express.ts            ← Express implementation (wraps existing behavior)
  hono.ts               ← Hono implementation
```

### Modified files

| File                        | Change                                                                 |
| --------------------------- | ---------------------------------------------------------------------- |
| `handler.ts`                | `createExedra()` accepts optional `adapter` param, defaults to Express |
| `group.ts`                  | Uses adapter for route registration and handler wrapping               |
| `context.ts`                | Stores adapter + raw req/res, delegates response methods to adapter    |
| `attributes/transformer.ts` | Uses request/response adapter instead of direct Express calls          |
| `attributes/validation.ts`  | Uses request adapter instead of direct Express calls                   |
| `index.ts`                  | Exports adapter types + `createHono()` convenience                     |

---

## Adapter Interfaces

### `src/adapters/types.ts`

```typescript
export interface RequestAdapter {
  getParam(req: any, key: string): string | undefined;
  getParams(req: any): Record<string, string>;
  getQuery(req: any): Record<string, any>;
  getQueryValue(req: any, key: string): string | undefined;
  getBody(req: any): any;
  getHeader(req: any, key: string): string | undefined;
  getHeaders(req: any): Record<string, string>;
  getMethod(req: any): string;
  getPath(req: any): string;
  getRaw(req: any): any;
}

export interface ResponseAdapter {
  json(res: any, data: any): void;
  send(res: any, body: any): void;
  redirect(res: any, url: string): void;
  setStatus(res: any, code: number): void;
  headersSent(res: any): boolean;
  getRaw(res: any): any;
}

export interface RouterAdapter {
  name: string;
  createRouter(): any;
  registerRoute(router: any, method: string, path: string, handler: Function): void;
  mountRouter(router: any, path: string, childRouter: any): void;
  useMiddleware(router: any, handler: Function): void;
  getRequestAdapter(): RequestAdapter;
  getResponseAdapter(): ResponseAdapter;
}
```

---

## Express Adapter

### `src/adapters/express.ts`

Thin shim over existing Express behavior:

```typescript
import express from 'express';

export function expressAdapter(): RouterAdapter {
  return {
    name: 'express',
    createRouter: () => express.Router(),
    registerRoute: (router, method, path, handler) => {
      const verb = method.toLowerCase();
      (router as any)[verb](path, handler);
    },
    mountRouter: (router, path, childRouter) => {
      router.use(path, childRouter);
    },
    useMiddleware: (router, handler) => {
      router.use(handler);
    },
    getRequestAdapter: () => ({
      getParam: (req, key) => req.params?.[key],
      getParams: (req) => req.params || {},
      getQuery: (req) => req.query || {},
      getQueryValue: (req, key) => req.query?.[key],
      getBody: (req) => req.body,
      getHeader: (req, key) => req.get(key),
      getHeaders: (req) => req.headers || {},
      getMethod: (req) => req.method,
      getPath: (req) => req.path,
      getRaw: (req) => req,
    }),
    getResponseAdapter: () => ({
      json: (res, data) => res.json(data),
      send: (res, body) => res.send(body),
      redirect: (res, url) => res.redirect(url),
      setStatus: (res, code) => res.status(code),
      headersSent: (res) => !!res.headersSent,
      getRaw: (res) => res,
    }),
  };
}
```

---

## Hono Adapter

### `src/adapters/hono.ts`

The tricky parts:

1. **`getBody`** — Hono's `c.req.json()` returns a Promise. Cache on first access.
2. **`getParams`** — Hono doesn't expose all params at once. Need to cache during route matching.
3. **`headersSent`** — Hono doesn't have this concept. Return `false` and handle double-send differently.
4. **Middleware** — Hono uses `async (c, next)` with `await next()`. The `runMiddlewareChain` already handles promises, so this should work.
5. **Response** — Hono handlers return values. The adapter's `json()` calls `c.json(data)` which returns a Response. The handler wrapper needs to `return` it instead of calling it imperatively.

```typescript
import { Hono } from 'hono';

export function honoAdapter(): RouterAdapter {
  const reqAdapter: RequestAdapter = {
    getParam: (c, key) => c.req.param(key),
    getParams: (c) => {
      // Hono doesn't expose all params — need caching strategy
      // Option A: Parse URL pattern from route definition
      // Option B: Store params during route registration
      return c._exedra_params || {};
    },
    getQuery: (c) => {
      const url = new URL(c.req.url);
      return Object.fromEntries(url.searchParams);
    },
    getQueryValue: (c, key) => {
      return new URL(c.req.url).searchParams.get(key) ?? undefined;
    },
    getBody: (c) => {
      // Cache parsed body
      if (c._exedra_body === undefined) {
        c._exedra_body = c.req.json(); // Promise
      }
      return c._exedra_body;
    },
    getHeader: (c, key) => c.req.header(key),
    getHeaders: (c) => {
      const headers: Record<string, string> = {};
      c.req.raw.headers.forEach((value, key) => {
        headers[key] = value;
      });
      return headers;
    },
    getMethod: (c) => c.req.method,
    getPath: (c) => new URL(c.req.url).pathname,
    getRaw: (c) => c,
  };

  const resAdapter: ResponseAdapter = {
    json: (c, data) => c.json(data),
    send: (c, body) => new Response(body),
    redirect: (c, url) => c.redirect(url),
    setStatus: (c, code) => c.status(code),
    headersSent: () => false, // Hono doesn't track this
    getRaw: (c) => c,
  };

  return {
    name: 'hono',
    createRouter: () => new Hono(),
    registerRoute: (router, method, path, handler) => {
      const verb = method.toLowerCase() as 'get' | 'post' | 'put' | 'delete' | 'patch';
      (router as any)[verb](path, handler);
    },
    mountRouter: (router, path, childRouter) => {
      router.route(path, childRouter);
    },
    useMiddleware: (router, handler) => {
      router.use('*', handler);
    },
    getRequestAdapter: () => reqAdapter,
    getResponseAdapter: () => resAdapter,
  };
}
```

### Known Hono Limitations

1. **Param extraction** — Hono's `c.req.param(key)` requires knowing the key. Getting ALL params at once isn't directly supported. The adapter may need to parse the route pattern and match against the URL.

2. **`headersSent`** — Hono doesn't track this. The "don't double-send" guard in `buildHandlers` (`if (!res.headersSent)`) won't work. Need an alternative: track send state manually on the context.

3. **Body parsing** — `c.req.json()` is async. All body access must be awaited. The adapter caches the Promise, but callers need to handle async.

4. **Sub-router param merging** — Hono's `router.route(path, childRouter)` doesn't merge parent params into child like Express's `mergeParams: true`. This is handled by exedra's flat routing mode, which works around this.

---

## Refactoring `group.ts`

### Current flow

```
buildHandlers(route) → express.RequestHandler[] → runMiddlewareChain → res.json(result)
```

### New flow

```
buildHandlers(route) → Function[] → runMiddlewareChain → adapter.response.json(res, result)
```

### Key changes in `buildHandlers()`

1. **Context creation** — pass adapter to Context constructor:

```typescript
handlers.push((req: any, _res: any, next: any) => {
  req._exedra_context = new Context(
    req,
    _res,
    {},
    routeProps.states || {},
    routeProps.flags || [],
    routeProps.serieses || {},
    undefined,
    this.container,
    this.adapter, // NEW
  );
  next();
});
```

2. **Parameter injection** — use request adapter instead of direct `req.params`:

```typescript
// Current:
args.push(binding.key ? (req.params as any)?.[binding.key] : req.params);

// New:
const reqAdapter = this.adapter.getRequestAdapter();
args.push(binding.key ? reqAdapter.getParam(req, binding.key) : reqAdapter.getParams(req));
```

3. **Response sending** — use response adapter:

```typescript
// Current:
responseSender = async (req: any, res: any, _next: any) => {
  const result = (req as any)._exedra_result;
  if (result !== undefined && !res.headersSent) {
    res.json(result);
  }
};

// New:
responseSender = async (req: any, res: any, _next: any) => {
  const result = (req as any)._exedra_result;
  if (result !== undefined) {
    this.adapter.getResponseAdapter().json(res, result);
  }
};
```

4. **Handler wrapper** — the final returned handler adapts to the framework:

```typescript
// Express: returns (req, res, next) => { ... }
// Hono: returns (c) => { ... } with await next()
```

The adapter's `registerRoute` method handles this translation. For Hono, the handler wrapper would be:

```typescript
// Hono handler wrapper (inside honoAdapter.registerRoute):
router[verb](path, async (c, next) => {
  // Hono calls the exedra handler chain with the Context as the request object
  // The chain expects (req, res, next) — for Hono, req = c, res = c, next = next
  return new Promise((resolve) => {
    const handler = exedraHandlers[0]; // the wrapped chain
    handler(c, c, () => {
      // After chain completes, the result is on c._exedra_result
      resolve(c._exedra_result);
    });
  });
});
```

---

## Refactoring `context.ts`

### Current

```typescript
class Context extends Container {
  req: express.Request;
  res: express.Response;

  redirect(url: string) {
    this.res.redirect(url);
  }
  json(data: any) {
    this.res.json(data);
  }
  send(body?: any) {
    this.res.send(body);
  }
  status(code: number) {
    this.res.status(code);
    return this;
  }
}
```

### New

```typescript
class Context extends Container {
  req: any; // raw framework request (Express Request or Hono Context)
  res: any; // raw framework response
  private adapter?: RouterAdapter;

  constructor(
    req: any,
    res: any /* ... */,
    adapter?: RouterAdapter, // NEW
  ) {
    // ...
    this.adapter = adapter;
  }

  redirect(url: string) {
    this.adapter?.getResponseAdapter().redirect(this.res, url) ?? this.res.redirect(url); // Express fallback
  }
  json(data: any) {
    this.adapter?.getResponseAdapter().json(this.res, data) ?? this.res.json(data);
  }
  send(body?: any) {
    this.adapter?.getResponseAdapter().send(this.res, body) ?? this.res.send(body);
  }
  status(code: number) {
    this.adapter?.getResponseAdapter().setStatus(this.res, code) ?? this.res.status(code);
    return this;
  }
}
```

`@Req()` and `@Res()` still return raw `req`/`res` — Express users get Express Request/Response, Hono users get Hono Context. Intentional escape hatch.

---

## Refactoring `handler.ts`

### Current signature

```typescript
export function createExedra(app: express.Application, options: ExedraOptions): Group;
```

### New signature

```typescript
export interface ExedraOptions {
  controller: Function;
  middlewares?: Function[];
  decorators?: Function[];
  namedParamAutoInject?: boolean;
  useFlatRouting?: boolean;
  container?: Container;
  adapter?: RouterAdapter; // NEW — defaults to expressAdapter()
}

export function createExedra(app: any, options: ExedraOptions): Group;
```

### Internal changes

```typescript
// Current:
const router = express.Router();
rootGroup.registerOnRouter(router);
app.use(router);

// New:
const adapter = options.adapter || expressAdapter();
const router = adapter.createRouter();
rootGroup.registerOnRouter(router);
adapter.mountRouter(app, '/', router);
```

### Convenience function

```typescript
export function createHono(app: any, options: ExedraOptions): Group {
  return createExedra(app, { ...options, adapter: honoAdapter() });
}
```

---

## Refactoring Attribute Middleware

### `transformer.ts`

```typescript
// Current:
export function createTransformerMiddleware(transformerClass: any) {
  return async (req: any, res: any, next: any) => {
    const result = req._exedra_result;
    const includes = (req.query?.include as string)?.split(',') ?? [];
    // ...
    res.json(transformed);
  };
}

// New:
export function createTransformerMiddleware(transformerClass: any, adapter?: RouterAdapter) {
  const reqAdapter = adapter?.getRequestAdapter();
  const resAdapter = adapter?.getResponseAdapter();
  return async (req: any, res: any, next: any) => {
    const result = req._exedra_result;
    const query = reqAdapter ? reqAdapter.getQuery(req) : req.query || {};
    const includes = ((query.include as string) ?? '').split(',').filter(Boolean);
    // ...
    if (resAdapter) {
      resAdapter.json(res, transformed);
    } else {
      res.json(transformed); // Express fallback
    }
  };
}
```

### `validation.ts`

```typescript
// Current:
export function createValidationMiddleware(validator: ValidatorFn) {
  return async (req: any, res: any, next: any, ctx?: any) => {
    const rules =
      ctx?.state?.('exedra:validation') ?? req._exedra_context?.state?.('exedra:validation');
    if (rules) {
      const method = (req.method || '').toUpperCase();
      let data: any = { ...req.params, ...req.query };
      if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
        data = { ...data, ...req.body };
      }
      await validator(data, rules);
    }
    return next();
  };
}

// New:
export function createValidationMiddleware(validator: ValidatorFn, adapter?: RouterAdapter) {
  const reqAdapter = adapter?.getRequestAdapter();
  return async (req: any, res: any, next: any, ctx?: any) => {
    const rules =
      ctx?.state?.('exedra:validation') ?? req._exedra_context?.state?.('exedra:validation');
    if (rules) {
      const method = reqAdapter ? reqAdapter.getMethod(req) : (req.method || '').toUpperCase();
      const params = reqAdapter ? reqAdapter.getParams(req) : req.params || {};
      const query = reqAdapter ? reqAdapter.getQuery(req) : req.query || {};
      let data: any = { ...params, ...query };
      if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
        const body = reqAdapter ? await reqAdapter.getBody(req) : req.body;
        data = { ...data, ...body };
      }
      await validator(data, rules);
    }
    return next();
  };
}
```

---

## Implementation Order

| Step | What                                               | Breaking?          | Verification                |
| ---- | -------------------------------------------------- | ------------------ | --------------------------- |
| 1    | Create `src/adapters/types.ts`                     | No                 | —                           |
| 2    | Create `src/adapters/express.ts`                   | No                 | New unit test               |
| 3    | Add `adapter` option to `ExedraOptions`            | No                 | All 286 existing tests pass |
| 4    | Refactor `group.ts` to use adapter internally      | Internal           | All 286 existing tests pass |
| 5    | Refactor `context.ts` to accept adapter            | Internal           | All 286 existing tests pass |
| 6    | Refactor `handler.ts` — `createExedra()` signature | Minor (`app: any`) | All 286 existing tests pass |
| 7    | Refactor `transformer.ts` and `validation.ts`      | Internal           | All 286 existing tests pass |
| 8    | Create `src/adapters/hono.ts`                      | No                 | New Hono test suite         |
| 9    | Add `createHono()` convenience function            | No                 | —                           |
| 10   | Update `index.ts` exports                          | No                 | —                           |

---

## Risks

1. **Hono param extraction** — Hono doesn't expose all params at once. Need a strategy to cache or parse them. May require storing the route pattern during registration and matching against the URL.

2. **Hono async body** — `c.req.json()` is async. All body access must be awaited. The adapter caches the Promise, but this changes the timing compared to Express's synchronous `req.body`.

3. **Hono `headersSent`** — Not available. The "don't double-send" guard needs an alternative (manual tracking).

4. **Hono sub-router params** — Hono's `router.route()` doesn't merge parent params. The flat routing mode (`useFlatRouting: true`) already handles this by registering all routes on one router.

5. **Middleware signature** — Express `(req, res, next)` vs Hono `async (c, next)`. The `runMiddlewareChain` already handles promises, but the entry point wrapper needs to translate between the two styles.

6. **`@Req()` / `@Res()` escape hatch** — Users who access `ctx.req.params` directly will get Hono's request object instead of Express's. This is intentional but needs documentation.

---

## What Stays the Same

- `controller.ts`, `metadata.ts`, `decorators.ts`, `container.ts` — zero changes
- `routing/route.ts`, `routing/factory.ts`, `routing/call.ts`, `routing/callstack.ts`, `routing/finding.ts` — zero changes
- `support/*` — zero changes
- Most `attributes/*` — zero changes (metadata-only)
- All existing tests pass without modification
- `createExedra(app, { controller })` continues to work exactly as before

---

## Estimated Effort

| Phase     | What                                                       | Hours                      |
| --------- | ---------------------------------------------------------- | -------------------------- |
| 1-3       | Adapter interfaces + Express adapter + option plumbing     | 4-6                        |
| 4-7       | Internal refactoring (group, context, handler, attributes) | 4-6                        |
| 8-9       | Hono adapter + convenience function                        | 4-6                        |
| 10        | Exports, docs, examples                                    | 2-3                        |
| **Total** |                                                            | **14-21 hours (2-3 days)** |

---

## References

- [decoupling-for-agentic.md](decoupling-for-agentic.md) — broader decoupling for graph/agentic use cases
- [Hono docs](https://hono.dev/docs/) — framework API reference
- [Express vs Hono comparison](https://hono.dev/docs/getting-started/basic) — migration guide
