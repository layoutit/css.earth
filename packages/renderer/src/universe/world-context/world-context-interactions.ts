import { screenPicking, type ScreenPickTarget } from '../../navigation/screen-picking.js';
import { bindObjectNavigationTarget } from '../../solar-system/heliocentric-navigation.js';
import type { OrbitSegment } from '../../solar-system/types.js';
import type { LabelScreenRect } from '../../labels/screen-label-layout.js';
import type { PlannedWorldContext } from './world-context-planner.js';

type ProjectedBody = PlannedWorldContext['projectedBodies'][number];
type CircleTarget = ScreenPickTarget & { shape: { kind: 'circle'; x: number; y: number; radius: number } };
type OrbitTarget = ScreenPickTarget & { shape: { kind: 'segments'; segments: readonly OrbitSegment[]; bounds: LabelScreenRect | null; halfWidth: number } };
type LabelTarget = ScreenPickTarget & { shape: { kind: 'rect'; left: number; top: number; right: number; bottom: number } };
type MutableRect = { left: number; top: number; right: number; bottom: number };

interface MarkerState {
  readonly markerShown: boolean | undefined;
  readonly markerDiameter: number;
  readonly indicatorRadius: number;
  readonly indicatorHidden: boolean;
  readonly indicatorShown: boolean;
}

/** One body's retained pointer shapes and keyboard targets. Paint owns the visible state these shapes describe. */
export function createWorldContextBodyInteraction(marker: HTMLElement, orbitRoot: HTMLElement, host: HTMLElement,
  body: { readonly id: string; readonly name: string }, hasOrbit: boolean) {
  const navigation = bindObjectNavigationTarget(marker, host, { pointerTarget: false });
  const orbitNavigation = hasOrbit ? bindObjectNavigationTarget(orbitRoot, host, { pointerTarget: false }) : null;
  let markerPick: ScreenPickTarget | null = null, indicatorPick: ScreenPickTarget | null = null;
  let orbitPick: ScreenPickTarget | null = null, labelPick: ScreenPickTarget | null = null;
  let markerTarget: CircleTarget | null = null, indicatorTarget: CircleTarget | null = null;
  let orbitTarget: OrbitTarget | null = null, labelTarget: LabelTarget | null = null;
  let labelRectTarget: MutableRect | null = null, labelRect: LabelScreenRect | null = null;
  let orbitNavigable = false;
  return {
    get labelRect() { return labelRect; },
    updateMarker(projected: ProjectedBody, rank: number, state: MarkerState, navigationSuppressed: boolean) {
      const { x, y, markerOpacity } = projected;
      markerPick = null;
      if (!navigationSuppressed && state.markerShown && markerOpacity > .1) {
        const radius = state.indicatorHidden
          ? Math.max(state.markerDiameter / 2, state.indicatorRadius + 5) : state.markerDiameter / 2;
        const target = markerTarget ??= { element: marker, rank, shape: { kind: 'circle', x, y, radius } };
        target.rank = rank; target.shape.x = x; target.shape.y = y; target.shape.radius = radius;
        markerPick = target;
      }
      if (!navigationSuppressed && state.indicatorShown && markerOpacity > .1) {
        const target = indicatorTarget ??= { element: marker, rank: rank + 2, shape: { kind: 'circle', x, y, radius: state.indicatorRadius + 5 } };
        target.rank = rank + 2; target.shape.x = x; target.shape.y = y; target.shape.radius = state.indicatorRadius + 5;
        indicatorPick = target;
      } else indicatorPick = null;
    },
    updateOrbit(projected: ProjectedBody, rank: number, navigationSuppressed: boolean, orbitHidden: boolean,
      navigationInFlight: boolean, rotating: boolean, coast: boolean) {
      const { orbitVisibility, segments, lineWidth } = projected;
      const navigable = !navigationSuppressed && orbitVisibility > .1 && !orbitHidden;
      if (!navigationInFlight && !rotating && !coast && orbitNavigable !== navigable) {
        orbitNavigable = navigable;
        orbitNavigation?.update(navigable ? body.id : null, body.name);
        // The stage picker owns the clipped corridor; paint nodes stay inert.
        if (orbitRoot.style.pointerEvents !== 'none') orbitRoot.style.pointerEvents = 'none';
        if (orbitRoot.tabIndex !== -1) orbitRoot.tabIndex = -1;
      }
      if (navigable) {
        const target = orbitTarget ??= { element: orbitRoot, rank, shape: { kind: 'segments', segments, bounds: projected.orbitBounds, halfWidth: lineWidth / 2 + 7 } };
        target.rank = rank; target.shape.segments = segments; target.shape.bounds = projected.orbitBounds; target.shape.halfWidth = lineWidth / 2 + 7;
        orbitPick = target;
      } else orbitPick = null;
    },
    updateLabel(projected: ProjectedBody, rank: number, labelShown: boolean, labelSize: { readonly width: number; readonly height: number },
      navigationSuppressed: boolean) {
      labelRect = null; labelPick = null;
      if (!labelShown || !projected.labelPosition) return;
      const [left, top] = projected.labelPosition;
      const rect = labelRectTarget ??= { left: 0, top: 0, right: 0, bottom: 0 };
      rect.left = left; rect.top = top;
      rect.right = left + labelSize.width; rect.bottom = top + labelSize.height;
      labelRect = rect;
      const target = labelTarget ??= { element: marker, rank: rank + 1, shape: { kind: 'rect', left: 0, top: 0, right: 0, bottom: 0 } };
      target.rank = rank + 1; target.shape.left = rect.left; target.shape.top = rect.top; target.shape.right = rect.right; target.shape.bottom = rect.bottom;
      labelPick = navigationSuppressed ? null : target;
    },
    updateNavigation() { navigation.update(markerPick || indicatorPick || labelPick ? body.id : null, body.name); },
    collect(rank: number, targets: ScreenPickTarget[], rects: LabelScreenRect[]) {
      if (markerPick) { markerPick.rank = rank; targets.push(markerPick); }
      if (indicatorPick) { indicatorPick.rank = rank + 2; targets.push(indicatorPick); }
      if (orbitPick) { orbitPick.rank = rank; targets.push(orbitPick); }
      if (labelPick) { labelPick.rank = rank + 1; targets.push(labelPick); }
      if (labelRect) rects.push(labelRect);
    },
    destroy() { navigation.destroy(); orbitNavigation?.destroy(); },
  };
}

