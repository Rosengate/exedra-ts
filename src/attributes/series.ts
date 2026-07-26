import { mergeMetadata } from '../metadata';
import { setParamBinding } from './param';

export function Series(
  key: string,
  value?: any,
): ClassDecorator & MethodDecorator & ParameterDecorator {
  return function (
    target: any,
    propertyKey?: string | symbol | number,
    descriptorOrIndex?: PropertyDescriptor | number,
  ) {
    if (typeof descriptorOrIndex === 'number' && propertyKey !== undefined) {
      setParamBinding(target, propertyKey as string | symbol, descriptorOrIndex, {
        type: 'series',
        key,
      });
    } else if (propertyKey === undefined) {
      mergeMetadata(target, undefined, { serieses: { [key]: value } });
    } else {
      mergeMetadata(target, String(propertyKey), { serieses: { [key]: value } });
    }
  };
}
