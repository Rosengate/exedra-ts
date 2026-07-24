export abstract class Controller {
  private static instances = new Map<Function, any>();

  static instance<T extends Controller>(this: new () => T): T {
    if (!Controller.instances.has(this)) {
      Controller.instances.set(this, new this());
    }
    return Controller.instances.get(this) as T;
  }

  protected constructor() {}
}
