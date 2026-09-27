import { createContextLocator } from './context-locator.js';
import type { PreparedWorldContext, PreparedContextBody } from '../prepared-data/world-context.js';
import { ContextChange, createWorldContextFrameReceiver } from './world-context/world-context-frame.js';
import { createContextSelectionPolicy } from './context-presentation-policy.js';
import { createWorldContextBodyInteraction, createWorldContextInteractions } from './world-context/world-context-interactions.js';
import { createWorldContextMarkerPaint } from './world-context/world-context-marker-paint.js';
import type { WorldContextFrame } from './world-context/world-context-frame.js';
import type { PlannedWorldContext, WorldContextView } from './world-context/world-context-planner.js';
import { createSystemFade, indicatorDotDiameter, BODY_INDICATOR_DIAMETER, CONTEXT_LINE_WIDTH } from './world-context/context-scale.js';
import type { OrientationXyzw } from '@cssearth/engine';
import type { WorldCameraPose, WorldCameraViewport } from '../navigation/world-camera.js';
import { cssViewFromOrientation } from '../navigation/world-camera-math.js';
import { MINIMUM_BODY_MARKER_DIAMETER_PIXELS } from '../solar-system/heliocentric-sprites.js';
import { mountPreparedOrbitLines, ORBIT_RENDERER_LOD_PIXELS, type OrbitRenderer } from '../solar-system/prepared-orbit-lines.js';
import { orbitProjectionCapacity } from '../solar-system/prepared-ring-projection.js';
import type { SpriteWithUrl } from '../solar-system/heliocentric-sprites.js';

import type { LabelScreenRect } from '../labels/screen-label-layout.js';
import { createOpacityFader } from '../stars/opacity-fader.js';
import { opacityClockFor } from '../stars/opacity-clock.js';
import type { OpacityClock } from '../stars/opacity-clock.js';

// A fixed leaf carries the prepared image and its two screen-sized pseudos.
// Camera movement writes one transform; the inverse scale only compensates
// those two pseudos when the projected image diameter changes.
const BILLBOARD_SIZE = BODY_INDICATOR_DIAMETER;
/** Bodies of other systems, seen from inside the focus star's system; hover restores them. */
const OTHER_SYSTEM_OPACITY = .3;
// Per-body presentation flags set by id from outside: which parts hide, and which bodies stand out.
const VISIBILITY_FLAGS = ['bodyHidden', 'orbitHidden', 'labelHidden', 'labelSuppressed', 'indicatorHidden', 'highlighted'] as const;
/** Each list names the bodies that carry its flag; an omitted flag keeps its current bodies. */
export type BodyVisibility = Partial<Record<(typeof VISIBILITY_FLAGS)[number], readonly string[]>>;

type ProjectedBody = PlannedWorldContext['projectedBodies'][number];

/** Paint and pick order by camera depth. Camera translation shifts every body's depth equally, so only the
 * orientation, the ranked members and the selection move ranks. A rotation keeps the committed order and
 * re-sorts once on release: re-ranking every frame rewrote dozens of z-indices as one body changed place. */
function createDepthOrder<Entry extends { readonly body: { readonly positionM: readonly number[] } }>(members: readonly Entry[], base: number) {
  let orientation: readonly number[] | null = null, selection: Entry | null = null, selectedRank = 0;
  let ranks = new Map<Entry, number>();
  return {
    /** Hidden bodies leave the order; the next update re-sorts. */
    setMembers(next: readonly Entry[]) { members = next; orientation = null; },
    update(orientationXyzw: OrientationXyzw, rotating: boolean, selected: Entry) {
      let ranksChanged = false;
      if (!orientation || (!rotating && orientation.some((value, axis) => value !== orientationXyzw[axis]))) {
        orientation = [...orientationXyzw];
        const view = cssViewFromOrientation(orientationXyzw);
        const depth = (entry: Entry) => -(view[6]! * entry.body.positionM[0] + view[7]! * entry.body.positionM[1] + view[8]! * entry.body.positionM[2]);
        ranks = new Map([...members].sort((a, b) => depth(b) - depth(a)).map((entry, index) => [entry, index * 4]));
        selection = null; ranksChanged = true;
      }
      const changed = ranksChanged || selection !== selected;
      selection = selected;
      selectedRank = ranks.get(selected)!;
      return { ranksChanged, changed };
    },
    /** Four pick slots per body: orbit and marker, label, indicator. */
    rank: (entry: Entry) => ranks.get(entry),
    /** The selected body's retained detail layers take z-index base..base+3; other bodies stack behind or in front. */
    zIndex(rank: number) { const relative = (rank - selectedRank) / 4; return String(base + (relative > 0 ? relative + 3 : relative)); },
  };
}

/** One caption and one circle follow the destination through the entire flight. Its preview sprite has a
 * separate lifetime and fades at 14–20px, long before the close-up has arrived. */
