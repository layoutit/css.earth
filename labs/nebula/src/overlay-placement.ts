/** Manual lab transforms of prepared image planes; no source image or geometry changes. */
export interface OverlayPlacement {
  x: number; y: number; z: number;
  rotationX: number; rotationY: number; rotationZ: number;
  scale: number;
}
export const defaultOverlayPlacement = (): OverlayPlacement => ({
  x: 0, y: 0, z: 0, rotationX: 0, rotationY: 0, rotationZ: 0, scale: 1,
});

export function updateOverlayPlacement(current: OverlayPlacement, patch: Partial<OverlayPlacement>): OverlayPlacement {
  const value = { ...current, ...patch };
  if (Object.keys(patch).some(key => !Object.hasOwn(defaultOverlayPlacement(), key)) ||
      Object.values(value).some(item => typeof item !== 'number' || !Number.isFinite(item)) || value.scale <= 0) {
    throw new TypeError('Image placement needs finite positions and angles, and a positive size.');
  }
  return value;
}

/** Translations are in local kpc, angles around the local axes, size is uniform about the baked image centre. */
export function overlayPlacementTransform(base: string, pivotCssPx: readonly number[], value: OverlayPlacement, pixelsPerKpc: number): string {
  const identity = defaultOverlayPlacement();
  if ((Object.keys(identity) as (keyof OverlayPlacement)[]).every(key => value[key] === identity[key])) return base;
  const translate = (point: readonly number[]) => `translate3d(${point.map(n => `${n}px`).join(',')})`;
  return `${translate([value.x * pixelsPerKpc, value.y * pixelsPerKpc, value.z * pixelsPerKpc])} ` +
    `${translate(pivotCssPx)} rotateZ(${value.rotationZ}deg) rotateY(${value.rotationY}deg) rotateX(${value.rotationX}deg) ` +
    `scale3d(${value.scale},${value.scale},${value.scale}) ${translate(pivotCssPx.map(n => -n))} ${base}`;
}
