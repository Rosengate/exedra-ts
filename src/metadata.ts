import 'reflect-metadata';

const METADATA = Symbol('exedra:metadata');

export interface RouteMetadata {
  path?: string;
  method?: string;
  name?: string;
  middleware?: (string | Function)[];
  decorator?: string[];
  requestable?: boolean;
  asFailRoute?: boolean;
  tag?: string;
  execute?: string;
  subroutes?: string;
  controller?: string;
  action?: string;
  states?: Record<string, any>;
  serieses?: Record<string, any[]>;
  flags?: string[];
  config?: Record<string, any>;
  [key: string]: any;
}

function resolveTarget(target: any, propertyKey?: string): any {
  if (propertyKey !== undefined && typeof target === 'function' && target.prototype) {
    return target.prototype;
  }
  return target;
}

export function getMetadata(target: any, propertyKey?: string): RouteMetadata {
  const resolved = resolveTarget(target, propertyKey);
  if (propertyKey === undefined) {
    return Reflect.getMetadata(METADATA, resolved) || {};
  }
  return Reflect.getMetadata(METADATA, resolved, propertyKey) || {};
}

export function setMetadata(
  target: any,
  propertyKey: string | undefined,
  metadata: Partial<RouteMetadata>,
): void {
  const resolved = resolveTarget(target, propertyKey);
  const existing = getMetadata(target, propertyKey);
  const merged = { ...existing, ...metadata };

  if (propertyKey === undefined) {
    Reflect.defineMetadata(METADATA, merged, resolved);
  } else {
    Reflect.defineMetadata(METADATA, merged, resolved, propertyKey);
  }
}

export function mergeMetadata(
  target: any,
  propertyKey: string | undefined,
  metadata: Partial<RouteMetadata>,
): void {
  const resolved = resolveTarget(target, propertyKey);
  const existing = getMetadata(target, propertyKey);
  const merged: Record<string, any> = { ...existing };

  for (const [key, value] of Object.entries(metadata)) {
    if (key === 'middleware' || key === 'decorator' || key === 'flags') {
      merged[key] = [...(merged[key] || []), ...(Array.isArray(value) ? value : [value])];
    } else if (key === 'states' || key === 'config') {
      merged[key] = { ...(merged[key] || {}), ...value };
    } else if (key === 'serieses') {
      merged[key] = { ...(merged[key] || {}), ...value };
    } else {
      merged[key] = value;
    }
  }

  if (propertyKey === undefined) {
    Reflect.defineMetadata(METADATA, merged, resolved);
  } else {
    Reflect.defineMetadata(METADATA, merged, resolved, propertyKey);
  }
}

export { METADATA };
