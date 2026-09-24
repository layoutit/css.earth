export const CSS_NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/iu;

export function cssMatrix(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = /^matrix3d\(([^)]+)\)$/u.exec(value.trim());
  if (!match) return false;
  const parts = match[1]!.split(',').map(part => part.trim());
  return parts.length === 16 && parts.every(part => CSS_NUMBER.test(part) && Number.isFinite(Number(part)));
}
