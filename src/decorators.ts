import { mergeMetadata } from './metadata';

function createVerbDecorator(verb: string) {
  return function (path?: string): MethodDecorator & ClassDecorator {
    return function (target: any, propertyKey?: string | symbol, _descriptor?: PropertyDescriptor): void {
      const update: Record<string, any> = { method: verb };
      if (path !== undefined) update.path = path;
      if (propertyKey !== undefined) {
        mergeMetadata(target, String(propertyKey), update);
      } else {
        mergeMetadata(target, undefined, update);
      }
    } as any;
  };
}

export const Get = createVerbDecorator('GET');
export const Post = createVerbDecorator('POST');
export const Put = createVerbDecorator('PUT');
export const Delete = createVerbDecorator('DELETE');
export const Patch = createVerbDecorator('PATCH');
export const Head = createVerbDecorator('HEAD');
export const Options = createVerbDecorator('OPTIONS');
