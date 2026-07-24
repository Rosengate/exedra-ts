import { mergeMetadata } from '../metadata';

export function Flag(flag: string): ClassDecorator & MethodDecorator {
  return function (target: any, propertyKey?: string | symbol, _descriptor?: PropertyDescriptor) {
    if (propertyKey === undefined) {
      mergeMetadata(target, undefined, { flags: [flag] });
    } else {
      mergeMetadata(target, String(propertyKey), { flags: [flag] });
    }
  };
}
