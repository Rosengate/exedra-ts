import 'reflect-metadata';
import { Container } from '../container';

const PRIMITIVES = new Set([String, Number, Boolean, Symbol, BigInt]);

export class Wireman {
  private container: Container;

  constructor(container: Container) {
    this.container = container;
  }

  resolveTypes(callable: Function): any[] {
    const types: any[] = Reflect.getMetadata('design:paramtypes', callable) || [];

    return types.map((type: any) => {
      if (!type || PRIMITIVES.has(type)) {
        return undefined;
      }

      if (this.container.canResolve(type)) {
        return this.container.resolve(type);
      }

      return undefined;
    });
  }
}
