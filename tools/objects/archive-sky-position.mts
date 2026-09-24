import { isRecord } from '@cssearth/core';

/** First authored sky position in recipe traversal order. */
export function firstSkyPosition(value: unknown): { raDeg: number; decDeg: number } | undefined {
  if (Array.isArray(value)) { for (const item of value) { const found = firstSkyPosition(item); if (found) return found; } return undefined; }
  if (!isRecord(value)) return undefined;
  if (typeof value.raDeg === 'number' && typeof value.decDeg === 'number') return { raDeg: value.raDeg, decDeg: value.decDeg };
  for (const item of Object.values(value)) { const found = firstSkyPosition(item); if (found) return found; }
  return undefined;
}
