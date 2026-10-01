import { createContextLocator } from './context-locator.js';
import type { PreparedWorldContext, PreparedContextBody } from '../prepared-data/world-context.js';
import { ContextChange, createWorldContextFrameReceiver } from './world-context/world-context-frame.js';
import { createWorldContextBodyInteraction, createWorldContextInteractions } from './world-context/world-context-interactions.js';
import { createWorldContextMarkerFactory, createWorldContextMarkerPaint, type WorldContextMarkerPaint } from './world-context/world-context-marker-paint.js';
import type { WorldContextFrame } from './world-context/world-context-frame.js';
import type { PlannedWorldContext } from './world-context/world-context-planner.js';
import { bindWorldBodyColumns, createWorldBodyColumns, type PackedWorldContextView } from './world-context/world-context-view-transport.js';
import { createSystemFade, indicatorDotDiameter, starFieldFade, BODY_INDICATOR_DIAMETER, CONTEXT_LINE_WIDTH } from './world-context/context-scale.js';
import type { WorldCameraPose, WorldCameraViewport } from '../navigation/world-camera.js';
import { MINIMUM_BODY_MARKER_DIAMETER_PIXELS } from '../solar-system/heliocentric-sprites.js';
import type { OrientationXyzw } from '@cssearth/engine';
import { cssViewFromOrientation } from '../navigation/world-camera-math.js';
import { mountPreparedOrbitLines, ORBIT_RENDERER_LOD_PIXELS, type OrbitRenderer } from '../solar-system/prepared-orbit-lines.js';
import { orbitProjectionCapacity } from '../solar-system/prepared-ring-projection.js';
import type { SpriteWithUrl } from '../solar-system/heliocentric-sprites.js';

import type { LabelScreenRect } from '../labels/screen-label-layout.js';
import { createOpacityFader } from '../stars/opacity-fader.js';
import { opacityClockFor } from '../stars/opacity-clock.js';
import type { OpacityClock } from '../stars/opacity-clock.js';

/** Bodies of other systems, seen from inside the focus star's system; hover restores them. They come up to full as the
 * stars around the system fill the view (starFieldFade), in sixteenths so a zoom restyles them a few times, not per frame. */
const OTHER_SYSTEM_OPACITY = .3;
const OTHER_SYSTEM_STEPS = 16;
/** The largest dot a star is drawn as, whatever its radius. */
const STAR_DOT_MAX_DIAMETER_PIXELS = 2;
/** The stylesheet's base annotation strength (world-context.css); other prepared levels carry an attribute. */
const DEFAULT_ANNOTATION_ALPHA: { readonly line: number; readonly label: number } = Object.freeze({ line: .65, label: .65 });
const APPROXIMATE_NAME = ' (approx)', APPROXIMATE_TITLE = ' · Approximate orbital placement';
// Per-body presentation flags set by id from outside: which parts hide, and which bodies stand out.
const VISIBILITY_FLAGS = ['bodyHidden', 'orbitHidden', 'labelHidden', 'labelSuppressed', 'indicatorHidden', 'highlighted'] as const;
/** Each list names the bodies that carry its flag; an omitted flag keeps its current bodies. */
export type BodyVisibility = Partial<Record<(typeof VISIBILITY_FLAGS)[number], readonly string[]>>;

type ProjectedBody = PlannedWorldContext['projectedBodies'][number];

/** Paint and pick order. A body stacks behind the selected body's retained detail layers (z-index base..base+3) when it
 * is farther along the view than the selected body, in front of them otherwise, so a billboard behind a translucent
 * focus (a galaxy's image, an atmosphere) stays under it. On each side the order is fixed: the bodies' prepared annotation
 * priority, the larger body first on a tie. Markers overlap almost only where a whole system has shrunk to a few pixels (a
 * zoom out from the Sun at 84 to 582 AU drew 246 to 363 markers in 5,523 to 21,391 overlapping pairs, and a half turn
 * there swapped 13,679 of them, 2026-09-30), where no order among them shows; a full camera-depth order rewrote hundreds of
 * z-indices on every turn's release. Now a turn moves only the bodies that cross the selected body's depth. Camera
 * translation shifts every depth equally, so only the orientation, the members and the selection move a side; a rotation
 * keeps the sides and updates them once on release. */
