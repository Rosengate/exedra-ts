import express from 'express';
import 'reflect-metadata';
import { Controller } from './controller';
import { getMetadata, RouteMetadata } from './metadata';
import { kebabCase } from './support/kebab-case';
import { Factory } from './routing/factory';
import { Group } from './routing/group';
import { Route } from './routing/route';

const HTTP_VERBS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];

export interface ExedraOptions {
  controller: new () => Controller;
  middlewares?: Function[];
  decorators?: Function[];
}

class Handler {
  private reflectionCache = new Map<Function, RouteMetadata>();

  resolveGroup(factory: Factory, controllerClass: Function, parentRoute?: Route): Group {
    const controller = (controllerClass as any).instance();
    const group = factory.createGroup([], parentRoute);

    const proto = controllerClass.prototype;
    const methodNames = Object.getOwnPropertyNames(proto);

    for (const methodName of methodNames) {
      if (methodName === 'constructor') continue;

      const methodMeta = getMetadata(controllerClass, methodName);

      if (this.parseMiddlewareMethod(methodName)) {
        const fn = controller[methodName].bind(controller);
        group.addMiddleware(fn);
        continue;
      }

      if (this.parseDecorateMethod(methodName)) {
        const fn = controller[methodName].bind(controller);
        group.addDecorator(fn);
        continue;
      }

      if (this.parseSetupMethod(methodName)) {
        controller[methodName](group);
        continue;
      }

      let routeName: string | null = null;
      let httpMethod: string | null = null;
      let type: string | null = null;

      if ((routeName = this.parseExecuteMethod(methodName))) {
        type = 'execute';
      } else if ((routeName = this.parseGroupMethod(methodName))) {
        type = 'subroutes';
      } else {
        const result = this.parseRestfulMethod(methodName);
        if (result) {
          type = 'execute';
          routeName = result[0];
          httpMethod = result[1];
        } else if ((routeName = this.parseSubMethod(methodName))) {
          type = 'subroutes_call';
        } else if ((routeName = this.parseRouteMethod(methodName))) {
          type = 'route_call';
        } else {
          continue;
        }
      }

      const properties: Record<string, any> = this.buildProperties(methodMeta);

      let childClass: Function | undefined;

      if (type === 'subroutes') {
        childClass = controller[methodName]();
        if (childClass && this.validateGroup(childClass)) {
          const childMeta = getMetadata(childClass);

          if (childMeta.path && properties.path) {
            properties.path = '/' + properties.path.replace(/^\//, '') + '/' + childMeta.path.replace(/^\//, '');
          } else if (childMeta.path) {
            properties.path = childMeta.path;
          }

          properties.subroutes = childClass;
          this.reflectionCache.set(childClass, childMeta);
        }
      }

      if (httpMethod && !properties.method) {
        properties.method = httpMethod;
      }

      if (type === 'execute' && typeof controller[methodName] === 'function') {
        properties.execute = controller[methodName].bind(controller);
      } else if (type === 'subroutes' && childClass) {
        properties.subroutes = childClass;
      }

      if (properties.name) {
        properties.name = String(properties.name);
      }

      const name = properties.name || routeName!;
      const route = factory.createRoute(group, name, properties);
      group.addRoute(route);

      if (type === 'subroutes_call') {
        const subGroup = factory.createGroup([], route);
        controller[methodName](subGroup);
      } else if (type === 'route_call') {
        controller[methodName](route);
      }
    }

    return group;
  }

  private buildProperties(methodMeta: RouteMetadata): Record<string, any> {
    const props: Record<string, any> = {};

    for (const [key, value] of Object.entries(methodMeta)) {
      props[key] = value;
    }

    return props;
  }

  private validateGroup(pattern: any): boolean {
    if (typeof pattern === 'function') {
      return pattern.prototype instanceof Controller || pattern === Controller;
    }
    return false;
  }

  parseMiddlewareMethod(name: string): boolean {
    return name.startsWith('middleware');
  }

  parseDecorateMethod(name: string): boolean {
    return name.startsWith('decorate');
  }

  parseSetupMethod(name: string): boolean {
    return name.toLowerCase().startsWith('setup');
  }

  parseExecuteMethod(name: string): string | null {
    if (!name.startsWith('execute')) return null;
    const suffix = name.slice(7);
    return suffix ? kebabCase(suffix) : 'execute';
  }

  parseGroupMethod(name: string): string | null {
    if (!name.startsWith('group')) return null;
    const suffix = name.slice(5);
    return suffix ? kebabCase(suffix) : 'group';
  }

  parseRestfulMethod(name: string): [string, string] | null {
    for (const verb of HTTP_VERBS) {
      if (name.startsWith(verb)) {
        const suffix = name.slice(verb.length);
        const methodName = kebabCase(suffix);
        const routeName = methodName ? verb + '-' + methodName : verb;
        return [routeName, verb.toUpperCase()];
      }
    }
    return null;
  }

  parseSubMethod(name: string): string | null {
    if (!name.startsWith('sub')) return null;
    const suffix = name.slice(3);
    return suffix ? kebabCase(suffix) : 'sub';
  }

  parseRouteMethod(name: string): string | null {
    if (!name.startsWith('route')) return null;
    const suffix = name.slice(5);
    return suffix ? kebabCase(suffix) : 'route';
  }
}

export function createExedra(app: express.Application, options: ExedraOptions): void {
  const handler = new Handler();
  const factory = new Factory();
  const rootGroup = handler.resolveGroup(factory, options.controller);

  if (options.middlewares) {
    for (const mw of options.middlewares) {
      rootGroup.addMiddleware(mw);
    }
  }

  if (options.decorators) {
    for (const dec of options.decorators) {
      rootGroup.addDecorator(dec);
    }
  }

  const router = express.Router();
  rootGroup.registerOnRouter(router);
  app.use(router);
}

export { Handler };
