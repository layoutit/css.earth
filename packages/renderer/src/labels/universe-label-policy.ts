import { labelRectsOverlap, type LabelScreenRect } from './screen-label-layout.ts';

/** One annotation policy. Catalogue completeness is not scene-label eligibility. */
export const UNIVERSE_LABEL_POLICY = Object.freeze({
  desktopLimit: 24, compactLimit: 12, compactWidth: 700,
  minimumExtentPixels: 12, fullExtentPixels: 48, spacingPixels: 3,
});

export function labelEligible(facts: { named?: boolean; notable?: boolean }): boolean {
  return facts.named === true || facts.notable === true;
}

/** A prepared orientation reference (the Sun, then Earth) outranks every classification tier. */
export function labelImportance(kind: string, major = false, orientationReference = 0): number {
  if (orientationReference > 0) return orientationReference;
  // A planet of another star is a planet of its system: the tier is the body's role in the system it belongs to, not whether
  // that system is the Sun's. Without this an imaged exoplanet loses its caption at the scale that frames its own orbit.
  if (['star', 'black-hole', 'planet', 'exoplanet', 'environment', 'galaxy-cluster'].includes(kind)) return 3;
  if (major || kind === 'dwarf-planet') return 2;
  if (kind === 'asteroid') return 0;
  return 1;
}

/** Actions win over disabled captions, regardless of size, distance or class. */
export function labelInteractionPriority(navigable: boolean): number {
  return navigable ? 100 : 0;
}

/** A spatial neighbourhood must occupy readable pixels, whether its orbit is drawn or not. */
export function labelExtentOpacity(extentPixels: number): number {
  const { minimumExtentPixels: start, fullExtentPixels: end } = UNIVERSE_LABEL_POLICY;
  const t = Math.max(0, Math.min(1, (extentPixels - start) / (end - start)));
  return t * t * (3 - 2 * t);
}

export function labelLimit(width: number): number {
  return width < UNIVERSE_LABEL_POLICY.compactWidth ? UNIVERSE_LABEL_POLICY.compactLimit : UNIVERSE_LABEL_POLICY.desktopLimit;
}

/** The stage's top band under the shell header, in stage-centre coordinates: every label layer treats it as taken. */
export function coveredTopRects(viewport: { readonly heightPixels?: number; readonly coveredTopPixels?: number }): LabelScreenRect[] {
  const height = viewport.heightPixels, covered = viewport.coveredTopPixels;
  if (!(height! > 0 && covered! > 0)) return [];
  return [{ left: -Infinity, right: Infinity, top: -height! / 2 - 1, bottom: -height! / 2 + covered! }];
}

/** All publication layers spend the same slots and reserve the same screen space.
 * The foreground planner admits the active system first; context landmarks and
 * catalogue captions consume the remaining slots, in that order. */
export function createLabelBudget(width: number, height: number, labels: readonly LabelScreenRect[] = [],
  exclusions: readonly LabelScreenRect[] = [], limit = labelLimit(width)) {
  const occupied = [...labels, ...exclusions];
  let count = labels.length;
  return {
    get count() { return count; },
    get remaining() { return Math.max(0, limit - count); },
    accepts(rect: LabelScreenRect, anchor?: LabelScreenRect) {
      return count < limit && rect.left >= -width / 2 && rect.right <= width / 2 &&
        rect.top >= -height / 2 && rect.bottom <= height / 2 &&
        [rect, ...(anchor ? [anchor] : [])].every(part =>
        !occupied.some(other => labelRectsOverlap(part, other, UNIVERSE_LABEL_POLICY.spacingPixels)));
    },
    admit(rect: LabelScreenRect, anchor?: LabelScreenRect) {
      if (!this.accepts(rect, anchor)) return false;
      occupied.push(rect);
      if (anchor) occupied.push(anchor);
      count++; return true;
    },
  };
}
export type LabelBudget = ReturnType<typeof createLabelBudget>;
