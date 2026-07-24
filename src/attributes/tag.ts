import { mergeMetadata } from '../metadata';

export function Tag(tag: string): ClassDecorator & MethodDecorator {
  return function (target: any, propertyKey?: string | symbol, _descriptor?: PropertyDescriptor) {
    if (propertyKey === undefined) {
      mergeMetadata(target, undefined, { tag });
    } else {
      mergeMetadata(target, String(propertyKey), { tag });
    }
  };
}
