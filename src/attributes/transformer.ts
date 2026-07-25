import { mergeMetadata } from '../metadata';
import { getIncludeBindings } from './include';

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

export function createTransformerMiddleware(transformerClass: any) {
  return async (req: any, res: any, next: any) => {
    const result = (req as any)._exedra_result;
    if (result === undefined || res.headersSent) {
      next();
      return;
    }

    const transformer =
      typeof transformerClass === 'function' && transformerClass.prototype?.transform
        ? new transformerClass()
        : transformerClass;

    const transformed = transformer.transform(result);

    const includes = (req.query?.include as string)?.split(',').map((s: string) => s.trim()).filter(Boolean) ?? [];
    if (includes.length > 0) {
      const bindings = getIncludeBindings(transformer);
      for (const key of includes) {
        const methodKey = bindings.get(key);
        if (methodKey && typeof transformer[methodKey] === 'function') {
          transformed[key] = transformer[methodKey](result);
        }
      }
    }

    res.json(transformed);
  };
}
