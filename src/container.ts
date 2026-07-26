export type ServiceFactory = () => any;
export type ContainerKey = string | Function;

export class Container {
  protected services = new Map<ContainerKey, any>();
  protected factories = new Map<ContainerKey, ServiceFactory>();
  protected callables = new Map<string, Function>();

  service(name: ContainerKey, value: any): this {
    this.services.set(name, value);
    return this;
  }

  factory(name: ContainerKey, fn: ServiceFactory): this {
    this.factories.set(name, fn);
    return this;
  }

  func(name: string, fn: Function): this {
    this.callables.set(name, fn);
    return this;
  }

  resolve(name: ContainerKey): any {
    if (this.services.has(name)) return this.services.get(name);
    const factory = this.factories.get(name);
    if (factory) return factory();
    return this.callables.get(name as string);
  }

  make<T>(Class: new (...args: any[]) => T): T {
    return new Class();
  }

  create(Class: Function, args: any[] = []): any {
    return new (Class as any)(...args);
  }

  canResolve(name: ContainerKey): boolean {
    return (
      this.services.has(name) ||
      this.factories.has(name) ||
      (typeof name === 'string' && this.callables.has(name))
    );
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
