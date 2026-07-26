import { mergeMetadata } from '../metadata';

export function Middleware(middleware: string | Function): ClassDecorator & MethodDecorator {
  return function (target: any, propertyKey?: string | symbol, _descriptor?: PropertyDescriptor) {
    if (propertyKey === undefined) {
      mergeMetadata(target, undefined, { middleware: [middleware] });
    } else {
      mergeMetadata(target, String(propertyKey), { middleware: [middleware] });
    }
  };
}
