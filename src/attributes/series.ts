import { mergeMetadata } from '../metadata';

export function Series(key: string, value: any): ClassDecorator & MethodDecorator {
  return function (target: any, propertyKey?: string | symbol, _descriptor?: PropertyDescriptor) {
    if (propertyKey === undefined) {
      mergeMetadata(target, undefined, { serieses: { [key]: value } });
    } else {
      mergeMetadata(target, String(propertyKey), { serieses: { [key]: value } });
    }
  };
}
