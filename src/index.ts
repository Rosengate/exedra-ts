import 'reflect-metadata';

/**
 * Base class for controllers. Extend this to create route controllers.
 *
 * Controllers are singletons — the same instance is reused across requests.
 * Use `@Path` to set the base path, and HTTP verb decorators or method prefixes
 * to define routes.
 *
 * @example
 * ```typescript
 * import { Controller, Path, Get } from '@rosengate/exedra-ts';
 *
 * @Path('/users')
 * class UsersController extends Controller {
 *   @Get('')
 *   list() {
 *     return { data: [] };
 *   }
 * }
 * ```
 */
export { Controller } from './controller';

/**
 * Bootstrap function that wires controllers into an Express application.
 *
 * Reflects the root controller class, resolves all subrouting, and registers
 * routes on the Express router.
 *
 * @param app - Express application instance
 * @param options - Configuration including the root controller class
 * @returns The root Group for further manipulation
 *
 * @example
 * ```typescript
 * import express from 'express';
 * import { createExedra } from '@rosengate/exedra-ts';
 *
 * const app = express();
 * createExedra(app, { controller: RootController });
 * app.listen(3000);
 * ```
 */
export { createExedra } from './handler';

/**
 * Core engine that reflects controller classes and builds the route tree.
 * Normally you don't use this directly — use `createExedra` instead.
 */
export { Handler } from './handler';

// ─── HTTP Verb Decorators ───────────────────────────────────────────────────

/** Register a GET route. */
export { Get, Post, Put, Delete, Patch, Head, Options } from './decorators';

// ─── Attribute Decorators ───────────────────────────────────────────────────

/**
 * Set the base path for a controller class or the path for a route method.
 *
 * @example
 * ```typescript
 * @Path('/api/users')
 * class UsersController extends Controller { ... }
 * ```
 */
export { Path } from './attributes';

/**
 * Set a human-readable name for a route (used for URL generation).
 *
 * At class level, replaces the default name derived from the `group*` method name.
 * Access the full dotted name via `route.fullName`, or the local name via `route.name`.
 *
 * Without `@Name`, the `group*` method name provides the default prefix:
 * `groupBlogs()` → baseName is `'blogs'`, routes get `fullName` like `blogs.get-posts`.
 *
 * With `@Name('api')`, it replaces the default: `fullName` becomes `api.get-posts`.
 *
 * @example
 * ```typescript
 * @Name('admin')          // replaces default from groupAdmin()
 * @Path('/users')
 * class UsersController extends Controller {
 *   @Get('')
 *   @Name('list')
 *   listUsers() {}
 *   // route.name → 'list', route.fullName → 'admin.list'
 * }
 * ```
 */
export { Name } from './attributes';

/**
 * Override the HTTP method for a route (used with `execute*` prefix methods).
 */
export { Method } from './attributes';

/**
 * Attach a middleware function to a controller (all routes) or a single route.
 * Accepts a middleware function with `(req, res, next)` signature.
 *
 * @example
 * ```typescript
 * function auth(req: any, res: any, next: any) {
 *   if (!req.headers.authorization) return res.status(401).json({ error: 'Unauthorized' });
 *   next();
 * }
 *
 * @Middleware(auth)
 * @Path('/api')
 * class ApiController extends Controller { ... }
 * ```
 */
export { Middleware } from './attributes';

/**
 * Attach a response decorator class to a controller or route.
 * Note: `decorate*` prefix methods are what actually execute at runtime.
 * This decorator stores metadata for documentation/introspection.
 */
export { Decorator } from './attributes';

/**
 * Control whether a route is findable by `Group.findByRequest()`.
 * Set `@Requestable(false)` to hide a route from manual matching.
 */
export { Requestable } from './attributes';

/**
 * Mark a route as a group-level catch-all for unmatched routes.
 * When no route in the group matches a request, this handler fires.
 * Scoped to its group — parent groups can have their own `@FailRoute`.
 *
 * @example
 * ```typescript
 * @Path('/users')
 * class UsersController extends Controller {
 *   @Get('')
 *   list() { return []; }
 *
 *   @FailRoute
 *   notFound() { return { error: 'users not found' }; }
 * }
 * // GET /users      → list()
 * // GET /users/xyz  → notFound()
 * ```
 */
export { FailRoute } from './attributes';

/**
 * Tag a route with a string identifier for filtering/documentation.
 */
