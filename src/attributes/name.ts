import { mergeMetadata } from '../metadata';

export function Name(name: string): ClassDecorator & MethodDecorator {
  return function (target: any, propertyKey?: string | symbol, _descriptor?: PropertyDescriptor) {
    if (propertyKey === undefined) {
      mergeMetadata(target, undefined, { name });
    } else {
      mergeMetadata(target, String(propertyKey), { name });
    }
  };
}
