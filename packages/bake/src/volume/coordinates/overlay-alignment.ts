/** Offline transfer of one shared sky-to-density alignment to image-centred controls. */
import { updateOverlayPlacement, type OverlayPlacement } from './overlay-placement.ts';

export function transferOverlayAlignment(placement: OverlayPlacement, referencePivot: readonly number[],
  imagePivot: readonly number[], pixelsPerKpc: number): OverlayPlacement {
  const d = referencePivot.map((n, i) => (n - imagePivot[i]!) / pixelsPerKpc);
  const [ax, ay, az] = [placement.rotationX, placement.rotationY, placement.rotationZ].map(n => n * Math.PI / 180);
  const x = d[0]!, y = Math.cos(ax!) * d[1]! - Math.sin(ax!) * d[2]!, z = Math.sin(ax!) * d[1]! + Math.cos(ax!) * d[2]!;
  const xx = Math.cos(ay!) * x + Math.sin(ay!) * z, zz = -Math.sin(ay!) * x + Math.cos(ay!) * z;
  const rotated = [Math.cos(az!) * xx - Math.sin(az!) * y, Math.sin(az!) * xx + Math.cos(az!) * y, zz].map(n => n * placement.scale);
  return updateOverlayPlacement(placement, { x: placement.x + d[0]! - rotated[0]!,
    y: placement.y + d[1]! - rotated[1]!, z: placement.z + d[2]! - rotated[2]! });
}
