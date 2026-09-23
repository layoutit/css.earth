import type { PhysicalProjection } from '../prepared-data/physical-projection.js';

export interface PreparedFacingPlane { readonly target: number; readonly plane: readonly [number, number, number, number]; readonly tolerance: number; }

/** Eye in raw prepared scene coordinates; no DOM/style or geometry derivation. */
function sceneObserver(projection: PhysicalProjection) {
  const m = projection.eyeFromScene;
  const a = m[0], b = m[4], c = m[8], d = m[1], e = m[5], f = m[9], g = m[2], h = m[6], i = m[10];
  const determinant = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  if (!Number.isFinite(determinant) || determinant === 0) return null;
  const x = -m[12], y = -m[13], z = -m[14];
  const eye = [(x * (e * i - f * h) + y * (c * h - b * i) + z * (b * f - c * e)) / determinant,
    (x * (f * g - d * i) + y * (a * i - c * g) + z * (c * d - a * f)) / determinant,
    (x * (d * h - e * g) + y * (b * g - a * h) + z * (a * e - b * d)) / determinant] as const;
  return { eye, toleranceScale: projection.focalPixels / (determinant * determinant) };
}

export function sceneEye(projection: PhysicalProjection): readonly [number, number, number] | null { return sceneObserver(projection)?.eye ?? null; }

export function frontFacing(plane: PreparedFacingPlane['plane'], eye: readonly number[], grazingMargin = 0): boolean {
  const a = plane[0] * eye[0], b = plane[1] * eye[1], c = plane[2] * eye[2], d = plane[3];
  // Keep grazing faces. Source CSS remains the authority at the edge, avoiding
  // a disappearing seam due to CSSOM/matrix precision near a zero dot product.
  return a + b + c + d >= -grazingMargin - 1e-6 * (1 + Math.abs(a) + Math.abs(b) + Math.abs(c) + Math.abs(d));
}

export function createPreparedFacing(plans: readonly PreparedFacingPlane[], nodes: readonly HTMLElement[]) {
  const faces = plans.map(plan => ({ ...plan, node: nodes[plan.target], visibility: nodes[plan.target].style.visibility, visible: true }));
  return (projection: PhysicalProjection) => {
    const observer = sceneObserver(projection);
    const eye = observer?.eye ?? null;
    // Preserve a one-CSS-pixel angular rim on each side for raster coverage. A
    // mathematically rear-facing plane can still contribute antialiased edge
    // pixels; Chrome keeps final ownership of those grazing faces at any DPR.
    const grazingMargin = eye ? 2 * Math.hypot(...eye) / projection.focalPixels : 0;
    for (const face of faces) {
      const visible = eye === null || frontFacing(face.plane, eye, Math.max(grazingMargin, face.tolerance * observer!.toleranceScale));
      if (visible === face.visible) continue;
      face.node.style.visibility = visible ? face.visibility : 'hidden';
      face.visible = visible;
    }
  };
}
