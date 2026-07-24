import { mergeMetadata } from '../metadata';

export function Decorator(decorator: string): ClassDecorator & MethodDecorator {
  return function (target: any, propertyKey?: string | symbol, _descriptor?: PropertyDescriptor) {
    if (propertyKey === undefined) {
      mergeMetadata(target, undefined, { decorator: [decorator] });
    } else {
      mergeMetadata(target, String(propertyKey), { decorator: [decorator] });
    }
  };
}
