import { mergeMetadata } from '../metadata';
import { setParamBinding } from './param';

export function Flag(flag: string): ClassDecorator & MethodDecorator & ParameterDecorator {
  return function (
    target: any,
    propertyKey?: string | symbol | number,
    descriptorOrIndex?: PropertyDescriptor | number,
  ) {
    if (typeof descriptorOrIndex === 'number' && propertyKey !== undefined) {
      setParamBinding(target, propertyKey as string | symbol, descriptorOrIndex, {
        type: 'flag',
        key: flag,
      });
    } else if (propertyKey === undefined) {
      mergeMetadata(target, undefined, { flags: [flag] });
    } else {
      mergeMetadata(target, String(propertyKey), { flags: [flag] });
    }
  };
}
