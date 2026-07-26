import express from 'express';
import { Route, MiddlewareEntry } from './route';
import { Factory } from './factory';
import { Container } from '../container';
import { Context } from '../runtime/context';
import { getParamBindings, ParamBinding } from '../attributes/param';
import { createTransformerMiddleware } from '../attributes/transformer';
import { Wireman } from '../support/wireman';

export interface RouteInfo {
  method: string;
  path: string;
  name: string;
  controller: string;
  action: string;
  tag?: string;
}

export class Group {
  factory: Factory;
  parent: Group | null;
  private parentRoute: any;
  routes: Route[] = [];
  middlewares: MiddlewareEntry[] = [];
  decorators: Function[] = [];
  private controllerClass: string | null = null;
  namedParamAutoInject: boolean = false;
  useFlatRouting: boolean = false;
  container?: Container;
  basePath: string = '';
  baseName: string = '';

  constructor(factory: Factory, parentRoute: any = null, _routes: any[] = []) {
    this.factory = factory;
    this.parentRoute = parentRoute;
    this.parent = parentRoute?.group || null;
  }

  setController(controllerClass: string): void {
    this.controllerClass = controllerClass;
  }

  getController(): string | null {
    return this.controllerClass;
  }

  addRoute(route: Route): void {
    this.routes.push(route);
  }

  addMiddleware(fn: Function, properties?: Record<string, any>): void {
    this.middlewares.push({ fn, properties });
  }

  addDecorator(fn: Function): void {
    this.decorators.push(fn);
  }

  addRoutes(routes: Record<string, any>): void {
    for (const [name, params] of Object.entries(routes)) {
      this.addRoute(new Route(this, name, params));
    }
  }

  get(path: string, handler: Function): this {
    this.addRoute(new Route(this, 'get', { path, method: 'GET', execute: handler }));
    return this;
  }

  post(path: string, handler: Function): this {
    this.addRoute(new Route(this, 'post', { path, method: 'POST', execute: handler }));
    return this;
  }

  put(path: string, handler: Function): this {
    this.addRoute(new Route(this, 'put', { path, method: 'PUT', execute: handler }));
    return this;
  }

  delete(path: string, handler: Function): this {
    this.addRoute(new Route(this, 'delete', { path, method: 'DELETE', execute: handler }));
    return this;
  }

  getParentPath(): string {
    if (this.parentRoute) {
      const parentPath = this.parentRoute.getPath ? this.parentRoute.getPath() : '';
      return parentPath;
    }
    return '';
  }

  getFullRouteProperties(): Record<string, any> {
    const props: Record<string, any> = {};
    const parentChain = this.getParentChain();

    for (const group of parentChain) {
      for (const [key, value] of Object.entries(group.collectProperties())) {
        if (key === 'middleware') {
          props.middleware = [...(props.middleware || []), ...value];
        } else if (key === 'decorator') {
          props.decorator = [...(props.decorator || []), ...value];
        } else if (key === 'flags') {
          props.flags = [...(props.flags || []), ...value];
        } else if (key === 'states' || key === 'config' || key === 'serieses') {
          props[key] = { ...(props[key] || {}), ...value };
        } else if (!props[key]) {
          props[key] = value;
        }
      }
    }

    return props;
  }

  private collectProperties(): Record<string, any> {
    const props: Record<string, any> = {};
    if (this.middlewares.length > 0) {
      props.middleware = this.middlewares;
    }
    if (this.decorators.length > 0) {
      props.decorator = this.decorators;
    }
    return props;
  }

  private getParentChain(): Group[] {
    const chain: Group[] = [this];
    let current = this.parent;
    while (current) {
      chain.unshift(current);
      current = current.parent;
    }
    return chain;
  }

  findByRequest(request: express.Request): { route: Route; params: Record<string, string> } | null {
    for (const route of this.routes) {
      if (!route.requestable) continue;

      const match = this.matchRoute(route, request);
      if (match) {
        return { route, params: match };
      }
    }
    return null;
  }

  private matchRoute(route: Route, request: express.Request): Record<string, string> | null {
    const routePath = route.getPath();
    const reqPath = request.path;

    if (route.method && route.method !== request.method) return null;

    const routeSegments = routePath.split('/').filter(Boolean);
    const reqSegments = reqPath.split('/').filter(Boolean);

    if (routeSegments.length !== reqSegments.length) return null;

    const params: Record<string, string> = {};
    for (let i = 0; i < routeSegments.length; i++) {
      if (routeSegments[i].startsWith(':')) {
        params[routeSegments[i].slice(1)] = reqSegments[i];
      } else if (routeSegments[i] !== reqSegments[i]) {
        return null;
      }
    }

    return params;
  }

