import 'reflect-metadata';

export const PARAM_BINDINGS = Symbol('exedra:param-bindings');

export interface ParamBinding {
  type: 'param' | 'body' | 'query' | 'header' | 'req' | 'res' | 'next';
  key?: string;
}

export function setParamBinding(
  target: any,
  propertyKey: string | symbol,
  parameterIndex: number,
  binding: ParamBinding,
): void {
  const existing: Record<number, ParamBinding> =
    Reflect.getMetadata(PARAM_BINDINGS, target, propertyKey) || {};
  existing[parameterIndex] = binding;
  Reflect.defineMetadata(PARAM_BINDINGS, existing, target, propertyKey);
}

export function getParamBindings(target: any, propertyKey: string | symbol): Record<number, ParamBinding> {
  return Reflect.getMetadata(PARAM_BINDINGS, target, propertyKey) || {};
}