export { Tag } from './attributes';

/**
 * Attach arbitrary key-value state to a route. Accessible via `Context.state()`.
 */
export { State } from './attributes';

/**
 * Attach named arrays to a route. Accessible via `Context.series()`.
 */
export { Series } from './attributes';

/**
 * Attach boolean flags to a route. Accessible via `Context.hasFlag()`.
 */
export { Flag } from './attributes';

/**
 * Attach configuration values to a route.
 */
export { Config } from './attributes';

// ─── Parameter Decorators ───────────────────────────────────────────────────

/**
 * Inject a route parameter from `req.params`.
 *
 * @example
 * ```typescript
 * @Get('/:id')
 * getUser(@Param('id') id: string) { ... }
 * ```
 */
export { Param } from './attributes';

/**
 * Inject a value from `req.body`.
 *
 * @example
 * ```typescript
 * @Post('')
 * create(@Body('name') name: string) { ... }
 * ```
 */
export { Body } from './attributes';

/**
 * Inject a value from `req.query`.
 *
 * @example
 * ```typescript
 * @Get('')
 * list(@Query('limit') limit: number) { ... }
 * ```
 */
export { Query } from './attributes';

/**
 * Inject a value from request headers.
 *
 * @example
 * ```typescript
 * @Get('/auth')
 * auth(@Header('authorization') token: string) { ... }
 * ```
 */
export { Header } from './attributes';

/** Inject the raw Express `req` object. */
export { Req } from './attributes';

/** Inject the raw Express `res` object. */
export { Res } from './attributes';

/** Inject the Express `next` function. */
export { Next } from './attributes';

/** Inject the per-request `Context` instance. */
export { Ctx } from './attributes';

/**
 * Explicitly resolve a value from the IoC container by token.
 *
 * @example
 * ```typescript
 * @Get('')
 * handler(@Inject(Database) db: Database) { ... }
 * ```
 */
export { Inject } from './attributes';

/**
 * Declare an include method on a Transformer class.
 * The include is invoked when `?include=<name>` is in the query string.
 */
export { Include } from './attributes';

// ─── Validation & Transformer ───────────────────────────────────────────────

/**
 * Attach validation rules to a route as route state.
 */
export { Validation, createValidationMiddleware, type ValidatorFn } from './attributes/validation';

/**
 * Attach a transformer class to a route. The transformer's `transform()` method
 * wraps the handler response before sending.
 *
 * @example
 * ```typescript
 * class UserTransformer {
 *   transform(user: any) {
 *     return { id: user.id, name: user.name };
 *   }
 * }
 *
 * @Get('/:id')
 * @Transformer(UserTransformer)
 * getUser(@Param('id') id: string) { ... }
 * ```
 */
export {
  Transformer,
  createTransformerMiddleware,
  type Transformer as TransformerInterface,
  type TransformerFn,
} from './attributes/transformer';

// ─── Runtime ────────────────────────────────────────────────────────────────

/**
 * Per-request context extending the IoC container. Provides access to
 * request/response, route params, state, flags, and service resolution.
 *
 * Created automatically for each request and stored on `req._exedra_context`.
 */
export { Context } from './runtime/context';

/**
 * IoC container with three registries: services (singletons), factories (new instance per call),
 * and callables (named functions).
 *
 * @example
 * ```typescript
 * const container = new Container();
 * container.service('db', new Database());
 * container.factory('logger', () => new Logger());
 *
 * // resolve
 * container.resolve('db');       // returns the Database singleton
 * container.resolve('logger');   // returns a new Logger each time
 * ```
 */
export { Container } from './container';

// ─── Routing Primitives ─────────────────────────────────────────────────────

/** A single route definition with path, method, handler, and metadata. */
export { Route } from './routing/route';

/**
 * A group of routes, wrapping an Express Router.
 * Handles middleware registration, route mounting, and subrouting.
 */
export { Group, type RouteInfo } from './routing/group';

/** A resolved route match with parameters, used for manual route finding. */
export { Finding } from './routing/finding';

/** An ordered pipeline of callable middleware/handler functions. */
export { CallStack } from './routing/callstack';

/** A single callable entry in a CallStack pipeline. */
export { Call } from './routing/call';

/**
 * Factory that creates Groups and Routes. Carries configuration flags
 * like `namedParamAutoInject` and `useFlatRouting`.
 */
export { Factory } from './routing/factory';