function createDepthOrder<Entry extends { readonly body: { readonly id: string; readonly radiusM: number; readonly positionM: readonly number[] } }>(
  members: readonly Entry[], base: number, priorities: Readonly<Record<string, number>>) {
  let orientation: OrientationXyzw | null = null, selection: Entry | null = null, sorted = false;
  // Each member's place in the fixed order (its rank, four pick slots per place) and whether it is behind the selection.
  const places = new Map<Entry, number>(), behind = new Map<Entry, boolean>();
  const allocate = () => {
    places.clear();
    [...members].map((entry, index) => ({ entry, index })).sort((a, b) =>
      (priorities[a.entry.body.id] ?? 0) - (priorities[b.entry.body.id] ?? 0) || a.entry.body.radiusM - b.entry.body.radiusM || a.index - b.index)
      .forEach(({ entry }, place) => places.set(entry, place));
  };
  return {
    /** Hidden bodies leave the order; the next update places the rest. */
    setMembers(next: readonly Entry[]) { members = next; orientation = null; sorted = false; },
    update(orientationXyzw: OrientationXyzw, rotating: boolean, selected: Entry) {
      let ranksChanged = false;
      if (!sorted) { allocate(); sorted = true; ranksChanged = true; }
      const turned = !orientation || (!rotating && orientation.some((value, axis) => value !== orientationXyzw[axis]));
      if (!turned && !ranksChanged && selection === selected) return { ranksChanged, changed: false };
      if (turned) orientation = [orientationXyzw[0], orientationXyzw[1], orientationXyzw[2], orientationXyzw[3]];
      const view = cssViewFromOrientation(orientation!), vx = view[6]!, vy = view[7]!, vz = view[8]!;
      const depth = (entry: Entry) => -(vx * entry.body.positionM[0]! + vy * entry.body.positionM[1]! + vz * entry.body.positionM[2]!);
      const selectedDepth = depth(selected);
      let changed = ranksChanged || selection !== selected;
      for (const entry of members) {
        const next = entry !== selected && depth(entry) > selectedDepth;
        if (behind.get(entry) !== next) { behind.set(entry, next); changed = true; }
      }
      selection = selected;
      return { ranksChanged, changed };
    },
    /** Four pick slots per body: orbit and marker, label, indicator. */
    rank: (entry: Entry) => { const place = sorted ? places.get(entry) : undefined; return place === undefined ? undefined : place * 4; },
    /** The selected body's retained detail layers take z-index base..base+3; the others stack behind or in front of them. */
    zIndex(rank: number, entry: Entry) {
      if (entry === selection) return String(base);
      const place = rank / 4;
      return String(behind.get(entry) ? base - members.length + place : base + 4 + place);
    },
  };
}

/** One caption and one circle follow the destination through the entire flight. Its preview sprite has a
 * separate lifetime and fades at 14–20px, long before the close-up has arrived. */