function mountFlightAnnotations(root: HTMLElement, { billboardFadeStartDiscPixels: start, billboardFullDiscPixels: full }: PreparedWorldContext['camera']['presentation']['levelOfDetail']) {
  const leaf = (className: string, key: 'contextFlightLabel' | 'contextFlightCircle') => {
    const element = root.ownerDocument.createElement('span');
    element.className = className;
    element.dataset[key] = '';
    element.style.visibility = 'hidden';
    element.setAttribute('aria-hidden', 'true');
    root.appendChild(element);
    return element;
  };
  const caption = leaf('context-flight-caption', 'contextFlightLabel'), circle = leaf('context-flight-circle', 'contextFlightCircle');
  type Entry = { readonly body: { readonly id: string }; readonly marker: HTMLElement; readonly baseAlpha: { line: number; label: number } };
  return {
    /** Returns the destination whose caption is drawn, so its footprint joins the label exclusions. */
    publish(flightBody: ProjectedBody | undefined, entry: Entry | undefined, width: number, height: number): ProjectedBody | undefined {
      const captionBody = flightBody?.labelShown && flightBody.labelPosition ? flightBody : undefined;
      const circleVisible = flightBody?.indicatorShown && flightBody.annotationVisible;
      const circleVisibility = circleVisible ? '' : 'hidden';
      if (circle.style.visibility !== circleVisibility) circle.style.visibility = circleVisibility;
      if (circleVisible && flightBody && entry) {
        if (circle.dataset.contextFlightCircle !== entry.body.id) circle.dataset.contextFlightCircle = entry.body.id;
        const opacity = String(entry.baseAlpha.line * Math.max(0, Math.min(1, (start - flightBody.diameter) / (start - full))));
        if (circle.style.opacity !== opacity) circle.style.opacity = opacity;
        const transform = `translate(${Math.round(flightBody.x * 1000) / 1000}px, ${Math.round(flightBody.y * 1000) / 1000}px) translate(-50%, -50%)`;
        if (circle.style.transform !== transform) circle.style.transform = transform;
      }
      const captionVisibility = captionBody ? '' : 'hidden';
      if (caption.style.visibility !== captionVisibility) caption.style.visibility = captionVisibility;
      if (captionBody?.labelPosition && entry) {
        if (caption.dataset.contextFlightLabel !== entry.body.id) {
          caption.dataset.contextFlightLabel = entry.body.id;
          caption.textContent = entry.marker.dataset.contextName!;
          caption.style.opacity = String(entry.baseAlpha.label);
        }
        const [x, y] = captionBody.labelPosition;
        const transform = `translate(${Math.round(x * 1000) / 1000}px, ${Math.round(y * 1000) / 1000}px)`;
        if (caption.style.transform !== transform) caption.style.transform = transform;
      }
      return captionBody;
    },
  };
}

