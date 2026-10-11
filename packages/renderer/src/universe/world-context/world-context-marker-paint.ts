import { DEFAULT_CONTEXT_COLOR } from '@cssearth/objects';
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
 * the caller sets its color. */
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

/** How long a name or ring takes to appear or go when it lands after a coast (prepared-world-context.ts). */
export const LANDING_FADE_MILLISECONDS = 200;
/** Fades a marker's ring (`::before`) or a caption's name (`::after`) in from nothing, or out while keeping it drawn until
 * it is gone. A document without Web Animations changes at once. */
function fadeAnnotation(owner: HTMLElement, pseudoElement: '::before' | '::after', shown: boolean) {
  if (typeof owner.animate !== 'function') return;
  owner.animate(shown ? [{ offset: 0, opacity: 0 }] : [{ offset: 0, visibility: 'visible' }, { offset: 1, visibility: 'visible', opacity: 0 }],
    { duration: LANDING_FADE_MILLISECONDS, pseudoElement });
}

/** Retained DOM and cached writes for one world-context marker. Presentation decisions stay with the publisher. */
export function createWorldContextMarkerPaint(marker: HTMLElement, mover: HTMLElement, spriteLeaf: HTMLElement, caption: HTMLElement,
  body: { readonly color: string; readonly contextColor?: string; readonly dotColor?: string }, sprite: SpriteWithUrl | undefined, locator: SVGSVGElement) {
  let billboardShown: boolean | undefined, markerShown: boolean | undefined, emphasisWritten: number | undefined;
  let markerDiameter = 0, flatDot = false, spriteApplied = false, indicatorHovered = false;
  let center: [number, number] = [0, 0];
  let markerTransform = '', spriteTransform = '', labelOffset = '';
  // The marker's state attributes as last written: a frame compares with these, not the dataset, whose read is a DOM call
  // per marker per frame (the hottest line of a zoom out from the Sun through the stars, 2026-09-30). Only this painter
  // writes them; the template starts them at 'false', and selection starts unset.
  let animateState = 'false', indicatorState = 'false', labelState = 'false', selectedState: string | undefined;
  // The marker's own color as its owner set it, and the one a shown dataset gives the body (tint).
  const ownColor = marker.style.color; let tinted: string | null = null;
  return {
    /** Draws the marker's ring and its flat dot in `color` while a dataset colors the body; null gives them back their
     * own. The name keeps the body's own color, and a body drawn as its picture keeps the picture. */
    tint(color: string | null) {
      if (color === tinted) return;
      tinted = color; marker.style.color = color ?? ownColor;
      caption.style.color = color === null ? '' : ownColor || DEFAULT_CONTEXT_COLOR;
      if (flatDot) spriteLeaf.style.backgroundColor = color ?? body.dotColor ?? body.color;
    },
    get billboardShown() { return billboardShown; },
    get markerShown() { return markerShown; },
    get markerDiameter() { return markerDiameter; },
    get flatDot() { return flatDot; },
    get center() { return center; },
    get indicatorHovered() { return indicatorHovered; },
    publish(frame: MarkerFrame, fader: Fader) {
      const { projected, plannedShown, zIndex, selected, hovered, animated, coast, policyChanged } = frame;
      const { x, y, markerOpacity, emphasis } = projected;
      const wasShown = billboardShown === true, hoverChanged = indicatorHovered !== hovered;
      const animationState = String(animated);
      if (animateState !== animationState) { marker.dataset.contextAnnotationsAnimate = animationState; animateState = animationState; }
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
        if (flatDot) { leaf.backgroundImage = 'none'; leaf.backgroundColor = tinted ?? body.dotColor ?? body.color; leaf.borderRadius = '50%'; } else {
          leaf.backgroundColor = leaf.borderRadius = '';
          if (sprite) applySpriteImage(spriteLeaf, sprite);
          spriteApplied = true;
        }
      }
      if (!coast && mover.style.zIndex !== zIndex) mover.style.zIndex = zIndex;
      const selection = String(selected);
      if (selectedState !== selection) {
        if (selected && body.contextColor) {
          const holder = locator.parentElement as HTMLElement | null;
          if (holder && holder !== marker) delete holder.dataset.contextLocator;
          marker.insertBefore(locator, spriteLeaf);
          marker.dataset.contextLocator = '';
        } else if (!selected && locator.parentElement === marker) {
          locator.remove();
          delete marker.dataset.contextLocator;
        }
        marker.dataset.contextSelected = selection; selectedState = selection;
      }
      if (!coast && indicatorHovered !== hovered) {
        indicatorHovered = hovered;
        marker.dataset.contextIndicatorHovered = String(hovered);
      }
      // Opacity lives on the mover so its marker pseudos do not restyle on camera motion.
      if (policyChanged || !wasShown || hoverChanged || emphasisWritten !== emphasis) { fader.multiply(mover, emphasis, animated ? 120 : 0); emphasisWritten = emphasis; }
      fader.set(mover, frame.billboardShown && !plannedShown ? 0 : markerOpacity);
      // Positions to a thousandth of a pixel, what the stored transform keeps: a finer change writes a value CSS already
      // holds (4,414 of 20,913 marker transform writes in one stress run did, 2026-09-30).
      const transform = `translate(${Math.round(x * 1000) / 1000}px,${Math.round(y * 1000) / 1000}px) translate(-50%,-50%)`;
      if (markerTransform !== transform) { mover.style.transform = transform; markerTransform = transform; }
      const scale = `scale(${markerDiameter / BODY_INDICATOR_DIAMETER * (flatDot ? 1 : sprite?.imageScale ?? 1)})`;
      if (spriteTransform !== scale) { spriteLeaf.style.transform = scale; spriteTransform = scale; }
      center = [x, y];
    },
    /** Ends the marker's hover animation (prepared-world-context.ts settleHover). */
    stopAnimating() { if (animateState !== 'false') { marker.dataset.contextAnnotationsAnimate = 'false'; animateState = 'false'; } },
    /** `fade`: the change lands after a coast, so on a marker that is shown the ring fades instead of changing in one
     * frame. A marker hidden with it goes at once, as its body does. */
    publishIndicator(visible: boolean, suppressedByFlight: boolean, coast: boolean, fade = false) {
      const state = String(visible && !suppressedByFlight);
      if (coast || indicatorState === state) return;
      marker.dataset.contextIndicatorVisible = state; indicatorState = state;
      if (fade && billboardShown) fadeAnnotation(marker, '::before', visible && !suppressedByFlight);
    },
    /** `fade`: as for the ring. A name that changes side while shown fades in where it now is. */
    publishLabel(projected: ProjectedBody, visible: boolean, suppressedByFlight: boolean, fade = false) {
      const state = String(visible && !suppressedByFlight), changed = labelState !== state;
      if (changed) { marker.dataset.contextLabelVisible = state; labelState = state; }
      let moved = false;
      if (visible && projected.labelPosition) {
        const [x, y] = projected.labelPosition;
        const offset = `translate(${Math.round((x - projected.x) * 1e6) / 1e6}px,${Math.round((y - projected.y) * 1e6) / 1e6}px)`;
        moved = labelOffset !== offset;
        if (moved) { caption.style.transform = offset; labelOffset = offset; }
      }
      if (fade && billboardShown && (changed || (moved && state === 'true'))) fadeAnnotation(caption, '::after', state === 'true');
    },
  };
}
