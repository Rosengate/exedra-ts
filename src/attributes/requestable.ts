import { mergeMetadata } from '../metadata';

export function Requestable(requestable: boolean = true): ClassDecorator & MethodDecorator {
  return function (target: any, propertyKey?: string | symbol, _descriptor?: PropertyDescriptor) {
    if (propertyKey === undefined) {
      mergeMetadata(target, undefined, { requestable });
    } else {
      mergeMetadata(target, String(propertyKey), { requestable });
    }
  };
}
