export type ServiceFactory = () => any;

export class Container {
  private services = new Map<string, any>();
  private factories = new Map<string, ServiceFactory>();
  private callables = new Map<string, Function>();

  service(name: string, value: any): this {
    this.services.set(name, value);
    return this;
  }

  factory(name: string, fn: ServiceFactory): this {
    this.factories.set(name, fn);
    return this;
  }

  func(name: string, fn: Function): this {
    this.callables.set(name, fn);
    return this;
  }

  resolve(name: string): any {
    if (this.services.has(name)) return this.services.get(name);
    const factory = this.factories.get(name);
    if (factory) return factory();
    return this.callables.get(name);
  }

  make<T>(Class: new (...args: any[]) => T): T {
    return new Class();
  }

  create(Class: Function, args: any[] = []): any {
    return new (Class as any)(...args);
  }

  canResolve(name: string): boolean {
    return this.services.has(name) || this.factories.has(name) || this.callables.has(name);
  }

  tokenResolve(name: string): any {
    if (name.startsWith('self.')) {
      return this.resolve(name.slice(5));
    }
    if (name.startsWith('app.')) {
      return this.resolve(name.slice(4));
    }
    return this.resolve(name);
  }
}
