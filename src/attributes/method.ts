import { mergeMetadata } from '../metadata';

export function Method(method: string | string[]): ClassDecorator & MethodDecorator {
  return function (target: any, propertyKey?: string | symbol, _descriptor?: PropertyDescriptor) {
    if (propertyKey === undefined) {
      mergeMetadata(target, undefined, {
        method: Array.isArray(method) ? method.join('|') : method,
      });
    } else {
      mergeMetadata(target, String(propertyKey), {
        method: Array.isArray(method) ? method.join('|') : method,
      });
    }
  };
}
