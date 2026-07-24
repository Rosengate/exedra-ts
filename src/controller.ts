const REGISTRY_KEY = '__exedra_controller_instances__';

if (!(globalThis as any)[REGISTRY_KEY]) {
  (globalThis as any)[REGISTRY_KEY] = new Map<Function, any>();
}

const instances: Map<Function, any> = (globalThis as any)[REGISTRY_KEY];

export abstract class Controller {
  static instance<T extends Controller>(this: new () => T): T {
    if (!instances.has(this)) {
      instances.set(this, new this());
    }
    return instances.get(this) as T;
  }

  protected constructor() {}
}