/** Existing retained segment/sprite rendering, driven by the same observer as the detailed body. */
export function mountPreparedWorldContext({ host, presentationHost = host, before, plan, sprites, requestPublication, annotationOpacities = {}, distantNavigation, plainDots, opacityClock, orbitRenderer = 'bars', depthBase = 0 }: {
  host: HTMLElement; before: Element; plan: PreparedWorldContext; sprites: Readonly<Record<string, SpriteWithUrl>>;
  /** Presentation may live outside the input host's changing CSS scope. */
  presentationHost?: HTMLElement;
  requestPublication?: () => boolean;
  annotationOpacities?: Readonly<Record<string, { line: number; label: number }>>;
  distantNavigation?: { readonly afterDistanceM: number; readonly nonNavigableIds: readonly string[] };
  /** Bodies drawn as a dot in their colour, at least `minimumDiameterPixels` wide: no sprite, and never a hover or
   * navigation target. */
  plainDots?: { readonly ids: readonly string[]; readonly minimumDiameterPixels: number };
  opacityClock?: OpacityClock;
  /** Which retained paint owner draws the prepared orbit lines. */
  orbitRenderer?: OrbitRenderer;
  /** The stage's depth base: every z-index here is above it or at it, never negative (prepared-universe-runtime.ts). */
  depthBase?: number;
}) {
  if (distantNavigation && (!Number.isFinite(distantNavigation.afterDistanceM) || distantNavigation.afterDistanceM <= 0)) {
    throw new TypeError('Distant navigation requires a positive finite distance.');
  }
  const distantNonNavigableIds = new Set(distantNavigation?.nonNavigableIds ?? []);
  const plainDotIds = new Set(plainDots?.ids ?? []);
  const root = host.ownerDocument.createElement('div');
  // The emphasised body's corner locator: one element, moved between markers (context-locator.ts).
  const locator = createContextLocator(host.ownerDocument);
  root.className = 'prepared-world-context';
  // A zero-size root at the stage centre, its children placed from it. WebKit stops inspecting a container after about twenty
  // children and assumes it paints: the full-screen root held a 7.6 MB backing at 3x on every page and never drew a pixel.
  root.style.cssText = 'position:absolute;left:50%;top:50%;width:0;height:0;pointer-events:none';
  root.dataset.worldContext = plan.focus.id;
  presentationHost.insertBefore(root, before);
  const interactions = createWorldContextInteractions(host, root);
  // Captured frames go stale on every presentation change; the planner's policy only on semantic ones.
  let presentationRevision = 0, policyDirty = true;
  let distantNavigationActive = false;
  const contextFrames = createWorldContextFrameReceiver();
  let previousHeader: { emphasizedId: string | null; selectionStrength: number; focusSystemShown: boolean; width: number; height: number } | null = null;
  const points = new Map([plan.focus, ...plan.bodies].map(body => [body.id, body]));
  const selectionPolicy = createContextSelectionPolicy(plan);
  let publishCount = 0;
  const bodies = [plan.focus, ...plan.bodies].map((body, index) => {
    // A body drawn from its astronomy record has no package, so no prepared sprite and no page: it keeps its ring,
    // name and orbit and is never a navigation target.
    const unpackaged = 'unpackaged' in body && body.unpackaged === true;
    const plainDot = plainDotIds.has(body.id);
    const sprite = plainDot ? undefined : sprites[body.id];
    if (!sprite && !unpackaged && !plainDot) { root.remove(); throw new TypeError(`Missing prepared navigation sprite ${body.id}.`); }
    const marker = host.ownerDocument.createElement('s');
    marker.dataset.contextGroup = body.id;
    marker.dataset.contextBody = body.id;
    marker.dataset.contextLabel = body.id;
    marker.dataset.contextName = body.name;
    marker.dataset.contextIndicatorVisible = 'false';
    marker.dataset.contextLabelVisible = 'false';
    marker.dataset.contextAnnotationsAnimate = 'false';
    // Visibility and opacity belong to the mover; the marker and its pseudos inherit them.
    marker.style.cssText = 'position:absolute;inset:0;pointer-events:none;text-decoration:none;transform-origin:0 0';
    // The sprite scales alone. Scaling the marker made its ring and caption pseudos counter-scale through an inherited
    // custom property, which re-resolved the marker and both pseudos for every moving body on every frame.
    const spriteLeaf = host.ownerDocument.createElement('i');
    spriteLeaf.style.cssText = `position:absolute;left:0;top:0;width:${BILLBOARD_SIZE}px;height:${BILLBOARD_SIZE}px;background-repeat:no-repeat;transform-origin:50% 50%;pointer-events:none`;
    // The atlas image is set when the sprite first shows (below): a page opens with a handful of sprites on screen, and a
    // hidden body must not fetch its atlas page. A plain dot is its colour, and fetches none.
    if (plainDot) { spriteLeaf.style.backgroundColor = body.color; spriteLeaf.style.borderRadius = '50%'; marker.dataset.contextPlainDot = ''; }
    marker.appendChild(spriteLeaf);
    // A body's world colour is prepared (its swatch, else its catalogue colour lifted for caption contrast) and set inline, as a
    // body drawn from its record carries its own; without either the world's default applies. Capitals mark a star, black
    // hole or planet caption. No page carries a stylesheet rule per body.
    const colour = body.contextColor ?? (unpackaged ? body.color : undefined);
    if (colour) marker.style.color = colour;
    if (body.labelCase === 'upper') marker.dataset.contextLabelCase = 'upper';
    const approximate = 'placement' in body && body.placement === 'approximate';
    if (approximate) {
      marker.dataset.contextPlacement = 'approximate';
      marker.dataset.contextName = `${body.name} (approx)`;
      marker.title = `${body.name} · Approximate orbital placement`;
    }
    marker.style.width = marker.style.height = `${BILLBOARD_SIZE}px`;
    marker.style.margin = '0';
    marker.style.marginLeft = marker.style.marginTop = '0';
    const baseAlpha = annotationOpacities[body.id] ?? { line: .65, label: .65 };
    marker.style.setProperty('--context-line-alpha', String(baseAlpha.line));
    marker.style.setProperty('--context-label-alpha', String(baseAlpha.label));
    // A bare mover carries the per-frame transform and paint order. The marker,
    // with its ring and caption pseudo-elements and attribute rules, keeps a
    // stable style, so motion restyles one plain leaf instead of three nodes.
    const mover = host.ownerDocument.createElement('b');
    // A fixed-size box with layout and size containment is a relayout boundary: a
    // marker's visibility or cue change lays out these three boxes, not the document.
    mover.style.cssText = `position:absolute;left:0;top:0;width:${BILLBOARD_SIZE}px;height:${BILLBOARD_SIZE}px;transform-origin:0 0;pointer-events:none;contain:layout size;visibility:hidden`;
    mover.appendChild(marker);
    root.appendChild(mover);
    const orbit = 'orbit' in body ? (body as PreparedContextBody).orbit : null;
    const orbitRoot = host.ownerDocument.createElement('div');
    orbitRoot.className = 'context-orbit';
    orbitRoot.dataset.contextOrbit = body.id;
    // The orbit is an independent retained paint owner, beside the billboard.
    // Bars draw inside the root, which places and orders them. Strokes draw in the shared SVG; a positioned,
    // transformed root would paint nothing yet become its own WebKit layer over the composited sky and globe.
    orbitRoot.style.cssText = orbitRenderer === 'bars' ? 'position:absolute;inset:0;width:0;height:0;pointer-events:none' : 'pointer-events:none';
    if (approximate) orbitRoot.dataset.contextPlacement = 'approximate';
    if (body.contextColor) orbitRoot.style.color = body.contextColor;
    if (orbit) root.insertBefore(orbitRoot, mover);
    const piecePool = mountPreparedOrbitLines(orbitRoot, { renderer: orbitRenderer, dashed: approximate, capacity: orbitProjectionCapacity(orbit?.vertexCount ?? 0), id: body.id,
      ...(colour ? { color: colour } : {}) });
    const pieces = piecePool.elements;
    // The stage picker owns every pointer hit: these leaves stay inert and only
    // carry keyboard and accessibility state, never pointer or cursor styles.
    const interaction = createWorldContextBodyInteraction(marker, orbitRoot, host, body, orbit !== null);
    const paint = createWorldContextMarkerPaint(marker, mover, spriteLeaf, body, sprite, locator);
    return { index, body, sprite, unpackaged, plainDot, marker, mover, orbit, orbitRoot, parent: orbit ? points.get(orbit.centerBodyId) ?? null : null, pieces, piecePool, interaction,
      paint,
      get markerShown() { return paint.markerShown; }, get markerDiameter() { return paint.markerDiameter; },
      get billboardShown() { return paint.billboardShown; }, get center() { return paint.center; },
      closedOrbit: orbit?.fullTrail === true,
      indicatorRadius: BODY_INDICATOR_DIAMETER / 2,
      dotDiameter: sprite ? indicatorDotDiameter(body.radiusM, plan.focus.radiusM, MINIMUM_BODY_MARKER_DIAMETER_PIXELS) : null,
      orbitTransform: '',
      orbitAppearance: { width: CONTEXT_LINE_WIDTH, opacity: 1 },
      bodyHidden: false, orbitHidden: false, labelHidden: false, labelSuppressed: false, indicatorHidden: false,
      highlighted: false,
      baseAlpha,
      hovered: false, groupHovered: false,
      labelSize: { width: 0, height: 0 }, labelShown: false, labelPlacement: 0, indicatorShown: false, indicatorCutout: false, previousCount: 0 };
  });
  const entriesById = new Map(bodies.map(entry => [entry.body.id, entry]));
  const flightAnnotations = mountFlightAnnotations(root, plan.camera.presentation.levelOfDetail);
  const systemFade = createSystemFade(plan);
  const windowTarget = host.ownerDocument.defaultView!;
  const clock = opacityClock ?? opacityClockFor(windowTarget);
  const fader = createOpacityFader(windowTarget, clock);
  let destroyed = false;
  let selectedEntry = bodies[0]!;
  // Beyond the system only the locators keep publishing: the anchor and every placed orbitless body.
  const anchorOnly = bodies.filter((entry, index) => index === 0 || !entry.orbit);
  let systemRetired = false;
  const depthOrder = createDepthOrder(bodies, depthBase);
  // Hidden bodies leave the paint order, except the selected one.
  const refreshDepthBodies = () => depthOrder.setMembers(bodies.filter(entry => !entry.bodyHidden || entry === selectedEntry));
  let overview = false;
  let highlighting = false;
  let selectionPreview: string | null | undefined;
  let navigationInFlight = false;
  // A released rotation keeps the committed system landmarks until the next published frame.
  let rotationPhase: 'idle' | 'dragging' | 'released' = 'idle';
  // The inertia gate (docs/performance/motion-freezes-membership.md): while the camera coasts, shown bodies only move and
  // fade; nothing is revealed, retired, restyled, restacked or re-announced until the coast stops.
  let coasting = false;
  let labelBlockers: readonly LabelScreenRect[] = [];
  let hoverIntent = false;
  const animatedAnnotations = new Set<(typeof bodies)[number]>();
  // The prepared bank stays mounted. Only owners currently contributing paint
  // participate in camera-depth updates and picking/sprite aggregation.
  const paintedBodies = new Set<(typeof bodies)[number]>();
  let paintedOrder: typeof bodies = [], paintMembershipChanged = false;
  let skippedPublications = 0, bodyPublications = 0, depthPublications = 0;
  const cameraState = new Float64Array(12).fill(NaN);
  const sameCamera = (world: WorldCameraPose, viewport: WorldCameraViewport) =>
    world.pose.positionM.every((value, axis) => value === cameraState[axis]) &&
    world.pose.orientationXyzw.every((value, axis) => value === cameraState[axis + 3]) &&
    viewport.focalPixels === cameraState[7] &&
    (viewport.widthPixels ?? host.clientWidth) === cameraState[8] &&
    (viewport.heightPixels ?? host.clientHeight) === cameraState[9] &&
    viewport.principalOffsetPixels.every((value, axis) => value === cameraState[axis + 10]);
  const settleHover = () => {
    fader.setAnimationEnabled(false);
    for (const entry of animatedAnnotations) {
      entry.marker.dataset.contextAnnotationsAnimate = 'false';
      if (!entry.hovered) entry.indicatorRadius = BODY_INDICATOR_DIAMETER / 2;
    }
    animatedAnnotations.clear();
  };
  const beginCameraInput = () => { hoverIntent = false; settleHover(); };
  // The shared input surface is a sibling of the paint host. Match the
  // picking owner's capture boundary so cancellation precedes its hover clear.
  windowTarget.addEventListener('pointerdown', beginCameraInput, { capture: true });
  windowTarget.addEventListener('wheel', beginCameraInput, { capture: true, passive: true });
  const refresh = () => { requestPublication?.(); };
  // Any change to what the planner decides also invalidates frames already captured.
  const invalidatePolicy = () => { presentationRevision++; policyDirty = true; };
  const invalidateLabelSizes = () => { invalidatePolicy(); for (const entry of bodies) entry.labelSize.width = 0; };
  const fonts = host.ownerDocument.fonts;
  fonts?.addEventListener('loadingdone', invalidateLabelSizes);
  let annotationFrame: number | null = null;
  let interactionDirty = true;
  const refreshAnnotations = (event?: Event) => {
    if (event?.type === 'focusin' || event?.type === 'focusout' ||
        (event?.type === 'objecthoverchange' && (event as CustomEvent<{ interactive?: boolean }>).detail?.interactive !== false)) hoverIntent = true;
    // Hover and focus decide which annotations show, never where bodies project:
    // the plan in flight stays valid, and the queue replans once it has committed.
    interactionDirty = true;
    if (destroyed || annotationFrame !== null) return;
    annotationFrame = clock.request(() => {
      annotationFrame = null;
      if (!destroyed) refresh();
    });
  };
  const readView = (world: WorldCameraPose, viewport: WorldCameraViewport, frameBlockers: readonly LabelScreenRect[] = []): WorldContextView => {
      if (world.referenceFrame !== plan.frame.referenceFrame || world.epochJdTt !== plan.frame.epochJdTt) {
        throw new TypeError('Context and camera reference frames differ.');
      }
      // Hover/focus events own interaction changes. A camera sample consumes
      // their latest state without polling every retained body's DOM again.
      if (interactionDirty) {
        interactionDirty = false;
        const activeElement = host.ownerDocument.activeElement;
        for (const entry of bodies) {
          entry.groupHovered = entry.marker.dataset.objectHovered === 'true' || entry.orbitRoot.dataset.objectHovered === 'true';
          entry.hovered = entry.groupHovered || activeElement === entry.marker;
          // Open the final gap before growth. Keep it open during shrink;
          // transitionend restores the resting radius without a layout read.
          if (entry.hovered) entry.indicatorRadius = BODY_INDICATOR_DIAMETER / 2 + 2;
          else if (!hoverIntent || rotationPhase === 'dragging' || navigationInFlight || !sameCamera(world, viewport)) entry.indicatorRadius = BODY_INDICATOR_DIAMETER / 2;
        }
      }
      const opacity = systemFade.update(world.pose.positionM);
      // Publish the first zero-opacity frame normally to retire picking and
      // annotations. Later frames need only the anchor locator; its siblings
      // keep their prepared DOM without further visibility work.
      const publishingBodies = opacity === 0 && systemRetired ? anchorOnly : bodies;
      // Cache the retained UI text bounds before any projection writes.
      for (const entry of publishingBodies) if (entry.labelSize.width === 0) {
        const text = windowTarget.getComputedStyle(entry.marker, '::after');
        entry.labelSize = { width: Math.ceil(parseFloat(text.width)), height: Math.ceil(parseFloat(text.height)) };
      }
      return { world, viewport: { ...viewport,
        widthPixels: viewport.widthPixels ?? host.clientWidth, heightPixels: viewport.heightPixels ?? host.clientHeight },
        contextCommittedId: contextFrames.committedId,
        selectedId: selectedEntry.body.id, overview, selectionPreview, navigationInFlight, rotationActive: rotationPhase === 'dragging',
        preserveCommittedAnnotations: rotationPhase === 'released',
        labelBlockers: frameBlockers.length ? [...labelBlockers, ...frameBlockers] : labelBlockers, anchorOnly: publishingBodies === anchorOnly,
        orbitLodPixels: ORBIT_RENDERER_LOD_PIXELS[orbitRenderer],
        bodies: bodies.map(({ hovered, bodyHidden, orbitHidden, labelHidden, labelSuppressed, indicatorHidden, highlighted, labelSize, labelShown, labelPlacement,
          indicatorShown, indicatorRadius, orbitAppearance }) => ({ hovered, bodyHidden, orbitHidden, labelHidden, labelSuppressed, indicatorHidden, highlighted, labelSize,
          labelShown, labelPlacement, indicatorShown, indicatorRadius, orbitAppearance })) };
  };
  const layer = Object.freeze({ root,
    /** `frameBlockers` hold only for this camera, such as the selected body's caption, which moves with it. */
    captureFrame(world: WorldCameraPose, viewport: WorldCameraViewport, frameBlockers: readonly LabelScreenRect[] = []) {
      const view = readView(world, viewport, frameBlockers), revision = presentationRevision;
      return { view, current: () => !destroyed && revision === presentationRevision };
    },
    setLabelBlockers(rects: readonly LabelScreenRect[]) {
      labelBlockers = rects; invalidatePolicy(); refresh();
    },
    labelExclusionRects: interactions.labelExclusionRects,
    backgroundExclusionRects: interactions.backgroundExclusionRects,
    setNavigationInFlight(active: boolean) {
      if (destroyed || active === navigationInFlight) return;
      invalidatePolicy();
      navigationInFlight = active;
      if (active) { hoverIntent = false; settleHover(); }
      systemRetired = false;
      // A flight clears the stage picker, which owns every pointer hit. Keyboard
      // and accessibility state stays as it was and catches up once the flight
      // ends: disabling and restoring every body restyled each marker twice.
      if (active) interactions.clearPicking();
      refresh();
    },
    previewSelection(id?: string | null) {
      if (destroyed) return;
      if (selectionPreview !== id) settleHover();
      invalidatePolicy();
      selectionPreview = id;
      refresh();
    },
    setOverview(enabled: boolean) {
      if (overview === enabled || destroyed) return;
      settleHover();
      invalidatePolicy();
      overview = enabled;
      refresh();
    },
    setBodyVisibility(next: BodyVisibility) {
      if (destroyed) return;
      let changed = false, depthChanged = false;
      for (const flag of VISIBILITY_FLAGS) {
        const ids = next[flag];
        if (!ids) continue;
        const marked = new Set(ids);
        for (const entry of bodies) {
          const value = marked.has(entry.body.id);
          if (entry[flag] === value) continue;
          entry[flag] = value; changed = true;
          if (flag === 'bodyHidden') depthChanged = true;
          // The marker carries the emphasis flag; its ring and caption are its own pseudo-elements.
          if (flag === 'highlighted') { if (value) entry.marker.dataset.contextHighlight = 'true'; else delete entry.marker.dataset.contextHighlight; }
        }
      }
      if (next.highlighted) {
        highlighting = bodies.some(entry => entry.highlighted);
        if (highlighting) root.dataset.contextHighlighting = 'true'; else delete root.dataset.contextHighlighting;
      }
      if (depthChanged) refreshDepthBodies();
      if (changed) { invalidatePolicy(); refresh(); }
    },
    /** The camera coasts on inertia (camera-motion-signal.ts). Held membership lands on the first frame after. */
    setCoasting(active: boolean) {
      if (destroyed || active === coasting) return;
      coasting = active;
      if (active) { hoverIntent = false; settleHover(); return; }
      invalidatePolicy();
      refresh();
    },
    setRotationActive(active: boolean) {
      if (destroyed || (rotationPhase === 'dragging') === active) return;
      rotationPhase = active ? 'dragging' : 'released';
      if (active) { hoverIntent = false; settleHover(); }
      // Keep the established system landmarks through the first settled frame.
      // Background annotations continue ordinary admission throughout the drag.
      presentationRevision++;
      if (!active) policyDirty = true;
      refresh();
    },
    opacityStats: fader.stats,
    publicationStats: () => ({ skippedPublications, bodyPublications, depthPublications, paintedBodies: paintedBodies.size }),
    inspect() {
      return Object.freeze(bodies.map(entry => Object.freeze({
        id: entry.body.id, billboard: entry.marker, mover: entry.mover,
        get markerShown() { return entry.paint.markerShown; },
        get indicatorShown() { return entry.indicatorShown; },
        get labelShown() { return entry.labelShown; },
        get center() { return entry.paint.center; },
        get labelRect() { return entry.interaction.labelRect; },
        // Orbit leaves are built on first use; report the retained leaves now.
        get orbit() { return Object.freeze(entry.pieces.filter((piece): piece is HTMLElement | SVGElement => piece !== undefined)); },
      })));
    },
    selectObject(id: string) {
      const entry = bodies.find(entry => entry.body.id === id);
      if (!entry) throw new TypeError('Selected context body is unavailable.');
      settleHover();
      invalidatePolicy();
      selectedEntry = entry;
      refreshDepthBodies();
    },
    publish(world: WorldCameraPose, viewport: WorldCameraViewport, preparedFrame: WorldContextFrame) {
      // A user-timing mark once a second names the orbit renderer inside any performance trace.
      if (publishCount++ % 60 === 0) windowTarget.performance?.mark?.(`cssearth-orbit-renderer:${orbitRenderer}`);
      if (destroyed) return;
      fader.batch(() => {
      const cameraChanged = !sameCamera(world, viewport);
      const nextDistantNavigationActive = distantNavigation !== undefined && Math.hypot(
        world.pose.positionM[0] - plan.focus.positionM[0],
        world.pose.positionM[1] - plan.focus.positionM[1],
        world.pose.positionM[2] - plan.focus.positionM[2],
      ) >= distantNavigation.afterDistanceM;
      const distantNavigationChanged = nextDistantNavigationActive !== distantNavigationActive;
      distantNavigationActive = nextDistantNavigationActive;
      const rotating = rotationPhase === 'dragging', coast = coasting;
      const interactiveHover = hoverIntent && !cameraChanged && !rotating && !navigationInFlight && !coast;
      if (cameraChanged || rotating || navigationInFlight) settleHover();
      hoverIntent = false;
      const delta = contextFrames.accept(preparedFrame);
      const { frame } = delta, { opacity } = frame;
      if (rotationPhase === 'released') rotationPhase = 'idle';
      systemRetired = opacity === 0;
      presentationRevision++;
      const { ranksChanged, changed: depthChanged } = depthOrder.update(world.pose.orientationXyzw, rotating, selectedEntry);
      const { emphasizedId, width, height } = frame;
      const selectionStrength = selectionPolicy.strengthAt(emphasizedId, world.pose.positionM);
      // Inside the focus star's system, other systems' bodies stay clickable but read as not belonging to it.
      const focusSystemShown = systemFade.of(0) > .5;
      cameraState.set(world.pose.positionM, 0); cameraState.set(world.pose.orientationXyzw, 3);
      cameraState[7] = viewport.focalPixels; cameraState[8] = width; cameraState[9] = height;
      cameraState.set(viewport.principalOffsetPixels, 10);
      const resized = previousHeader?.width !== width || previousHeader?.height !== height;
      const policyChanged = resized || distantNavigationChanged || policyDirty || previousHeader?.emphasizedId !== emphasizedId ||
        previousHeader?.selectionStrength !== selectionStrength || previousHeader?.focusSystemShown !== focusSystemShown;
      policyDirty = false;
      previousHeader = { emphasizedId, selectionStrength, focusSystemShown, width, height };
      if (!cameraChanged && !policyChanged && !depthChanged && !interactiveHover && delta.changes.size === 0) {
        skippedPublications++;
        return;
      }
      const flightBody = navigationInFlight && emphasizedId !== null
        ? frame.projectedBodies.find(body => bodies[body.index].body.id === emphasizedId)
        : undefined;
      const captionBody = flightAnnotations.publish(flightBody, flightBody && bodies[flightBody.index], width, height);
      const candidates = !policyChanged ? delta.changed : frame.projectedBodies;
      const projectedBodies = candidates.map(projected => {
        const entry = bodies[projected.index];
        entry.labelShown = projected.labelShown;
        entry.labelPlacement = projected.labelPlacement;
        entry.indicatorShown = projected.indicatorShown;
        entry.indicatorCutout = projected.indicatorCutout;
        entry.orbitAppearance = projected.orbitAppearance;
        const changed = delta.changes.get(projected.index) ?? 0;
        const mask = policyChanged ? ContextChange.all : changed;
        return { projected, entry, mask };
      });
      const pickingChanged = policyChanged || ranksChanged || delta.changes.size > 0;
      // Only the resolved presentation owns DOM visibility and hit targets.
      // A new depth order changes only z-order. It must not re-run the full
      // material/geometry publisher for every hidden or otherwise unchanged body.
      if (depthChanged) for (const entry of paintedOrder) {
        const rank = depthOrder.rank(entry);
        if (rank === undefined) continue;
        depthPublications++;
        const zIndex = depthOrder.zIndex(rank);
        if (entry.paint.billboardShown && entry.mover.style.zIndex !== zIndex) entry.mover.style.zIndex = zIndex;
        if (orbitRenderer === 'bars' && entry.previousCount > 0 && entry.orbitRoot.style.zIndex !== zIndex) entry.orbitRoot.style.zIndex = zIndex;
      }
      for (const { projected, entry, mask } of projectedBodies) {
        const { x, y, diameter, markerOpacity, visible, annotationVisible,
          orbitVisibility, segments, index } = projected;
        const { body, marker } = entry;
        const navigationSuppressed = entry.unpackaged || entry.plainDot || (distantNavigationActive && distantNonNavigableIds.has(body.id));
        if (mask === 0) continue;
        const emphasis = selectionPolicy.opacity(body.id, emphasizedId, entry.hovered, selectionStrength) *
          (highlighting && !entry.highlighted && !entry.hovered ? .3 : 1) *
          (focusSystemShown && !entry.hovered && !systemFade.inFocusSystem(entry.index) ? OTHER_SYSTEM_OPACITY : 1);
        const pointSource = body.id === plan.focus.id && plan.focus.pointSource !== undefined;
        // All three visual parts share this one zoom/selection alpha and
        // movement transform. The pseudos only own annotation visibility.
        const plannedShown = (visible || (annotationVisible && (entry.indicatorShown || entry.labelShown))) && markerOpacity > 0;
        // Coasting holds membership: a shown body stays shown and fades out if the plan drops it; a hidden one waits.
        const billboardShown = coast ? entry.paint.billboardShown === true : plannedShown;
        if (!billboardShown && entry.paint.billboardShown === false && orbitVisibility === 0 && entry.previousCount === 0) continue;
        bodyPublications++;
        // A body's circle holds a dot in the body's colour, sized by its radius, until its own disc outgrows the dot.
        // The focus star's circle holds the same dot over its point of light.
        // A plain dot is always its colour; the flat-dot swap is for bodies with a sprite.
        const flatDot = coast ? entry.paint.flatDot : !entry.plainDot && entry.indicatorShown && entry.dotDiameter !== null && diameter < entry.dotDiameter;
        // A body without its own circle inside its parent's dot is part of that dot, not a second dot within it.
        const parentDot = entry.orbit ? entriesById.get(entry.orbit.centerBodyId) : undefined;
        const insideParentDot = !entry.indicatorShown && parentDot?.paint.flatDot === true &&
          Math.hypot(x - parentDot.paint.center[0], y - parentDot.paint.center[1]) < parentDot.paint.markerDiameter / 2;
        const markerShown = coast && entry.paint.markerShown !== undefined ? entry.paint.markerShown
          : (visible || (pointSource && flatDot)) && markerOpacity > 0 && (!pointSource || flatDot) && !insideParentDot;
        // A twentieth of a pixel is below what a scaled sprite shows. Rotation changes
        // every marker's distance a little each frame; without this step every marker
        // and its ring and caption pseudo-elements would restyle on every frame.
        const markerDiameter = Math.round((entry.plainDot ? Math.max(plainDots!.minimumDiameterPixels, diameter) : flatDot ? entry.dotDiameter! :
          Math.max(entry.sprite?.minimumDiameterPixels ?? MINIMUM_BODY_MARKER_DIAMETER_PIXELS, diameter)) * 20) / 20;
        const wasShown = entry.paint.billboardShown === true;
        const hoverChanged = entry.paint.indicatorHovered !== entry.hovered;
        const animateHover = interactiveHover && hoverChanged && wasShown && billboardShown;
        // Visibility has its own immediate CSS property. Only deliberate
        // stationary hover arms opacity/transform transitions on this leaf.
        if (animateHover) { animatedAnnotations.add(entry); fader.setAnimationEnabled(true); }
        if (!billboardShown || (hoverChanged && !animateHover)) animatedAnnotations.delete(entry);
        if (!billboardShown && !entry.hovered) entry.indicatorRadius = BODY_INDICATOR_DIAMETER / 2;
        const rank = depthOrder.rank(entry)!;
        const zIndex = depthOrder.zIndex(rank);
        // Styles distinguish only the emphasized body. Overview shares the unselected
        // value, so a new selection restyles its two owners, not every marker and chord.
        const selection = String(emphasizedId !== null && body.id === emphasizedId);
        entry.paint.publish({ projected, billboardShown, plannedShown, markerShown, markerDiameter, flatDot, zIndex,
          selected: selection === 'true', hovered: entry.hovered, animated: animatedAnnotations.has(entry), coast,
          policyChanged, emphasis }, fader);
        entry.interaction.updateMarker(projected, rank, entry, navigationSuppressed);
        const indicatorVisible = entry.indicatorShown;
        entry.paint.publishIndicator(indicatorVisible, navigationInFlight && body.id === emphasizedId, coast);
        const plannedOrbit = orbitVisibility > 0 && segments.length > 0;
        // Coasting: a drawn orbit stays drawn (fading if the plan drops it), an undrawn one waits for the coast to stop.
        const orbitShown = coast ? entry.previousCount > 0 : plannedOrbit;
        const contributesPaint = billboardShown || orbitShown;
        if (paintedBodies.has(entry) !== contributesPaint) {
          if (contributesPaint) paintedBodies.add(entry); else paintedBodies.delete(entry);
          paintMembershipChanged = true;
        }
        // The paint owner names the node that carries the orbit's presentation.
        const orbitPaint = entry.piecePool.presentation;
        if (entry.orbit && orbitShown) {
          if (orbitRenderer === 'bars' && entry.orbitRoot.style.zIndex !== zIndex) entry.orbitRoot.style.zIndex = zIndex;
          if (orbitPaint.dataset.contextSelected !== selection) orbitPaint.dataset.contextSelected = selection;
          fader.multiply(orbitPaint, entry.hovered ? 1 : entry.baseAlpha.line * emphasis, animatedAnnotations.has(entry) && entry.previousCount > 0 ? 120 : 0);
        }
        if (entry.orbit && (mask & ContextChange.orbit)) {
          const orbitTransform = 'none';
          if (orbitRenderer === 'bars' && entry.orbitTransform !== orbitTransform) {
            entry.orbitRoot.style.transform = orbitTransform; entry.orbitTransform = orbitTransform;
          }
          entry.interaction.updateOrbit(projected, rank, navigationSuppressed, entry.orbitHidden, navigationInFlight, rotating, coast);
          fader.visible(orbitPaint, orbitShown);
          fader.set(orbitPaint, orbitShown && !plannedOrbit ? 0 : orbitVisibility);
          const patch = delta.orbits.get(index);
          if (patch && (!coast || (orbitShown && plannedOrbit))) {
            entry.piecePool.publish(segments);
            entry.previousCount = segments.length;
          }
        }
        if (!coast && (mask & (ContextChange.label | ContextChange.marker))) {
          const labelVisible = entry.labelShown;
          entry.paint.publishLabel(projected, labelVisible, navigationInFlight && body.id === emphasizedId);
          entry.interaction.updateLabel(projected, rank, labelVisible, entry.labelSize, navigationSuppressed);
        }
        // Flights and rotations keep keyboard/accessibility targets; they catch up after.
        if (!navigationInFlight && !rotating && !coast) entry.interaction.updateNavigation();
        // Pseudos and the sprite share the stage's precise retained hit shapes.
        if (marker.style.pointerEvents !== 'none') marker.style.pointerEvents = 'none';

      }
      // Aggregate retained picking/exclusion state in the original body order.
      // No segment traversal or style publication is needed for unchanged owners.
      if (paintMembershipChanged) {
        paintedOrder = [...paintedBodies].sort((a, b) => a.index - b.index);
        paintMembershipChanged = false;
      }
      interactions.commit(paintedOrder, depthOrder.rank, captionBody,
        captionBody ? bodies[captionBody.index].labelSize : undefined, pickingChanged, navigationInFlight);
      });
    },
    destroy() { if (!destroyed) { destroyed = true; interactions.destroy();
      if (annotationFrame !== null) clock.cancel(annotationFrame);
      host.removeEventListener('objecthoverchange', refreshAnnotations);
      windowTarget.removeEventListener('pointerdown', beginCameraInput, { capture: true });
      windowTarget.removeEventListener('wheel', beginCameraInput, { capture: true });
      for (const event of ['focusin', 'focusout']) presentationHost.removeEventListener(event, refreshAnnotations);
      root.removeEventListener('transitionend', finishIndicatorShrink); fader.destroy(); fonts?.removeEventListener('loadingdone', invalidateLabelSizes); for (const entry of bodies) entry.interaction.destroy(); root.remove(); } },
  });
  const indicatorTransitions = new Map<Element, (typeof bodies)[number]>(bodies.map(entry => [entry.marker, entry]));
  const finishIndicatorShrink = (event: Event) => {
    if ((event as TransitionEvent).propertyName !== 'transform') return;
    const entry = indicatorTransitions.get(event.target as Element);
    if (!entry || entry.paint.indicatorHovered || entry.indicatorRadius === BODY_INDICATOR_DIAMETER / 2) return;
    entry.indicatorRadius = BODY_INDICATOR_DIAMETER / 2;
    refreshAnnotations();
  };
  root.addEventListener('transitionend', finishIndicatorShrink);
  host.addEventListener('objecthoverchange', refreshAnnotations);
  for (const event of ['focusin', 'focusout']) presentationHost.addEventListener(event, refreshAnnotations);
  return layer;
}
