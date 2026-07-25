import 'reflect-metadata';

const INCLUDES_KEY = Symbol('exedra:includes');

export function Include(key: string): MethodDecorator {
  return function (target: any, propertyKey: string | symbol, _descriptor: PropertyDescriptor) {
    const existing: Array<{ key: string; methodKey: string }> =
      Reflect.getMetadata(INCLUDES_KEY, target) || [];
    existing.push({ key, methodKey: String(propertyKey) });
    Reflect.defineMetadata(INCLUDES_KEY, existing, target);
  };
}

export function getIncludeBindings(target: any): Map<string, string> {
  const entries: Array<{ key: string; methodKey: string }> =
    Reflect.getMetadata(INCLUDES_KEY, target) || [];
  return new Map(entries.map((e) => [e.key, e.methodKey]));
}
