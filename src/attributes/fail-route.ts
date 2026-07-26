import { mergeMetadata } from '../metadata';

export function FailRoute(
  target: any,
  propertyKey?: string | symbol,
  _descriptor?: PropertyDescriptor,
): void {
  if (propertyKey === undefined) {
    mergeMetadata(target, undefined, { asFailRoute: true });
  } else {
    mergeMetadata(target, String(propertyKey), { asFailRoute: true });
  }
}
