import { mergeMetadata } from '../metadata';

export function Path(path: string): ClassDecorator & MethodDecorator {
  return function (target: any, propertyKey?: string | symbol, _descriptor?: PropertyDescriptor) {
    if (propertyKey === undefined) {
      mergeMetadata(target, undefined, { path });
    } else {
      mergeMetadata(target, String(propertyKey), { path });
    }
  };
}
