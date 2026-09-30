import { applySpriteImage, type SpriteWithUrl } from '../../solar-system/heliocentric-sprites.js';
import { BODY_INDICATOR_DIAMETER } from './context-scale.js';
import type { PlannedWorldContext } from './world-context-planner.js';
import type { createOpacityFader } from '../../stars/opacity-fader.js';

type ProjectedBody = PlannedWorldContext['projectedBodies'][number];
type Fader = ReturnType<typeof createOpacityFader>;

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

// Every marker's constant geometry is a world-context.css rule (.context-mover, [data-context-body], its sprite `> i`):
// only what a body or a frame changes is written inline. A bare mover carries the per-frame transform, opacity and paint
// order, and starts hidden: a publication clears its visibility to show it. The marker, with its ring pseudo-element,
// caption and attribute rules, keeps a stable style, so motion restyles one plain leaf instead of three nodes. The
// sprite scales alone: scaling the marker made its ring and caption counter-scale through an inherited custom property,
// which re-resolved the marker and both annotations for every moving body on every frame.

/** The retained leaves of one marker: mover > marker > (sprite, caption). */
export interface WorldContextMarkerLeaves {
  readonly mover: HTMLElement; readonly marker: HTMLElement; readonly spriteLeaf: HTMLElement; readonly caption: HTMLElement;
}

/** Every marker is a deep clone of one template per kind, so a world of thousands of bodies writes its constant
 * attributes once per mount, not once per body. A plain dot's sprite leaf is round (its rule) and never takes an image;
 * the caller sets its colour. */
export function createWorldContextMarkerFactory(document: Document) {
  const templates: { plain?: HTMLElement; sprite?: HTMLElement } = {};
  const template = (plainDot: boolean) => {
    const mover = document.createElement('b');
    mover.className = 'context-mover';
    mover.style.visibility = 'hidden';
    const marker = document.createElement('s');
    marker.dataset.contextIndicatorVisible = 'false';
    marker.dataset.contextLabelVisible = 'false';
    marker.dataset.contextAnnotationsAnimate = 'false';
    if (plainDot) marker.dataset.contextPlainDot = '';
    const spriteLeaf = document.createElement('i');
    const caption = document.createElement('u');
    caption.className = 'context-caption';
    marker.appendChild(spriteLeaf);
    marker.appendChild(caption);
    mover.appendChild(marker);
    return mover;
  };
  return (plainDot: boolean): WorldContextMarkerLeaves => {
    const source = plainDot ? templates.plain ??= template(true) : templates.sprite ??= template(false);
    const mover = source.cloneNode(true) as HTMLElement, marker = mover.firstChild as HTMLElement;
    return { mover, marker, spriteLeaf: marker.firstChild as HTMLElement, caption: marker.lastChild as HTMLElement };
  };
}

export type WorldContextMarkerPaint = ReturnType<typeof createWorldContextMarkerPaint>;

/** Retained DOM and cached writes for one world-context marker. Presentation decisions stay with the publisher. */
export function createWorldContextMarkerPaint(marker: HTMLElement, mover: HTMLElement, spriteLeaf: HTMLElement, caption: HTMLElement,
  body: { readonly color: string; readonly contextColor?: string; readonly dotColor?: string }, sprite: SpriteWithUrl | undefined, locator: SVGSVGElement) {
  let billboardShown: boolean | undefined, markerShown: boolean | undefined;
  let markerDiameter = 0, flatDot = false, spriteApplied = false, indicatorHovered = false;
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

      if (!spriteApplied && sprite && !frame.flatDot) { applySpriteImage(spriteLeaf, sprite); spriteApplied = true; }
      if (flatDot !== frame.flatDot) {
        flatDot = frame.flatDot;
        const leaf = spriteLeaf.style;
        if (flatDot) { leaf.backgroundImage = 'none'; leaf.backgroundColor = body.dotColor ?? body.color; leaf.borderRadius = '50%'; } else {
          leaf.backgroundColor = leaf.borderRadius = '';
          if (sprite) applySpriteImage(spriteLeaf, sprite);
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
      const scale = `scale(${markerDiameter / BODY_INDICATOR_DIAMETER * (flatDot ? 1 : sprite?.imageScale ?? 1)})`;
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
      caption.style.transform = offset;
      labelOffset = offset;
    },
  };
}