  findRoute(name: string): Route | null {
    for (const route of this.routes) {
      if (route.name === name) return route;
    }
    for (const route of this.routes) {
      if (route.subroutes) {
        const sub = this.findRouteInSubroutes(route, name);
        if (sub) return sub;
      }
    }
    return null;
  }

  private findRouteInSubroutes(route: Route, name: string): Route | null {
    if (typeof route.subroutes === 'string') {
      try {
        const SubController = require(route.subroutes);
        if (SubController?.default) {
          const subGroup = this.factory.createGroup([], route);
          this.factory.resolveGroup(subGroup, SubController.default);
          return subGroup.findRoute(name);
        }
      } catch {
        return null;
      }
    }
    return null;
  }

  hasFailRoute(): boolean {
    return this.routes.some((r) => r.asFailRoute);
  }

  getFailRoute(): Route | null {
    return this.routes.find((r) => r.asFailRoute) || null;
  }

  listRoutes(basePath: string = ''): RouteInfo[] {
    const results: RouteInfo[] = [];
    const groupPrefix = this.basePath && !this.parent ? this.basePath : '';
    const effectiveBase = groupPrefix + basePath;

    for (const route of this.routes) {
      if (route.asFailRoute || !route.requestable) continue;

      const childGroup: Group | undefined = route.properties._childGroup;
      const routePath = route.path || '';
      const fullPath = effectiveBase + (routePath ? '/' + routePath.replace(/^\//, '') : '');

      if (childGroup) {
        results.push(...childGroup.listRoutes(fullPath));
      }

      if (route.method) {
        results.push({
          method: route.method,
          path: (fullPath || '/').replace(/\/+$/, '') || '/',
          name: route.fullName,
          controller: route.controller,
          action: route.action,
          tag: route.tag,
        });
      }
    }

    return results;
  }

  registerOnRouter(router: express.Router): void {
    if (this.useFlatRouting) {
      const prefix = this.basePath && !this.parent ? this.basePath : '';
      this._registerRoutesFlat(router, prefix);
    } else {
      if (this.basePath && !this.parent) {
        const subRouter = express.Router();
        this._registerRoutesExpress(subRouter);
        router.use(this.basePath, subRouter);
      } else {
        this._registerRoutesExpress(router);
      }
    }
  }

  private _registerRoutesFlat(router: express.Router, prefix: string): void {
    for (const route of this.routes) {
      if (route.asFailRoute || !route.requestable) continue;

      const childGroup: Group | undefined = route.properties._childGroup;
      const routePath = route.path || '';
      const fullPath = prefix + '/' + routePath.replace(/^\//, '');

      if (childGroup) {
        childGroup._registerRoutesFlat(router, fullPath);
        continue;
      }

      if (!route.method) continue;

      const verb = route.method.toLowerCase() as keyof express.Router;

      if (typeof router[verb] === 'function') {
        (router[verb] as any)(fullPath || '/', ...this.buildHandlers(route));
      }
    }

    if (this.hasFailRoute()) {
      const failRoute = this.getFailRoute()!;
      router.use(prefix || '/', ...this.buildHandlers(failRoute));
    }
  }

  private _registerRoutesExpress(router: express.Router): void {
    for (const route of this.routes) {
      if (route.asFailRoute || !route.requestable) continue;

      const childGroup: Group | undefined = route.properties._childGroup;
      const routePath = route.path || '';

      if (childGroup) {
        const childRouter = express.Router({ mergeParams: true });
        childGroup._registerRoutesExpress(childRouter);
        router.use('/' + routePath.replace(/^\//, ''), childRouter);
        continue;
      }

      if (!route.method) continue;

      const verb = route.method.toLowerCase() as keyof express.Router;
      const fullPath = '/' + routePath.replace(/^\//, '');

      if (typeof router[verb] === 'function') {
        (router[verb] as any)(fullPath || '/', ...this.buildHandlers(route));
      }
    }

    if (this.hasFailRoute()) {
      const failRoute = this.getFailRoute()!;
      router.use(...this.buildHandlers(failRoute));
    }
  }

  private buildHandlers(route: Route): express.RequestHandler[] {
    const handlers: express.RequestHandler[] = [];
    const routeProps = route.fullProperties();

    // Create per-request Context (before middleware runs)
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
      );
      next();
    });

    const mwEntries: any[] = routeProps.middleware || [];
    for (const entry of mwEntries) {
      const fn = typeof entry === 'function' ? entry : entry.fn;
      if (typeof fn !== 'function') continue;
      handlers.push((req, res, next) => {
        const ctx = (req as any)._exedra_context;
        const result = fn(req, res, next, ctx);
        if (result && typeof result.then === 'function') {
          result.catch(next);
        }
      });
    }

    const exec = routeProps.execute;
    if (typeof exec === 'function') {
      const controllerClass = routeProps.controllerClass;
      const action = routeProps.action;
      const useAutoInject = this.namedParamAutoInject;

      handlers.push(async (req: any, _res: any, next: any) => {
        try {
          let args: any[] = [];
          const paramNames: string[] = routeProps.paramNames || [];
          const ctx: Context | undefined = req._exedra_context;

          if (controllerClass && action) {
            const proto = controllerClass.prototype;
            const bindings = getParamBindings(proto, action);
            const hasDecorators = Object.keys(bindings).length > 0;

            if (hasDecorators) {
              args = resolveFromDecorators(bindings, req, _res, next, routeProps, ctx);
            }

            if (useAutoInject) {
              const namedArgs = resolveFromParamNames(paramNames, req, _res, next, ctx);
              for (let i = 0; i < Math.max(args.length, namedArgs.length); i++) {
                if ((i >= args.length || args[i] === undefined) && namedArgs[i] !== undefined) {
                  args[i] = namedArgs[i];
                }
              }
            }

            // Type-based DI fills remaining undefined/empty slots
            const wiremanContainer = ctx || this.container;
            if (wiremanContainer) {
              const typeArgs = new Wireman(wiremanContainer).resolveTypes(exec);
              for (let i = 0; i < Math.max(args.length, typeArgs.length); i++) {
                if ((i >= args.length || args[i] === undefined) && typeArgs[i] !== undefined) {
                  args[i] = typeArgs[i];
                }
              }
            }

            // Express fallback: fill remaining undefined slots
            if (args.length === 0) {
              args = [req, _res, next];
            } else {
              const expressArgs = [req, _res, next];
              let expressIdx = 0;
              for (let i = 0; i < args.length; i++) {
                if (args[i] === undefined) {
                  args[i] = expressArgs[expressIdx++];
                }
              }
            }
          } else {
            args = [req, _res, next];
          }

          const result = await exec(...args);
          (req as any)._exedra_result = result;
          next();
        } catch (err) {
          next(err);
        }
      });

      const transformerClass = routeProps.states?.['exedra:transformer'];
      if (transformerClass) {
        handlers.push(createTransformerMiddleware(transformerClass));
      } else {
        handlers.push(async (req: any, res: any, _next: any) => {
          const result = (req as any)._exedra_result;
          if (result !== undefined && !res.headersSent) {
            res.json(result);
          }
        });
      }
    }

    return handlers;
  }
}

function resolveFromDecorators(
  bindings: Record<number, ParamBinding>,
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
  routeProps: Record<string, any>,
  ctx?: Context,
): any[] {
  const maxIndex = Math.max(...Object.keys(bindings).map(Number));
  const args: any[] = [];
  const states = routeProps.states || {};
  const flags = routeProps.flags || [];
  const serieses = routeProps.serieses || {};

  for (let i = 0; i <= maxIndex; i++) {
    const binding = bindings[i];
    if (!binding) {
      args.push(undefined);
      continue;
    }

    switch (binding.type) {
      case 'param':
        args.push(binding.key ? (req.params as any)?.[binding.key] : req.params);
        break;
      case 'body':
        args.push(binding.key ? (req.body as any)?.[binding.key] : req.body);
        break;
      case 'query':
        args.push(binding.key ? (req.query as any)?.[binding.key] : req.query);
        break;
      case 'header':
        args.push(binding.key ? req.get(binding.key) : req.headers);
        break;
      case 'state':
        args.push(binding.key ? states[binding.key] : states);
        break;
      case 'flag':
        args.push(binding.key ? flags.includes(binding.key) : flags);
        break;
      case 'series':
        args.push(binding.key ? serieses[binding.key] || [] : serieses);
        break;
      case 'req':
        args.push(req);
        break;
      case 'res':
        args.push(res);
        break;
      case 'next':
        args.push(next);
        break;
      case 'ctx':
        args.push(ctx);
        break;
      case 'inject': {
        args.push(ctx?.resolve(binding.key));
        break;
      }
      default:
        args.push(undefined);
    }
  }

  return args;
}

function resolveFromParamNames(
  paramNames: string[],
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
  ctx?: Context,
): any[] {
  const routeParams = (req.params || {}) as Record<string, string>;
  const queryParams = (req.query || {}) as Record<string, string>;

  return paramNames.map((name) => {
    if (name in routeParams) return routeParams[name];
    if (name in queryParams) return queryParams[name];
    if (name === 'req' || name === 'request') return req;
    if (name === 'res' || name === 'response') return res;
    if (name === 'next') return next;
    if (name === 'ctx' || name === 'context') return ctx;
    if (name === 'body') return req.body;
    if (name === 'query') return req.query;
    return undefined;
  });
}
