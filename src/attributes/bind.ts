import { setParamBinding } from './param';
import { ContainerKey } from '../container';

export function Param(key?: string): ParameterDecorator {
  return (target: any, propertyKey: any, parameterIndex: number) => {
    setParamBinding(target, propertyKey, parameterIndex, { type: 'param', key });
  };
}

export function Body(key?: string): ParameterDecorator {
  return (target: any, propertyKey: any, parameterIndex: number) => {
    setParamBinding(target, propertyKey, parameterIndex, { type: 'body', key });
  };
}

export function Query(key?: string): ParameterDecorator {
  return (target: any, propertyKey: any, parameterIndex: number) => {
    setParamBinding(target, propertyKey, parameterIndex, { type: 'query', key });
  };
}

export function Header(key?: string): ParameterDecorator {
  return (target: any, propertyKey: any, parameterIndex: number) => {
    setParamBinding(target, propertyKey, parameterIndex, { type: 'header', key });
  };
}

export function Req(): ParameterDecorator {
  return (target: any, propertyKey: any, parameterIndex: number) => {
    setParamBinding(target, propertyKey, parameterIndex, { type: 'req' });
  };
}

export function Res(): ParameterDecorator {
  return (target: any, propertyKey: any, parameterIndex: number) => {
    setParamBinding(target, propertyKey, parameterIndex, { type: 'res' });
  };
}

export function Next(): ParameterDecorator {
  return (target: any, propertyKey: any, parameterIndex: number) => {
    setParamBinding(target, propertyKey, parameterIndex, { type: 'next' });
  };
}

export function Ctx(): ParameterDecorator {
  return (target: any, propertyKey: any, parameterIndex: number) => {
    setParamBinding(target, propertyKey, parameterIndex, { type: 'ctx' });
  };
}

export function Inject(token: ContainerKey): ParameterDecorator {
  return (target: any, propertyKey: any, parameterIndex: number) => {
    setParamBinding(target, propertyKey, parameterIndex, { type: 'inject', key: token });
  };
}
