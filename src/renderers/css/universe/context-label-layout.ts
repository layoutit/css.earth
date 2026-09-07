import { labelRectsOverlap } from '../labels/screen-label-layout.js';
import type { LabelScreenRect } from '../labels/screen-label-layout.js';

export interface ContextLabelCandidate {
  readonly id: string;
  readonly priority: number;
  readonly distanceM: number;
  readonly rect: LabelScreenRect;
}

/** Stable annotation priority; marker visibility and physical photometry are independent. */
export function selectContextLabels(candidates: readonly ContextLabelCandidate[], width: number, height: number): readonly ContextLabelCandidate[] {
  const accepted: ContextLabelCandidate[] = [];
  const ordered = [...candidates].sort((a, b) => a.priority - b.priority || a.distanceM - b.distanceM || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const candidate of ordered) {
    const rect = candidate.rect;
    if (rect.left < -width / 2 || rect.right > width / 2 || rect.top < -height / 2 || rect.bottom > height / 2) continue;
    if (accepted.some(other => labelRectsOverlap(rect, other.rect))) continue;
    accepted.push(candidate);
  }
  return accepted;
}

/** A framed overview may reserve its orbit footprint; close/clipped orbits must not cover the sky. */
export function compactOrbitFootprint(bounds: LabelScreenRect, width: number, height: number): LabelScreenRect | null {
  const spanX = bounds.right - bounds.left, spanY = bounds.bottom - bounds.top;
  if (![bounds.left, bounds.top, bounds.right, bounds.bottom].every(Number.isFinite) || spanX <= 0 || spanY < 0 ||
      bounds.left <= -width / 2 + 3 || bounds.right >= width / 2 - 3 || bounds.top <= -height / 2 + 3 || bounds.bottom >= height / 2 - 3 ||
      spanX > width * .8 || spanY > height * .8 || spanX * spanY > width * height / 2) return null;
  return bounds;
}
