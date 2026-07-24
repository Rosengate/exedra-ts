import { Call } from '../routing/call';

export class CallHandler {
  async handle(call: Call, args: any[] = []): Promise<any> {
    return call.invoke(...args);
  }
}
