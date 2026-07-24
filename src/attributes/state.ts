import { mergeMetadata } from '../metadata';

export function State(key: string, value: any): ClassDecorator & MethodDecorator {
  return function (target: any, propertyKey?: string | symbol, _descriptor?: PropertyDescriptor) {
    const metaKey = propertyKey === undefined ? undefined : String(propertyKey);
    const existing: any = propertyKey === undefined
      ? {}
      : {};
    if (propertyKey === undefined) {
      mergeMetadata(target, undefined, { states: { [key]: value } });
    } else {
      mergeMetadata(target, String(propertyKey), { states: { [key]: value } });
    }
  };
}