function mountFlightAnnotations(root: HTMLElement, { billboardFadeStartDiscPixels: start, billboardFullDiscPixels: full }: PreparedWorldContext['camera']['presentation']['levelOfDetail'], depthBase: number) {
  const leaf = (className: string, key: 'contextFlightLabel' | 'contextFlightCircle') => {
    const element = root.ownerDocument.createElement('span');
    element.className = className;
    element.dataset[key] = '';
    element.style.visibility = 'hidden';
    element.style.zIndex = String(depthBase + 4);
    element.setAttribute('aria-hidden', 'true');
    root.appendChild(element);
    return element;
  };
  const caption = leaf('context-flight-caption', 'contextFlightLabel'), circle = leaf('context-flight-circle', 'contextFlightCircle');
  type Entry = { readonly body: { readonly id: string }; readonly marker: HTMLElement; readonly baseAlpha: { readonly line: number; readonly label: number } };
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
export function mountPreparedWorldContext({ host, presentationHost = host, before, plan, sprites, requestPublication, annotationOpacities = {}, annotationPriorities = {}, distantNavigation, plainDots, opacityClock, orbitRenderer = 'bars', depthBase = 0 }: {
  host: HTMLElement; before: Element; plan: PreparedWorldContext; sprites: Readonly<Record<string, SpriteWithUrl>>;
  /** Presentation may live outside the input host's changing CSS scope. */
  presentationHost?: HTMLElement;
  requestPublication?: () => boolean;
  annotationOpacities?: Readonly<Record<string, { line: number; label: number }>>;
  /** Each body's annotation priority (the planner's): the fixed order its marker paints and picks in. */
  annotationPriorities?: Readonly<Record<string, number>>;
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
  // A zero-size root at the stage centre, its children placed from it (world-context.css). WebKit stops inspecting a
  // container after about twenty children and assumes it paints: the full-screen root held a 7.6 MB backing at 3x on every
  // page and never drew a pixel.
  root.dataset.worldContext = plan.focus.id;
  presentationHost.insertBefore(root, before);
  const interactions = createWorldContextInteractions(host, root);
  // Captured frames go stale on every presentation change; the planner's policy only on semantic ones.
  let presentationRevision = 0, policyDirty = true;
  let distantNavigationActive = false;
  const contextFrames = createWorldContextFrameReceiver();
  let previousHeader: { emphasizedId: string | null; otherSystemOpacity: number; width: number; height: number } | null = null;
  let publishCount = 0;
  const createMarker = createWorldContextMarkerFactory(host.ownerDocument);
  // Orbit roots clone one template too. Bars draw inside the root, which places and orders them (.context-orbit-bars in
  // world-context.css). Strokes draw in the shared SVG; a positioned, transformed root would paint nothing yet become its
  // own WebKit layer over the composited sky and globe.
  const orbitTemplate = host.ownerDocument.createElement('div');
  orbitTemplate.className = orbitRenderer === 'bars' ? 'context-orbit context-orbit-bars' : 'context-orbit';
  const bodies = [plan.focus, ...plan.bodies].map((body, index) => {
    // A body drawn from its astronomy record has no package, so no prepared sprite and no page: it keeps its ring,
    // name and orbit and is never a navigation target.
    const unpackaged = 'unpackaged' in body && body.unpackaged === true;
    const plainDot = plainDotIds.has(body.id);
    const sprite = plainDot ? undefined : sprites[body.id];
    const approximate = 'placement' in body && body.placement === 'approximate';
    // The body billboard is set only when resolved and visible. Unresolved bodies remain colour dots and never fetch an image.
    const { mover, marker, spriteLeaf, caption } = createMarker(plainDot), data = marker.dataset;
    data.contextGroup = data.contextBody = data.contextLabel = body.id;
    data.contextName = caption.dataset.contextName = approximate ? `${body.name}${APPROXIMATE_NAME}` : body.name;
    if (plainDot) spriteLeaf.style.backgroundColor = body.color;
    // A body's world colour is prepared (its swatch, else its catalogue colour lifted for caption contrast) and set inline, as a
    // body drawn from its record carries its own; without either the world's default applies. Capitals mark a star, black
    // hole or planet caption. No page carries a stylesheet rule per body.
    const colour = body.contextColor ?? (unpackaged ? body.color : undefined);
    if (colour) marker.style.color = colour;
    if (body.labelCase === 'upper') data.contextLabelCase = 'upper';
    if (approximate) {
      data.contextPlacement = 'approximate';
      marker.title = `${body.name}${APPROXIMATE_TITLE}`;
    }
    const baseAlpha = annotationOpacities[body.id] ?? DEFAULT_ANNOTATION_ALPHA;
    // The body's annotation strength is a prepared level (contextAnnotationOpacity) whose final opacity the stylesheet
    // holds (world-context.css): an attribute set once, never a variable the ring and caption would resolve. The default
    // level is the stylesheet's base, so it needs no attribute.
    if (baseAlpha.line !== DEFAULT_ANNOTATION_ALPHA.line) data.contextLineAlpha = String(baseAlpha.line);
    if (baseAlpha.label !== DEFAULT_ANNOTATION_ALPHA.label) data.contextLabelAlpha = String(baseAlpha.label);
    // Retain the owner detached until the prepared view requests paint or label measurement.
    const orbit = 'orbit' in body ? (body as PreparedContextBody).orbit : null;
    // The orbit is an independent retained paint owner, beside the billboard.
    const orbitRoot = orbitTemplate.cloneNode(false) as HTMLElement;
    orbitRoot.dataset.contextOrbit = body.id;
    if (approximate) orbitRoot.dataset.contextPlacement = 'approximate';
    // The orbit owner sets the body's colour on its root.
    const piecePool = mountPreparedOrbitLines(orbitRoot, { renderer: orbitRenderer, depthBase, strokeHost: root, dashed: approximate, capacity: orbitProjectionCapacity(orbit?.vertexCount ?? 0), id: body.id,
      ...(colour ? { color: colour } : {}) });
    const pieces = piecePool.elements;
    // The stage picker owns every pointer hit: these leaves stay inert and only
    // carry keyboard and accessibility state, never pointer or cursor styles.
    const interaction = createWorldContextBodyInteraction(marker, orbitRoot, host, body, orbit !== null);
    const paint = createWorldContextMarkerPaint(marker, mover, spriteLeaf, caption, body, sprite, locator);
    // The dot a body's circle holds, sized by its radius. A placed star's is capped when drawn: sized by radius, every
    // giant reached the largest dot and thousands buried the view.
    const dotDiameter = sprite ? indicatorDotDiameter(body.radiusM, plan.focus.radiusM, MINIMUM_BODY_MARKER_DIAMETER_PIXELS) : null;
    return { index, body, sprite, unpackaged, plainDot, marker, caption, mover, orbit, orbitRoot,
      /** The parent's paint, when the parent is a body of this world (resolved below). */
      parentPaint: undefined as WorldContextMarkerPaint | undefined, pieces, piecePool, interaction,
      paint,
      get markerShown() { return paint.markerShown; }, get markerDiameter() { return paint.markerDiameter; },
      get billboardShown() { return paint.billboardShown; }, get center() { return paint.center; },
      closedOrbit: orbit?.fullTrail === true,
      indicatorRadius: BODY_INDICATOR_DIAMETER / 2,
      dotDiameter,
      drawnDotDiameter: dotDiameter !== null && orbit === null && body.id !== plan.focus.id ? Math.min(STAR_DOT_MAX_DIAMETER_PIXELS, dotDiameter) : dotDiameter,
      pointSource: body.id === plan.focus.id && plan.focus.pointSource !== undefined,
      alwaysNonNavigable: unpackaged || plainDot, distantNonNavigable: distantNonNavigableIds.has(body.id),
      orbitTransform: '',
      orbitAppearance: { width: CONTEXT_LINE_WIDTH, opacity: 1 },
      bodyHidden: false, orbitHidden: false, labelHidden: false, labelSuppressed: false, indicatorHidden: false,
      highlighted: false,
      baseAlpha,
      hovered: false, groupHovered: false,
      labelSize: { width: 0, height: 0 }, labelShown: false, labelPlacement: 0, indicatorShown: false, indicatorCutout: false, previousCount: 0 };
  });
  // Each body's presentation lives in its row of these columns (bindWorldBodyColumns): a frame sends a copy of them.
  const bodyColumns = createWorldBodyColumns(bodies.length);
  bodies.forEach((entry, index) => bindWorldBodyColumns(entry, bodyColumns, index));
  const entriesById = new Map(bodies.map(entry => [entry.body.id, entry]));
  for (const entry of bodies) if (entry.orbit) entry.parentPaint = entriesById.get(entry.orbit.centerBodyId)?.paint;
  const flightAnnotations = mountFlightAnnotations(root, plan.camera.presentation.levelOfDetail, depthBase);
  const systemFade = createSystemFade(plan);
  const windowTarget = host.ownerDocument.defaultView!;
  const clock = opacityClock ?? opacityClockFor(windowTarget);
  const fader = createOpacityFader(windowTarget, clock);
  let destroyed = false;
  let selectedEntry = bodies[0]!;
  // Beyond the system only the locators keep publishing: the anchor and every placed orbitless body.
  const anchorOnly = bodies.filter((entry, index) => index === 0 || !entry.orbit);
  let systemRetired = false;
  const depthOrder = createDepthOrder(bodies, depthBase, annotationPriorities);
  // Hidden bodies leave the paint order, except the selected one.
  const refreshDepthBodies = () => depthOrder.setMembers(bodies.filter(entry => !entry.bodyHidden || entry === selectedEntry));
  let overview = false, overviewSelection = false;
  let highlighting = false;
  let selectionPreview: string | null | undefined;
  let navigationInFlight = false;
  // A released rotation keeps the committed system landmarks until the next published frame.
  let rotationPhase: 'idle' | 'dragging' | 'released' = 'idle';
  // The inertia gate (docs/performance/motion-freezes-membership.md): while the camera coasts, shown bodies only move and
  // fade; nothing is revealed, retired, restyled, restacked or re-announced until the coast stops.
  let coasting = false;
  // The camera sees the galaxy from outside (setOutsideGalaxy): names over its bright bulge turn dark (world-context.css).
  // A restyle, so like any other it waits for a coast to stop.
  let outsideGalaxy = false, publishedOutsideGalaxy = false;
  const publishOutsideGalaxy = () => {
    if (coasting || outsideGalaxy === publishedOutsideGalaxy) return;
    publishedOutsideGalaxy = outsideGalaxy;
    if (outsideGalaxy) root.dataset.galaxyView = 'outside'; else delete root.dataset.galaxyView;
  };
  let labelBlockers: readonly LabelScreenRect[] = [];
  let hoverIntent = false;
  const animatedAnnotations = new Set<(typeof bodies)[number]>();
  // The prepared bank stays retained. Only owners currently contributing paint
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
      entry.paint.stopAnimating();
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
  const invalidateLabelSizes = () => { invalidatePolicy(); for (const entry of bodies) entry.labelSize = { ...entry.labelSize, width: 0 }; };
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
  const readView = (world: WorldCameraPose, viewport: WorldCameraViewport, frameBlockers: readonly LabelScreenRect[] = []): PackedWorldContextView => {
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
      return { world, viewport: { ...viewport,
        widthPixels: viewport.widthPixels ?? host.clientWidth, heightPixels: viewport.heightPixels ?? host.clientHeight },
        contextCommittedId: contextFrames.committedId,
        selectedId: selectedEntry.body.id, overview, overviewSelection, selectionPreview, navigationInFlight, rotationActive: rotationPhase === 'dragging',
        preserveCommittedAnnotations: rotationPhase === 'released',
        labelBlockers: frameBlockers.length ? [...labelBlockers, ...frameBlockers] : labelBlockers, anchorOnly: publishingBodies === anchorOnly,
        orbitLodPixels: ORBIT_RENDERER_LOD_PIXELS[orbitRenderer],
        // Each body's presentation as it stands, copied for the planner's worker (the copy is transferred).
        bodyColumns: bodyColumns.slice() };
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
    bodyLabelRects: interactions.bodyLabelRects,
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
    setOverview(enabled: boolean, preserveSelection = false) {
      const selected = enabled && preserveSelection;
      if ((overview === enabled && overviewSelection === selected) || destroyed) return;
      settleHover();
      invalidatePolicy();
      overview = enabled;
      overviewSelection = selected;
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
    /** Whether the camera is outside the galaxy, looking at it as a whole rather than from among its stars. */
    setOutsideGalaxy(outside: boolean) {
      if (destroyed) return;
      outsideGalaxy = outside;
      publishOutsideGalaxy();
    },
    /** The camera coasts on inertia (camera-motion-signal.ts). Held membership lands on the first frame after. */
    setCoasting(active: boolean) {
      if (destroyed || active === coasting) return;
      coasting = active;
      if (active) { hoverIntent = false; settleHover(); return; }
      publishOutsideGalaxy();
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
    publicationStats: () => ({ skippedPublications, bodyPublications, depthPublications, paintedBodies: paintedBodies.size,
      attachedBodies: bodies.filter(entry => entry.mover.parentNode === root).length, retainedBodies: bodies.length }),
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
      // The planner alone owns eligibility. Read only newly eligible captions,
      // before any writes, then replan once with their actual CSS bounds.
      let measured = false;
      const attachMarkers = new Set<(typeof bodies)[number]>();
      const attachOrbits = new Set<(typeof bodies)[number]>();
      for (const index of coasting ? [] : preparedFrame.labelMeasurements ?? []) {
        const entry = bodies[index];
        if (entry.labelSize.width !== 0) continue;
        if (!entry.mover.parentNode) { attachMarkers.add(entry); continue; }
        const text = windowTarget.getComputedStyle(entry.caption, '::after');
        const width = Math.ceil(parseFloat(text.width)), height = Math.ceil(parseFloat(text.height));
        if (width > 0 && height > 0) { entry.labelSize = { width, height }; measured = true; }
      }
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
      // Inside the focus star's system, other systems' bodies stay clickable but read as not belonging to it.
      const starField = starFieldFade(Math.hypot(...world.pose.positionM.map((value, axis) => value - plan.focus.positionM[axis]!)), plan.system);
      const otherSystemOpacity = systemFade.of(0) > .5
        ? OTHER_SYSTEM_OPACITY + (1 - OTHER_SYSTEM_OPACITY) * Math.round(starField * OTHER_SYSTEM_STEPS) / OTHER_SYSTEM_STEPS : 1;
      cameraState.set(world.pose.positionM, 0); cameraState.set(world.pose.orientationXyzw, 3);
      cameraState[7] = viewport.focalPixels; cameraState[8] = width; cameraState[9] = height;
      cameraState.set(viewport.principalOffsetPixels, 10);
      const resized = previousHeader?.width !== width || previousHeader?.height !== height;
      const policyChanged = resized || distantNavigationChanged || policyDirty || previousHeader?.emphasizedId !== emphasizedId ||
        previousHeader?.otherSystemOpacity !== otherSystemOpacity;
      policyDirty = false;
      previousHeader = { emphasizedId, otherSystemOpacity, width, height };
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
        // These fields write through to the body's columns (bindWorldBodyColumns); an unchanged one skips its setter.
        if (entry.labelShown !== projected.labelShown) entry.labelShown = projected.labelShown;
        if (entry.labelPlacement !== projected.labelPlacement) entry.labelPlacement = projected.labelPlacement;
        if (entry.indicatorShown !== projected.indicatorShown) entry.indicatorShown = projected.indicatorShown;
        entry.indicatorCutout = projected.indicatorCutout;
        const orbit = entry.orbitAppearance, next = projected.orbitAppearance;
        if (orbit.width !== next.width || orbit.opacity !== next.opacity) entry.orbitAppearance = next;
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
        const zIndex = depthOrder.zIndex(rank, entry);
        if (entry.paint.billboardShown && entry.mover.style.zIndex !== zIndex) entry.mover.style.zIndex = zIndex;
        if (orbitRenderer === 'bars' && entry.previousCount > 0 && entry.orbitRoot.style.zIndex !== zIndex) entry.orbitRoot.style.zIndex = zIndex;
      }
      for (const { projected, entry, mask } of projectedBodies) {
        const { x, y, diameter, markerOpacity, visible, annotationVisible,
          orbitVisibility, segments, index, coveredBy } = projected;
        const { body } = entry;
        if (mask === 0) continue;
        const contextEmphasis = (highlighting && !entry.highlighted && !entry.hovered ? .3 : 1) *
          (!entry.hovered && !systemFade.inFocusSystem(entry.index) ? otherSystemOpacity : 1);
        const emphasis = contextEmphasis;
        // All three visual parts share this one zoom/context alpha and
        // movement transform. The pseudos only own annotation visibility.
        const plannedShown = (visible || (annotationVisible && (entry.indicatorShown || entry.labelShown))) && markerOpacity > 0;
        // Coasting holds membership: a shown body stays shown and fades out if the plan drops it; a hidden one waits.
        const billboardShown = coast ? entry.paint.billboardShown === true : plannedShown;
        if (!billboardShown && entry.paint.billboardShown === false && orbitVisibility === 0 && entry.previousCount === 0) continue;
        bodyPublications++;
        const navigationSuppressed = entry.alwaysNonNavigable || (distantNavigationActive && entry.distantNonNavigable);
        const { pointSource } = entry;
        // A body's circle holds a dot in the body's colour, sized by its radius, until its own disc outgrows the dot.
        // The focus star's circle holds the same dot over its point of light.
        // A plain dot is always its colour; the flat-dot swap is for bodies with a sprite.
        const flatDot = coast ? entry.paint.flatDot : !entry.plainDot && (!entry.sprite ||
          diameter < (entry.sprite.minimumDiameterPixels ?? MINIMUM_BODY_MARKER_DIAMETER_PIXELS) ||
          entry.indicatorShown && entry.dotDiameter !== null && diameter < entry.dotDiameter);
        // A body without its own circle inside its parent's dot is part of that dot, not a second dot within it.
        const parentDot = entry.parentPaint;
        const insideParentDot = !entry.indicatorShown && parentDot?.flatDot === true &&
          Math.hypot(x - parentDot.center[0], y - parentDot.center[1]) < parentDot.markerDiameter / 2;
        const markerShown = coast && entry.paint.markerShown !== undefined ? entry.paint.markerShown
          : (visible || (pointSource && flatDot)) && markerOpacity > 0 && (!pointSource || flatDot) && !insideParentDot;
        // A twentieth of a pixel is below what a scaled sprite shows. Rotation changes
        // every marker's distance a little each frame; without this step every marker
        // and its ring and caption pseudo-elements would restyle on every frame.
        const markerDiameter = Math.round((entry.plainDot ? Math.max(plainDots!.minimumDiameterPixels, diameter) : flatDot ? entry.drawnDotDiameter ?? MINIMUM_BODY_MARKER_DIAMETER_PIXELS :
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
        const zIndex = depthOrder.zIndex(rank, entry);
        // A billboard partly behind a nearer sphere is drawn, and the sphere's own paint hides that part, so it stacks
        // just below the sphere: the focus's detail or the covering body's billboard. Ranks hold still through a drag,
        // and a body that was nearer when the drag began would otherwise cross in front of the sphere it passes behind.
        const cover = coveredBy === null ? undefined : entriesById.get(coveredBy);
        const coverRank = cover && depthOrder.rank(cover);
        const coverZ = cover === bodies[0] ? depthBase : coverRank === undefined || !cover ? undefined : Number(depthOrder.zIndex(coverRank, cover));
        const markerZIndex = coverZ === undefined || Number(zIndex) < coverZ ? zIndex : String(coverZ - 1);
        // Styles distinguish only the emphasized body. Overview shares the unselected
        // value, so a new selection restyles its two owners, not every marker and chord.
        const selection = String(emphasizedId !== null && body.id === emphasizedId);
        entry.paint.publish({ projected, billboardShown, plannedShown, markerShown, markerDiameter, flatDot, zIndex: markerZIndex,
          selected: selection === 'true', hovered: entry.hovered, animated: animatedAnnotations.has(entry), coast,
          policyChanged, emphasis }, fader);
        entry.interaction.updateMarker(projected, rank, entry, navigationSuppressed);
        const indicatorVisible = entry.indicatorShown;
        entry.paint.publishIndicator(indicatorVisible, navigationInFlight && body.id === emphasizedId, coast);
        const plannedOrbit = orbitVisibility > 0 && segments.length > 0;
        // Coasting: a drawn orbit stays drawn (fading if the plan drops it), an undrawn one waits for the coast to stop.
        const orbitShown = coast ? entry.previousCount > 0 : plannedOrbit;
        if (!coast && billboardShown && !entry.mover.parentNode) attachMarkers.add(entry);
        if (!coast && orbitShown && !entry.orbitRoot.parentNode) attachOrbits.add(entry);
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
          fader.multiply(orbitPaint, entry.hovered ? 1 : entry.baseAlpha.line * contextEmphasis, animatedAnnotations.has(entry) && entry.previousCount > 0 ? 120 : 0);
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
        // Pseudos and the sprite share the stage's precise retained hit shapes: the marker declared pointer-events:none
        // when it was cloned (world-context-marker-paint.ts), and nothing writes it again.
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
      // Publish first, then attach populated owners. A later view reads only requested caption sizes.
      for (const entry of attachMarkers) root.appendChild(entry.mover);
      for (const entry of attachOrbits) root.appendChild(entry.orbitRoot);
      if (measured || attachMarkers.size > 0) { invalidatePolicy(); refresh(); }
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
