import { createRetainedLeafPool, registerRetainedPaintMembership } from '../rendering/retained-leaf-pool.js';
import { formatLineNumber, orbitSegmentTransform } from './orbit-segment-presentation.js';
import type { OrbitSegment } from './types.js';
import type { FadeTarget } from '../stars/opacity-fader.js';

/** Two paint owners for the same planned chords, selectable at mount for focused
 * comparison. `strokes` (the shipped one) retains one SVG polyline per
 * trail opacity level for every orbit inside one shared `<svg>` per world context:
 * one paint chunk, a handful of `points` writes per frame. `bars` retains one CSS
 * unit-line per chord. Neither reconstructs geometry. */
export type OrbitRenderer = 'strokes' | 'bars';
/** Largest deviation of the planned chord bank from the full path, in screen pixels.
 * Under a 1.5 px antialiased stroke half a pixel is invisible, and halves the chords
 * the worker projects, the strings the page parses and the shapes the SVG lays out. */
export const ORBIT_RENDERER_LOD_PIXELS: Readonly<Record<OrbitRenderer, number>> = Object.freeze({ strokes: .5, bars: .1 });
/** What carries an orbit's presentation: its opacity fades, selection cue and visibility. */
export interface OrbitPresentation extends FadeTarget { readonly dataset: DOMStringMap }
export interface PreparedOrbitLines {
  /** Stroke runs are SVG polylines and bars are retained HTML leaves; both carry the
   * style an inspector reads, so neither narrows to a bare Element. */
  readonly elements: readonly (HTMLElement | SVGElement | undefined)[];
  /** The host itself for bars; for strokes an adapter that keeps group opacity out of
   * the compositor by writing it as `stroke-opacity` on every polyline. */
  readonly presentation: OrbitPresentation;
  publish(segments: readonly OrbitSegment[]): void;
  stats(): Record<string, number>;
  destroy(): void;
}
export function mountPreparedOrbitLines(host: HTMLElement, { renderer = 'bars', dashed = false, capacity = 0, id }:
  { renderer?: OrbitRenderer; dashed?: boolean; capacity?: number; id?: string } = {}): PreparedOrbitLines {
  // An orbit-less body's root is never inserted; it has nothing to share.
  return renderer === 'strokes' && host.parentElement ? mountOrbitStrokes(host, dashed, id) : mountOrbitBars(host, capacity);
}

/** Fixed unit-line instances, bound once; each publication writes only the slots
 * whose transform or trail weight changed. A dashed orbit alternates by CSS. */
function mountOrbitBars(host: HTMLElement, capacity: number): PreparedOrbitLines {
  // About half a second of publications. Clipped chord counts oscillate across
  // block boundaries while the camera moves; a dip must not rebuild 64 leaf boxes.
  // A full zoom shows about 1.5% of the prepared capacity; the rest is never built.
  const pool = createRetainedLeafPool(host, capacity, 'context-orbit-block', { sparsePrefix: true, retainCommits: 30, lazy: true });
  const transforms = new Array<string>(capacity);
  const weights = new Float64Array(capacity).fill(NaN);
  let count = 0, transformWrites = 0;
  return {
    elements: pool.elements, presentation: host,
    publish(segments) {
      if (segments.length > capacity) throw new RangeError('Prepared orbit line capacity is exceeded.');
      for (let slot = 0; slot < segments.length; slot++) {
        const style = pool.element(slot).style, value = orbitSegmentTransform(segments[slot]);
        if (transforms[slot] !== value) { style.transform = value; transforms[slot] = value; transformWrites++; }
        const weight = segments[slot][4];
        if (weights[slot] !== weight) { style.opacity = String(weight); weights[slot] = weight; }
        pool.setVisible(slot, true);
      }
      for (let slot = segments.length; slot < count; slot++) pool.setVisible(slot, false);
      pool.commitVisibility(); count = segments.length;
    },
    stats: () => ({ ...pool.stats(), transformWrites, capacity }),
    destroy() { for (const block of new Set(pool.elements.map(leaf => leaf?.parentNode))) (block as Element | undefined)?.remove(); },
  };
}

const SVG = 'http://www.w3.org/2000/svg';
/** Trail alpha is quantized onto this many retained strokes; a closed orbit uses one. */
export const ORBIT_OPACITY_LEVELS = 16;
/** One `<svg>` per world context, at the stage centre with visible overflow: chord
 * coordinates are already centred screen pixels. A zero viewport would disable
 * SVG rendering, so it is 1×1. */
const sharedSvgs = new WeakMap<Element, SVGSVGElement>();
function sharedSvg(host: HTMLElement): SVGSVGElement {
  const root = host.parentElement!.closest('.prepared-world-context') ?? host.parentElement!;
  let svg = sharedSvgs.get(root);
  if (!svg || !svg.isConnected) {
    svg = host.ownerDocument.createElementNS(SVG, 'svg');
    svg.setAttribute('class', 'context-orbit-strokes'); svg.setAttribute('width', '1'); svg.setAttribute('height', '1'); svg.setAttribute('aria-hidden', 'true');
    // Composited once: every orbit paints into this one layer instead of earning its own by overlap.
    svg.style.cssText = 'position:absolute;left:50%;top:50%;overflow:visible;pointer-events:none;will-change:transform';
    root.appendChild(svg); sharedSvgs.set(root, svg);
  }
  return svg;
}
/** One orbit's strokes: a group in the shared svg with one polyline per contiguous
 * run of chords per opacity level. `points` is not a CSS property, so a write
 * invalidates layout and paint only, never style. Only a run whose points changed
 * is written. The group carries the orbit id, so the published swatch rules colour
 * it like its marker, and an approximate placement dashes it by stylesheet. */
