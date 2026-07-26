import { Group } from './group';

export interface MiddlewareEntry {
  fn: Function;
  properties?: Record<string, any>;
}

export class Route {
  name: string;
  group: Group;
  properties: Record<string, any>;

  constructor(group: Group, name: string, properties: Record<string, any> = {}) {
    this.group = group;
    this.name = name;
    this.properties = properties;
  }

  get path(): string {
    return this.properties.path || '';
  }

  set path(value: string) {
    this.properties.path = value;
  }

  get method(): string | undefined {
    return this.properties.method;
  }

  get middleware(): MiddlewareEntry[] {
    return this.properties.middleware || [];
  }

  get decorator(): Function[] {
    return this.properties.decorator || [];
  }

  get states(): Record<string, any> {
    return this.properties.states || {};
  }

  get serieses(): Record<string, any[]> {
    return this.properties.serieses || {};
  }

  get flags(): string[] {
    return this.properties.flags || [];
  }

  get config(): Record<string, any> {
    return this.properties.config || {};
  }

  get requestable(): boolean {
    return this.properties.requestable !== false;
  }

  get asFailRoute(): boolean {
    return this.properties.asFailRoute === true;
  }

  get tag(): string | undefined {
    return this.properties.tag;
  }

  get execute(): string | undefined {
    return this.properties.execute;
  }

  get subroutes(): string | Function | undefined {
    return this.properties.subroutes;
  }

  get controller(): string {
    return this.properties.controller || '';
  }

  get action(): string {
    return this.properties.action || '';
  }

  getPath(): string {
    const parentPath = this.group.getParentPath();
    const routePath = this.path;
    const full = parentPath + (routePath ? '/' + routePath.replace(/^\//, '') : '');
    return full || '/';
  }

  getAbsolutePath(params: Record<string, string> = {}): string {
    let path = this.getPath();
    for (const [key, value] of Object.entries(params)) {
      path = path.replace(`:${key}`, String(value));
    }
    return path;
  }

  fullProperties(): Record<string, any> {
    const parentProps = this.group.getFullRouteProperties();
    const merged: Record<string, any> = { ...parentProps };

    for (const [key, value] of Object.entries(this.properties)) {
      if (key === 'middleware') {
        merged.middleware = [...(parentProps.middleware || []), ...(value || [])];
      } else if (key === 'decorator') {
        merged.decorator = [...(parentProps.decorator || []), ...(value || [])];
      } else if (key === 'flags') {
        merged.flags = [...(parentProps.flags || []), ...(value || [])];
      } else if (key === 'states' || key === 'config' || key === 'serieses') {
        merged[key] = { ...(parentProps[key] || {}), ...value };
      } else {
        merged[key] = value;
      }
    }

    return merged;
  }
}
