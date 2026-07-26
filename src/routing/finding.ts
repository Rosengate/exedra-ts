import { Route, MiddlewareEntry } from './route';
import { Call } from './call';
import { CallStack } from './callstack';

export class Finding {
  route: Route;
  parameters: Record<string, string>;

  constructor(route: Route, parameters: Record<string, string> = {}) {
    this.route = route;
    this.parameters = parameters;
  }

  getParameters(): Record<string, string> {
    return this.parameters;
  }

  getCallStack(): CallStack {
    const stack = new CallStack();
    const fullProps = this.route.fullProperties();

    const middlewares: MiddlewareEntry[] = fullProps.middleware || [];
    for (const entry of middlewares) {
      stack.addCall(new Call(entry.fn, entry.properties || {}));
    }

    const decorators: Function[] = fullProps.decorator || [];
    for (const dec of decorators) {
      stack.addCall(new Call(dec));
    }

    const execute = fullProps.execute;
    if (typeof execute === 'function') {
      stack.addCall(
        new Call(execute, {
          dependencies: fullProps.dependencies,
        }),
      );
    }

    return stack;
  }
}
