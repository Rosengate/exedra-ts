import { mergeMetadata } from '../metadata';

function applyFailRoute(target: any, propertyKey?: string | symbol): void {
  if (propertyKey === undefined) {
    throw new Error('@FailRoute can only be applied to a method, not a class. Use @FailRoute on a method to define a catch-all handler for unmatched routes in this group.');
  }
  mergeMetadata(target, String(propertyKey), { asFailRoute: true });
}

export function FailRoute(
  targetOrUndefined?: any,
  propertyKey?: string | symbol,
  _descriptor?: PropertyDescriptor,
): any {
  if (targetOrUndefined === undefined) {
    return applyFailRoute;
  }
  applyFailRoute(targetOrUndefined, propertyKey);
}