interface PaintedEntry {
  readonly interaction: ReturnType<typeof createWorldContextBodyInteraction>;
  readonly center: readonly [number, number];
  readonly indicatorRadius: number;
  readonly indicatorShown: boolean;
  readonly billboardShown: boolean | undefined;
}

/** Publish one coherent hit and exclusion snapshot from the bodies that actually contribute paint. */
export function createWorldContextInteractions(host: HTMLElement, root: HTMLElement) {
  const picking = screenPicking(host);
  let labelExclusions: readonly LabelScreenRect[] = [], backgroundExclusions: readonly LabelScreenRect[] = [];
  return {
    labelExclusionRects: () => labelExclusions,
    backgroundExclusionRects: () => backgroundExclusions,
    clearPicking() { picking.publish(root, []); },
    commit<Entry extends PaintedEntry>(paintedOrder: readonly Entry[], rankOf: (entry: Entry) => number | undefined,
      caption: ProjectedBody | undefined, captionSize: { readonly width: number; readonly height: number } | undefined,
      pickingChanged: boolean, navigationInFlight: boolean) {
      const targets: ScreenPickTarget[] = [], acceptedRects: LabelScreenRect[] = [], indicatorRects: LabelScreenRect[] = [];
      for (const entry of paintedOrder) {
        const rank = rankOf(entry)!;
        entry.interaction.collect(rank, targets, acceptedRects);
        if (entry.indicatorShown && entry.billboardShown) {
          const [x, y] = entry.center, radius = entry.indicatorRadius;
          indicatorRects.push({ left: x - radius, right: x + radius, top: y - radius, bottom: y + radius });
        }
      }
      if (caption?.labelPosition && captionSize) {
        const [left, top] = caption.labelPosition;
        acceptedRects.push({ left, top, right: left + captionSize.width, bottom: top + captionSize.height });
      }
      labelExclusions = acceptedRects;
      // An orbit crosses empty space; only drawn annotation footprints exclude background labels.
      backgroundExclusions = [...acceptedRects, ...indicatorRects];
      if (pickingChanged) picking.publish(root, navigationInFlight ? [] : targets);
    },
    destroy() { picking.remove(root); labelExclusions = []; backgroundExclusions = []; },
  };
}
