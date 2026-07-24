import { mergeMetadata } from '../metadata';

export function Config(key: string, value: any): ClassDecorator & MethodDecorator {
  return function (target: any, propertyKey?: string | symbol, _descriptor?: PropertyDescriptor) {
    if (propertyKey === undefined) {
      mergeMetadata(target, undefined, { config: { [key]: value } });
    } else {
      mergeMetadata(target, String(propertyKey), { config: { [key]: value } });
    }
  };
}
