import express from 'express';
import { Route, MiddlewareEntry } from './route';
import { Factory } from './factory';

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
    return this.routes.some(r => r.asFailRoute);
  }

  getFailRoute(): Route | null {
    return this.routes.find(r => r.asFailRoute) || null;
  }

  listRoutes(basePath: string = ''): RouteInfo[] {
    const results: RouteInfo[] = [];

    for (const route of this.routes) {
      if (route.asFailRoute || !route.requestable) continue;

      const childGroup: Group | undefined = route.properties._childGroup;
      const routePath = route.path || '';
      const fullPath = basePath + (routePath ? '/' + routePath.replace(/^\//, '') : '');

      if (childGroup) {
        results.push(...childGroup.listRoutes(fullPath));
      }

      if (route.method) {
        results.push({
          method: route.method,
          path: (fullPath || '/').replace(/\/+$/, '') || '/',
          name: route.name,
          controller: route.controller,
          action: route.action,
          tag: route.tag,
        });
      }
    }

    return results;
  }

  registerOnRouter(router: express.Router): void {
    for (const route of this.routes) {
      if (route.asFailRoute || !route.requestable) continue;

      const childGroup: Group | undefined = route.properties._childGroup;
      const basePath = route.path || '';

      if (childGroup) {
        const childRouter = express.Router();
        childGroup.registerOnRouter(childRouter);
        const mountPath = '/' + basePath.replace(/^\//, '');
        router.use(mountPath, childRouter);
      }

      if (!route.method) continue;

      const verb = route.method.toLowerCase() as keyof express.Router;
      const fullPath = '/' + basePath.replace(/^\//, '');

      if (typeof router[verb] === 'function') {
        (router[verb] as any)(fullPath || '/', ...this.buildHandlers(route));
      }
    }
  }

  private buildHandlers(route: Route): express.RequestHandler[] {
    const handlers: express.RequestHandler[] = [];
    const routeProps = route.fullProperties();

    const mwEntries: any[] = routeProps.middleware || [];
    for (const entry of mwEntries) {
      const fn = typeof entry === 'function' ? entry : entry.fn;
      if (typeof fn !== 'function') continue;
      handlers.push((req, res, next) => {
        const result = fn(req, res, next);
        if (result && typeof result.then === 'function') {
          result.catch(next);
        }
      });
    }

    const exec = routeProps.execute;
    if (typeof exec === 'function') {
      handlers.push((req, res, next) => {
        try {
          const result = exec(req, res, next);
          if (result && typeof result.then === 'function') {
            result.then((value: any) => {
              if (value !== undefined && !res.headersSent) {
                res.json(value);
              }
            }).catch(next);
          } else if (result !== undefined && !res.headersSent) {
            res.json(result);
          }
        } catch (err) {
          next(err);
        }
      });
    }

    return handlers;
  }
}
