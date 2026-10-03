import { convexWindowEdges } from '@cssearth/core';
import { readEmissionWindow, type EmissionWindow } from '@cssearth/objects';
export function createEmissionWindowSampler(window?: EmissionWindow): (x: number, y: number) => number {
  if (window === undefined) return () => 1;
  const checked = readEmissionWindow(window), planes = convexWindowEdges(checked.polygonArcsec), feather = checked.featherArcsec;
  return (x, y) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return 0;
    let distance = Infinity;
    for (const edge of planes) {
      const inward = (x - edge.x) * edge.nx + (y - edge.y) * edge.ny;
      if (!(inward > 0)) return 0;
      distance = Math.min(distance, inward);
    }
    if (feather === 0 || distance >= feather) return 1;
    const t = distance / feather;
    return t * t * (3 - 2 * t);
  };
}
