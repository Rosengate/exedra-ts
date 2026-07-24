export function kebabCase(str: string): string {
  let result = str.replace(/([a-z0-9])(?=[A-Z])/g, '$1-');
  result = result.replace(/([a-zA-Z])(?=\d)/g, '$1-');
  result = result.replace(/_/g, '-');
  return result.toLowerCase();
}
