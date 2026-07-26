import { Container } from '../container';
import { Group } from './group';
import { Route } from './route';

export class Factory {
  namedParamAutoInject: boolean = false;
  useFlatRouting: boolean = false;
  container?: Container;

  createGroup(routes: any[] = [], parentRoute?: Route): Group {
    const group = new Group(this, parentRoute || null, routes);
    group.namedParamAutoInject = this.namedParamAutoInject;
    group.useFlatRouting = this.useFlatRouting;
    group.container = this.container;
    return group;
  }

  createRoute(group: Group, name: string, properties: Record<string, any>): Route {
    return new Route(group, name, properties);
  }

  resolveGroup(_group: Group, _controllerClass: any): void {
    // Will be populated by handler
  }
}
