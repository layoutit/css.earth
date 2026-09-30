import { labelRectsOverlap, type LabelScreenRect } from './screen-label-layout.ts';

/** One annotation policy. Catalogue completeness is not scene-label eligibility. */
export const UNIVERSE_LABEL_POLICY = Object.freeze({
  desktopLimit: 24, compactLimit: 12, compactWidth: 700,
  minimumExtentPixels: 12, fullExtentPixels: 48, spacingPixels: 3,
});

/** Where the Local Group scale begins: a camera moving out passes 300 kpc, one coming back 240 kpc (a UI threshold, not a
 * physical boundary). Past it the galaxies are the named objects, and a star's name fades over the same band. */
export const LOCAL_GROUP_SCALE = Object.freeze({ returnDistanceM: 240e3 * 3.085677581491367e16, enterDistanceM: 300e3 * 3.085677581491367e16 });

/** One handoff between the planet hosts and the galaxy's published tracers, by the camera's distance from the selected
 * body (so a visited far system keeps its own markers): over 4 to 9 kpc the
 * hosts fade out as the galaxy's dots fade in, so neither shows at full strength beside the other and the view is never
 * empty. A 5 to 7 kpc band passed in one or two wheel steps and read as a switch; two fades in sequence
 * left a black gap between them. UI thresholds, not physical ones; the planet hosts follow where surveys looked, not
 * the galaxy's shape. */
export const GALAXY_SCALE = Object.freeze({ handoffStartM: 4e3 * 3.085677581491367e16, handoffEndM: 9e3 * 3.085677581491367e16 });

export function labelEligible(facts: { named?: boolean; notable?: boolean }): boolean {
  return facts.named === true || facts.notable === true;
}

/** A prepared orientation reference (the Sun, then Earth) outranks every classification tier. */
/** The tier of a featured star; at galaxy scale, bodies below it give way to the galaxy's tracers. */
export const FEATURED_STAR_TIER = 4;

export function labelImportance(kind: string, major = false, orientationReference = 0, featured = false): number {
  if (orientationReference > 0) return orientationReference;
  // A featured star (its catalogue's `featured`) is a landmark of the galaxy: it keeps its marker at galaxy scale.
  if (featured && (kind === 'star' || kind === 'black-hole')) return FEATURED_STAR_TIER;
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
