import { Call } from './call';

export class CallStack {
  calls: Call[] = [];
  private pointer = 0;

  addCall(call: Call): void {
    this.calls.push(call);
  }

  getNextCallable(): (...args: any[]) => Promise<any> {
    if (this.pointer >= this.calls.length) {
      return async (...args: any[]) => {
        if (args.length > 0) return args[0];
        return undefined;
      };
    }

    const call = this.calls[this.pointer++];

    return async (...args: any[]) => {
      const nextFn = this.getNextCallable();
      return call.invoke(...args, nextFn);
    };
  }

  getNextCaller(): Function {
    if (this.pointer >= this.calls.length) {
      return () => {};
    }
    return this.calls[this.pointer].callable;
  }

  reset(): void {
    this.pointer = 0;
  }

  isEmpty(): boolean {
    return this.calls.length === 0;
  }

  length(): number {
    return this.calls.length;
  }
}
