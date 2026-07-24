import 'reflect-metadata';
import { Container } from '../container';

const SPECIAL_PARAMS: Record<string, string> = {
  req: 'request',
  request: 'request',
  res: 'response',
  response: 'response',
};

export class Wireman {
  private container: Container;

  constructor(container: Container) {
    this.container = container;
  }

  resolveCallable(callable: Function): any[] {
    const types = Reflect.getMetadata('design:paramtypes', callable) || [];
    const paramNames = this.getParamNames(callable);

    return types.map((type: any, index: number) => {
      const paramName = paramNames[index];

      if (paramName && paramName in SPECIAL_PARAMS) {
        return SPECIAL_PARAMS[paramName];
      }

      if (type && this.container.canResolve(type.name || type)) {
        return this.container.resolve(type.name || type);
      }

      if (type && typeof type === 'function') {
        return this.container.make(type);
      }

      return undefined;
    });
  }

  private getParamNames(fn: Function): string[] {
    const fnStr = fn.toString();
    const match = fnStr.match(/(?:function\s+\w+|(\(.*?\))|(\w+))\s*=>/);

    if (match && match[1]) {
      return match[1].replace(/[()]/g, '').split(',').map(s => s.trim()).filter(Boolean);
    }

    const paramMatch = fnStr.match(/\(([^)]*)\)/);
    if (paramMatch) {
      return paramMatch[1].split(',').map(s => s.trim()).filter(Boolean);
    }

    return [];
  }
}
