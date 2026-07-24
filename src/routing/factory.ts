import { Group } from './group';
import { Route } from './route';

export class Factory {
  createGroup(routes: any[] = [], parentRoute?: Route): Group {
    return new Group(this, parentRoute || null, routes);
  }

  createRoute(group: Group, name: string, properties: Record<string, any>): Route {
    return new Route(group, name, properties);
  }

  resolveGroup(group: Group, controllerClass: any): void {
    // Will be populated by handler
  }
}
