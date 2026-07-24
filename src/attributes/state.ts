import { mergeMetadata } from '../metadata';
import { setParamBinding } from './param';

export function State(key: string, value?: any): ClassDecorator & MethodDecorator & ParameterDecorator {
  return function (target: any, propertyKey?: string | symbol | number, descriptorOrIndex?: PropertyDescriptor | number) {
    if (typeof descriptorOrIndex === 'number' && propertyKey !== undefined) {
      // Parameter decorator: @State('key') — reads from route state at runtime
      setParamBinding(target, propertyKey as string | symbol, descriptorOrIndex, { type: 'state', key });
    } else if (propertyKey === undefined) {
      // Class decorator: @State('key', value)
      mergeMetadata(target, undefined, { states: { [key]: value } });
    } else {
      // Method decorator: @State('key', value)
      mergeMetadata(target, String(propertyKey), { states: { [key]: value } });
    }
  };
}
