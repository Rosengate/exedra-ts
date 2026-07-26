import { mergeMetadata } from '../metadata';

export function Validation(rules: Record<string, any>): ClassDecorator & MethodDecorator {
  return function (target: any, propertyKey?: string | symbol, _descriptor?: PropertyDescriptor) {
    if (propertyKey === undefined) {
      mergeMetadata(target, undefined, { states: { 'exedra:validation': rules } });
    } else {
      mergeMetadata(target, String(propertyKey), { states: { 'exedra:validation': rules } });
    }
  };
}

export type ValidatorFn = (data: any, rules: Record<string, any>) => Promise<void> | void;

export function createValidationMiddleware(validator: ValidatorFn) {
  return async (req: any, res: any, next: any, ctx?: any) => {
    const rules = ctx?.state('exedra:validation');
    if (rules) {
      await validator(req.body, rules);
    }
    return next();
  };
}
