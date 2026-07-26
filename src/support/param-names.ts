export function getParamNames(fn: Function): string[] {
  const match = fn.toString().match(/\(([^)]*)\)/);
  if (!match) return [];
  return match[1]
    .split(',')
    .map((s) => s.trim().split(':')[0].trim())
    .filter(Boolean);
}
