import { applySpriteImage, type SpriteWithUrl } from '../../solar-system/heliocentric-sprites.js';
import { BODY_INDICATOR_DIAMETER } from './context-scale.js';
import type { PlannedWorldContext } from './world-context-planner.js';
import type { createOpacityFader } from '../../stars/opacity-fader.js';

type ProjectedBody = PlannedWorldContext['projectedBodies'][number];
type Fader = ReturnType<typeof createOpacityFader>;
const SPRITE_DETAIL_RETURN = .75;

interface MarkerFrame {
  readonly projected: ProjectedBody;
  readonly billboardShown: boolean;
  readonly plannedShown: boolean;
  readonly markerShown: boolean;
  readonly markerDiameter: number;
  readonly flatDot: boolean;
  readonly zIndex: string;
  readonly selected: boolean;
  readonly hovered: boolean;
  readonly animated: boolean;
  readonly coast: boolean;
  readonly policyChanged: boolean;
  readonly emphasis: number;
}

/** Retained DOM and cached writes for one world-context marker. Presentation decisions stay with the publisher. */
export function createWorldContextMarkerPaint(marker: HTMLElement, mover: HTMLElement, spriteLeaf: HTMLElement,
  body: { readonly color: string; readonly contextColor?: string }, sprite: SpriteWithUrl | undefined, locator: SVGSVGElement) {
  let billboardShown: boolean | undefined, markerShown: boolean | undefined;
  let markerDiameter = 0, flatDot = false, spriteDetail = false, spriteApplied = false, indicatorHovered = false;
  let center: [number, number] = [0, 0];
  let markerTransform = '', spriteTransform = '', labelOffset = '';
  return {
    get billboardShown() { return billboardShown; },
    get markerShown() { return markerShown; },
    get markerDiameter() { return markerDiameter; },
    get flatDot() { return flatDot; },
    get center() { return center; },
    get indicatorHovered() { return indicatorHovered; },
    publish(frame: MarkerFrame, fader: Fader) {
      const { projected, plannedShown, zIndex, selected, hovered, animated, coast, policyChanged, emphasis } = frame;
      const { x, y, markerOpacity } = projected;
      const wasShown = billboardShown === true, hoverChanged = indicatorHovered !== hovered;
      const animationState = String(animated);
      if (marker.dataset.contextAnnotationsAnimate !== animationState) marker.dataset.contextAnnotationsAnimate = animationState;
      fader.visible(mover, frame.billboardShown);
      // The hidden mover must not keep a compositor layer.
      if (billboardShown !== frame.billboardShown) {
        marker.style.visibility = mover.style.visibility = frame.billboardShown ? '' : 'hidden';
        mover.style.willChange = frame.billboardShown ? 'transform' : '';
      }
      billboardShown = frame.billboardShown;
      if (markerShown !== frame.markerShown) marker.dataset.contextBodyVisible = String(frame.markerShown);
      markerShown = frame.markerShown; markerDiameter = frame.markerDiameter;
      if (!frame.billboardShown) return;

      // Load the prepared detail only when the marker needs it.
      const detail = sprite?.detail;
      if (!spriteApplied && sprite && !frame.flatDot) { applySpriteImage(spriteLeaf, sprite); spriteApplied = true; }
      if (detail && !frame.flatDot && !coast) {
        const nextDetail = markerDiameter >= detail.fromDiameterPixels ||
          (spriteDetail && markerDiameter >= detail.fromDiameterPixels * SPRITE_DETAIL_RETURN);
        if (nextDetail !== spriteDetail) {
          spriteDetail = nextDetail;
          if (!flatDot) applySpriteImage(spriteLeaf, nextDetail ? detail : sprite!);
        }
      }
      if (flatDot !== frame.flatDot) {
        flatDot = frame.flatDot;
        const leaf = spriteLeaf.style;
        if (flatDot) { leaf.backgroundImage = 'none'; leaf.backgroundColor = body.color; leaf.borderRadius = '50%'; } else {
          leaf.backgroundColor = leaf.borderRadius = '';
          applySpriteImage(spriteLeaf, spriteDetail && detail ? detail : sprite!);
          spriteApplied = true;
        }
      }
      if (!coast && mover.style.zIndex !== zIndex) mover.style.zIndex = zIndex;
      const selection = String(selected);
      if (marker.dataset.contextSelected !== selection) {
        if (selected && body.contextColor) {
          const holder = locator.parentElement as HTMLElement | null;
          if (holder && holder !== marker) delete holder.dataset.contextLocator;
          marker.insertBefore(locator, spriteLeaf);
          marker.dataset.contextLocator = '';
        } else if (!selected && locator.parentElement === marker) {
          locator.remove();
          delete marker.dataset.contextLocator;
        }
        marker.dataset.contextSelected = selection;
      }
      if (!coast && indicatorHovered !== hovered) {
        indicatorHovered = hovered;
        marker.dataset.contextIndicatorHovered = String(hovered);
      }
      // Opacity lives on the mover so its marker pseudos do not restyle on camera motion.
      if (policyChanged || !wasShown || hoverChanged) fader.multiply(mover, emphasis, animated ? 120 : 0);
      fader.set(mover, frame.billboardShown && !plannedShown ? 0 : markerOpacity);
      const transform = `translate(${x}px,${y}px) translate(-50%,-50%)`;
      if (markerTransform !== transform) { mover.style.transform = transform; markerTransform = transform; }
      const scale = `scale(${markerDiameter / BODY_INDICATOR_DIAMETER})`;
      if (spriteTransform !== scale) { spriteLeaf.style.transform = scale; spriteTransform = scale; }
      center = [x, y];
    },
    publishIndicator(visible: boolean, suppressedByFlight: boolean, coast: boolean) {
      const state = String(visible && !suppressedByFlight);
      if (!coast && marker.dataset.contextIndicatorVisible !== state) marker.dataset.contextIndicatorVisible = state;
    },
    publishLabel(projected: ProjectedBody, visible: boolean, suppressedByFlight: boolean) {
      const state = String(visible && !suppressedByFlight);
      if (marker.dataset.contextLabelVisible !== state) marker.dataset.contextLabelVisible = state;
      if (!visible || !projected.labelPosition) return;
      const [x, y] = projected.labelPosition;
      const offset = `translate(${Math.round((x - projected.x) * 1e6) / 1e6}px,${Math.round((y - projected.y) * 1e6) / 1e6}px)`;
      if (labelOffset === offset) return;
      const [labelX, labelY] = offset.match(/-?[\d.]+/g)!.map(Number);
      marker.style.setProperty('--context-label-x', `${labelX}px`);
      marker.style.setProperty('--context-label-y', `${labelY}px`);
      labelOffset = offset;
    },
  };
}
