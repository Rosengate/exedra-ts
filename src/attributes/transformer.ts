import { mergeMetadata } from '../metadata';

export interface Transformer<T = any, R = any> {
  transform(data: T): R;
}

export type TransformerFn<T = any, R = any> = (data: T) => R;

export function Transformer(transformerClass: any): ClassDecorator & MethodDecorator {
  return function (target: any, propertyKey?: string | symbol, _descriptor?: PropertyDescriptor) {
    if (propertyKey === undefined) {
      mergeMetadata(target, undefined, { states: { 'exedra:transformer': transformerClass } });
    } else {
      mergeMetadata(target, String(propertyKey), { states: { 'exedra:transformer': transformerClass } });
    }
  };
}

export function createTransformerMiddleware() {
  return async (req: any, res: any, next: () => Promise<any>) => {
    const result = await next();
    const TransformerClass = req._exedra_states?.['exedra:transformer'];
    if (TransformerClass && result !== undefined) {
      const transformer =
        typeof TransformerClass === 'function' && TransformerClass.prototype?.transform
          ? new TransformerClass()
          : TransformerClass;
      return transformer.transform(result);
    }
    return result;
  };
}
