import type { PreparedCssVolume, PreparedVolumeLeaf } from '@cssearth/objects';

/** A rotation around the prepared vertical centre line; it never follows camera elevation. */
export function cylindricalSideTransform(leaf: PreparedVolumeLeaf, azimuth: number): string {
  const m = leaf.style.transform.slice(9, -1).split(',').map(Number);
  const [x, y] = [leaf.centerUnits[1] * 50, leaf.centerUnits[0] * 50];
  const c = Math.cos(azimuth), s = Math.sin(azimuth);
  for (const offset of [0, 4, 8, 12]) {
    const a = m[offset]! - (offset === 12 ? x : 0), b = m[offset + 1]! - (offset === 12 ? y : 0);
    m[offset] = c * a + s * b + (offset === 12 ? x : 0);
    m[offset + 1] = -s * a + c * b + (offset === 12 ? y : 0);
  }
  return `matrix3d(${m.join(',')})`;
}

/** The two views around `azimuth` and their mix. With `held`, the pair starting at that view stays: inside it the mix
 * follows the azimuth, past it the mix keeps the end the camera left it by. `offset` is the camera's position from the
 * held view in views, unwrapped from `heldOffset` (the last publication's) through the shorter way round, so a frame
 * that skips past a boundary still knows which one it crossed. */
export function cylindricalSideSelection(side: NonNullable<PreparedCssVolume['farPlanes']>['side'], azimuth: number, elevation: number,
  held: number | null = null, heldOffset: number | null = null) {
  const rawPhase = ((azimuth / (2 * Math.PI) % 1 + 1) % 1) * side.views;
  const phase = Math.abs(rawPhase - Math.round(rawPhase)) < 1e-10 ? Math.round(rawPhase) % side.views : rawPhase;
  let first = Math.floor(phase) % side.views, mix = phase - Math.floor(phase), offset = mix;
  if (held !== null) {
    const wrapped = ((phase - held) % side.views + side.views) % side.views;
    const previous = heldOffset ?? wrapped;
    let step = wrapped - ((previous % side.views) + side.views) % side.views;
    if (step > side.views / 2) step -= side.views; else if (step < -side.views / 2) step += side.views;
    offset = previous + step;
    first = held; mix = wrapped <= 1 ? wrapped : offset > 1 ? 1 : 0;
  }
  const indices = [first, (first + 1) % side.views];
  const coefficients = indices.map(index => {
    const samples = side.coefficients[index]!;
    const degrees = Math.min(90, Math.abs(elevation) * 180 / Math.PI);
    for (let i = 1; i < samples.length; i++) {
      const a = samples[i - 1]!, b = samples[i]!;
      if (degrees <= b[0]) {
        const t = (degrees - a[0]) / (b[0] - a[0]);
        return [a[1] + t * (b[1] - a[1]), a[2] + t * (b[2] - a[2])] as const;
      }
    }
    return [samples.at(-1)![1], samples.at(-1)![2]] as const;
  });
  return { indices, mix, coefficients, offset };
}