function mountOrbitStrokes(host: HTMLElement, dashed: boolean, id?: string): PreparedOrbitLines {
  const document = host.ownerDocument, group = document.createElementNS(SVG, 'g');
  if (id) group.dataset.contextOrbit = id;
  if (dashed) group.dataset.contextPlacement = 'approximate';
  group.style.display = 'none';
  sharedSvg(host).appendChild(group);
  const elements: SVGPolylineElement[] = [];
  // Each run keeps its last coordinates as numbers, never as the string it wrote:
  // a retained string per run per frame would outlive a young-generation scavenge
  // and promote roughly a megabyte a second into old space, whose collection is
  // the 20 ms pause a spin eventually hits. Strings here die within the frame.
  const levels = Array.from({ length: ORBIT_OPACITY_LEVELS + 1 }, () => ({ runs: [] as SVGPolylineElement[], written: [] as (Float64Array | null)[] }));
  const membership = { visible: 0, size: 0 };
  registerRetainedPaintMembership(group, membership);
  let pointWrites = 0, shown = false, groupOpacity = 1, writtenOpacity = '';
  // Group opacity would be an effect node, and an effect over overlapping runs cannot
  // be rasterized into the shared layer, so the compositor would give every fading
  // orbit its own layer. Stroke opacity is a paint property: the group's alpha times
  // the level's alpha, written per polyline whenever either changes.
  const strokeOpacity = (element: SVGPolylineElement, level: number) => { element.style.strokeOpacity = formatLineNumber(groupOpacity * level / ORBIT_OPACITY_LEVELS); };
  const polyline = (level: number, run: number) => {
    const pool = levels[level]!;
    let element = pool.runs[run];
    if (!element) {
      element = document.createElementNS(SVG, 'polyline');
      strokeOpacity(element, level);
      group.appendChild(element); pool.runs[run] = element; elements.push(element); membership.size++;
    }
    return element;
  };
  const presentation: OrbitPresentation = { dataset: group.dataset, style: {
    get opacity() { return writtenOpacity; },
    set opacity(value: string) {
      const next = value === '' ? 1 : Number.parseFloat(value);
      writtenOpacity = value;
      if (!Number.isFinite(next) || next === groupOpacity) return;
      groupOpacity = next;
      for (let level = 1; level <= ORBIT_OPACITY_LEVELS; level++) for (const element of levels[level]!.runs) strokeOpacity(element, level);
    },
    get visibility() { return group.style.visibility; },
    set visibility(value: string) { group.style.visibility = value; },
  } };
  // A tenth of a pixel is below the stroke's own antialiasing; shorter strings parse faster.
  const px = (value: number) => Math.round(value * 10) / 10;
  // Runs per level as flat coordinate lists, reused across frames.
  const runsByLevel = Array.from({ length: ORBIT_OPACITY_LEVELS + 1 }, () => [] as number[][]);
  const spare: number[][] = [];
  const sameRun = (written: Float64Array | null, run: number[]) => {
    if (!written || written.length !== run.length) return false;
    for (let i = 0; i < run.length; i++) if (written[i] !== run[i]) return false;
    return true;
  };
  return {
    elements, presentation,
    publish(segments) {
      for (const runs of runsByLevel) { for (const run of runs) { run.length = 0; spare.push(run); } runs.length = 0; }
      let lastX = NaN, lastY = NaN, lastLevel = -1, current: number[] | null = null;
      for (let index = 0; index < segments.length; index++) {
        const [x0, y0, x1, y1, weight] = segments[index];
        if (!(weight > 0)) continue;
        const level = Math.min(ORBIT_OPACITY_LEVELS, Math.ceil(weight * ORBIT_OPACITY_LEVELS));
        if (current && level === lastLevel && x0 === lastX && y0 === lastY) current.push(px(x1), px(y1));
        else {
          current = spare.pop() ?? [];
          current.push(px(x0), px(y0), px(x1), px(y1));
          runsByLevel[level]!.push(current);
        }
        lastX = x1; lastY = y1; lastLevel = level;
      }
      let visible = 0;
      for (let level = 1; level <= ORBIT_OPACITY_LEVELS; level++) {
        const runs = runsByLevel[level]!, pool = levels[level]!;
        visible += runs.length;
        for (let run = 0; run < runs.length; run++) {
          const points = runs[run]!;
          if (sameRun(pool.written[run] ?? null, points)) continue;
          const kept = pool.written[run];
          pool.written[run] = kept && kept.length === points.length ? kept : new Float64Array(points.length);
          pool.written[run]!.set(points); pointWrites++;
          let text = '';
          for (let i = 0; i < points.length; i += 2) text += (i ? ' ' : '') + points[i] + ',' + points[i + 1];
          polyline(level, run).setAttribute('points', text);
        }
        for (let run = runs.length; run < pool.written.length; run++) {
          if (!pool.written[run]) continue;
          pool.written[run] = null; pointWrites++;
          pool.runs[run]!.removeAttribute('points');
        }
      }
      membership.visible = visible;
      if (shown !== visible > 0) { shown = visible > 0; group.style.display = shown ? '' : 'none'; }
    },
    stats: () => ({ pointWrites, visibleRuns: membership.visible, builtRuns: membership.size }),
    destroy() { group.remove(); },
  };
}
