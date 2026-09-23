import { createPreparedSceneOwnership } from './prepared-scene-ownership.mts';
import type { ObjectEntry } from './object-schema.mts';
import type { SceneFactory, ShellCamera, MountOptions } from './browser-types.mts';
import type { ObjectWorldNavigation } from '../src/renderers/css/runtime/world-navigation-types.ts';
import type { ObjectSceneLifecycle } from '../src/renderers/css/runtime/object-scene.ts';
type WorldCamera = Parameters<typeof presentWorldCamera>[0];
type WorldFrame = Parameters<typeof presentWorldCamera>[1];
type Optics = ReturnType<ObjectWorldNavigation['optics']>;
type Flight = ReturnType<typeof createSelectionFlight>;
type FlightSample = ReturnType<typeof createSelectionFlightSample>;
type FlightAnchors = Parameters<typeof advanceSelectionFlightInto>[1];
interface Timing {mark(name: string): void;}
interface TargetRequest {objectId: string; fromId: string; mount?: ShellCamera | null; force?: boolean;}
export interface WorldHandoff {transferTo(signal: AbortSignal): void; mountOptions: Partial<MountOptions>; afterMount(mount: ObjectSceneLifecycle, options: {signal: AbortSignal}): Promise<void>;}
interface FocusRequest {objectId: string; mount: ShellCamera; signal: AbortSignal; reducedMotion?: boolean; targetWorldCamera?: WorldCamera | null; targetFocusPositionM?: WorldFrame['originM'] | null; centerSelection?: boolean; timing?: Timing;}
interface PrepareRequest {fromId: string; toId: string; fromMount: ShellCamera | null; toFactory: SceneFactory | Promise<SceneFactory>; signal: AbortSignal; reducedMotion?: boolean; url?: string | URL | null; targetWorldCamera?: WorldCamera | null; targetFocusPositionM?: WorldFrame['originM'] | null; centerSelection?: boolean; preserveView?: boolean; presentWorld?: ((world: WorldCamera, optics: Optics, options: { signal: AbortSignal; commit?: () => void }) => Promise<boolean> | void) | null; cameraViewport?: Parameters<NonNullable<SceneFactory['navigation']>['prepare']>[0]['cameraViewport']; timing?: Timing;}
interface WorldFlightRequest {
  owner: Pick<ObjectWorldNavigation, 'apply'>; from: WorldCamera; flight: Flight; anchors: FlightAnchors; signal: AbortSignal;
  reducedMotion?: boolean; paused?: boolean; limitElapsedS?: () => number; canFinish?: () => boolean;
  windowTarget: Pick<Window, 'requestAnimationFrame' | 'cancelAnimationFrame' | 'performance'>;
  documentTarget: Pick<Document, 'addEventListener' | 'removeEventListener'>;
  onPaint?: (world: WorldCamera, elapsedS: number) => void;
  interruptible?: () => boolean;
}

import { CENTER_SELECTION_DURATION_SECONDS, FLIGHT_ARRIVAL_EASE_RATE, FLIGHT_ARRIVAL_TOLERANCE, FLIGHT_VISIBLE_APPROACH, FLIGHT_WHEEL_SPEEDUP } from './runtime-policy.mts';
import { STELLAR_SYSTEMS, SYSTEM_CENTERS, SYSTEM_FRAMING_RADII, SYSTEM_RANGES, SYSTEM_VIEWS, GALACTIC_VOLUME, volumeZoomTarget, systemFramingRect, systemViewTarget, systemOverviewDistance } from './system-framing.mts';
import { bodyCardViewAtCamera } from './overview-context.mts';
import { createSelectionFlight, sampleSelectionFlightInto, createSelectionFlightSample, advanceSelectionFlightInto } from '@cssearth/engine';
import { createCameraFlight, createWorldSelectionTarget, worldCameraFromCenteredPresentation, savedWorldCamera, parseSharedView, presentWorldCamera } from '../src/renderers/css/dist/navigation.js';

/** A camera within this many pixels of a pair's centre already looks at it; no turn is needed. */
const AIMED_AT_CENTER_PIXELS = 2;

/** Application routing over prepared physical frames. The CSS scene owns every camera write. */
export function createPreparedWorldNavigation({ objects, windowTarget = window, documentTarget = document,
  systemRadii = SYSTEM_FRAMING_RADII, systemViews = SYSTEM_VIEWS, systemCenters = SYSTEM_CENTERS, stellarSystems = STELLAR_SYSTEMS }: {objects: readonly (Pick<ObjectEntry, 'id' | 'worldFrame'> & Partial<Pick<ObjectEntry, 'discovery'>>)[]; windowTarget?: Window; documentTarget?: Document; systemRadii?: typeof SYSTEM_FRAMING_RADII; systemViews?: typeof SYSTEM_VIEWS; systemCenters?: typeof SYSTEM_CENTERS; stellarSystems?: ReadonlySet<string>}) {
  const frames = new Map(objects.map(object => [object.id, object.worldFrame]));
  const arrivals = new Map(objects.map(object => [object.id, object.discovery?.arrival]));
  function selectionTarget(from: WorldCamera, frame: WorldFrame, optics: Optics, id: string, lens?: string | null) {
    const framed = createWorldSelectionTarget(from, frame, optics), arrival = arrivals.get(id);
    if (!arrival || !arrival.lensIds.includes(lens ?? arrival.defaultLens)) return framed;
    const distanceUnits = presentWorldCamera(framed, frame, optics).distanceUnits;
    return worldCameraFromCenteredPresentation({ rotation: arrival.rotation, distanceUnits }, frame, optics);
  }
  let lastCamera: WorldCamera | null = null, lastOptics: Optics | null = null;
  const supports = (from: string, to: string) => {
    const a = frames.get(from), b = frames.get(to);
    return Boolean(a && b && a.referenceFrame === b.referenceFrame && a.epochJdTt === b.epochJdTt);
  };
  return Object.freeze({ supports,
    centerTarget({ objectId, fromId, mount, force = false }: TargetRequest) {
      const owner = mount?.navigation, frame = frames.get(objectId);
      const from = owner?.capture() ?? lastCamera, optics = owner?.optics() ?? lastOptics;
      const sourceFrame = owner?.frame ?? frames.get(fromId);
      if (!from || !optics || !frame || !sourceFrame) return null;
      const projection = presentWorldCamera(from, frame, optics);
      const current = presentWorldCamera(from, sourceFrame, optics);
      const silhouette = projection.silhouette ?? current.silhouette;
      if (!force && (!silhouette || 2 * silhouette.tangentialSemiAxis > optics.detailHandoffDiameterPixels
        || current.distanceM <= frame.bodyRadiusM)) return null;
      // A reset from a small body's close-up must remain outside the Sun.
      const minimumDistance = force ? frame.bodyRadiusM * 2 : 0;
      return worldCameraFromCenteredPresentation({ rotation: projection.rotation,
        distanceUnits: Math.max(current.distanceM, minimumDistance) / frame.metersPerUnit }, frame, optics);
    },
    overviewTarget({ scope, objectId, fromId, mount }: TargetRequest & {scope: string}) {
      if (scope === 'system') {
        const world = this.systemTarget({ objectId, fromId, mount, force: true });
        return world ? { world, focusPositionM: frames.get(objectId)!.originM } : null;
      }
      if (!['milky-way', 'local-group', 'nearby-universe'].includes(scope)) return null;
      const owner = mount?.navigation;
      const from = owner?.capture() ?? lastCamera, optics = owner?.optics() ?? lastOptics;
      if (!from || !optics) return null;
      if (scope === 'local-group' || scope === 'nearby-universe') {
        const frame = frames.get(objectId);
        if (!frame) return null;
        const projection = presentWorldCamera(from, frame, optics);
        const distanceM = (scope === 'local-group' ? 1e6 : 1e8) * 3.085677581491367e16;
        return { world: worldCameraFromCenteredPresentation({ rotation: projection.rotation,
          distanceUnits: distanceM / frame.metersPerUnit }, frame, optics), focusPositionM: frame.originM };
      }
      return volumeZoomTarget(from, GALACTIC_VOLUME, optics, systemFramingRect(optics, documentTarget),
        (owner?.frame ?? frames.get(fromId))!.originM);
    },
    /** Turn onto a bound pair's centre of mass, keeping the distance: a binary's overview is centred on the pair, not on the
     * star the scene mounts. Null when the system has no companion, or when the camera already looks at that centre. */
    systemCenterTarget({ objectId, mount }: TargetRequest) {
      const pair = systemCenters.get(objectId), frame = frames.get(objectId), owner = mount?.navigation;
      const from = owner?.capture() ?? lastCamera, optics = owner?.optics() ?? lastOptics;
      if (!pair || !frame || !from || !optics) return null;
      const centerFrame = { ...frame, originM: pair.centerM };
      const projection = presentWorldCamera(from, centerFrame, optics);
      const [ox, oy] = optics.principalOffsetPixels ?? [0, 0];
      // Closer than the stars are to each other, the pair is not a pair on screen: the star the scene mounts stays the subject.
      if (projection.distanceM < pair.separationM) return null;
      if (!projection.centerPixels || Math.hypot(projection.centerPixels[0] - ox, projection.centerPixels[1] - oy) <= AIMED_AT_CENTER_PIXELS) return null;
      return { world: worldCameraFromCenteredPresentation({ rotation: projection.rotation, distanceUnits: projection.distanceUnits }, centerFrame, optics),
        focusPositionM: pair.centerM };
    },
    systemTarget({ objectId, fromId, mount, force = false }: TargetRequest) {
      const owner = mount?.navigation, frame = frames.get(objectId);
      const from = owner?.capture() ?? lastCamera, optics = owner?.optics() ?? lastOptics;
      if (!from || !optics || !frame) return null;
      if (!force && objectId === fromId && bodyCardViewAtCamera(from, frame, optics, objectId) === 'detail') return null;
      // Frame the larger moons on first selection; a repeat uses normal focus.
      const view = systemViews.get(objectId);
      const systemRadius = systemRadii.get(objectId);
      if (view) return systemViewTarget(from, frame, optics, view, systemFramingRect(optics, documentTarget),
        systemOverviewDistance(frame.bodyRadiusM, systemRadius ?? frame.bodyRadiusM, optics), stellarSystems.has(objectId), SYSTEM_RANGES.get(objectId));
      return systemRadius || force ? createWorldSelectionTarget(from, { ...frame,
        bodyRadiusM: systemRadius ?? frame.bodyRadiusM,
      }, optics) : selectionTarget(from, frame, optics, objectId);
    },
    /** The world camera a URL's saved view names on the mounted object, or null without one.
     * An invalid view, or one from another prepared date, restores and reports as before, without a flight. */
    savedTarget({ objectId, url, mount }: { objectId: string; url: string; mount?: ShellCamera | null }) {
      const owner = mount?.navigation, frame = frames.get(objectId), query = new URL(url).searchParams;
      if (!owner || !frame || query.getAll('v').length !== 1) return null;
      try {
        const saved = parseSharedView(`v=${query.get('v')}`);
        return saved ? savedWorldCamera(saved, frame, owner.optics()) : null;
      } catch { return null; }
    },
    async focus({ objectId, mount, signal, reducedMotion = false, targetWorldCamera = null, targetFocusPositionM = null, centerSelection = false, timing = { mark() {} } }: FocusRequest) {
      const owner = mount?.navigation, frame = frames.get(objectId);
      if (!owner || !frame) throw new TypeError('Object focus requires its mounted prepared camera.');
      const from = owner.capture(), optics = owner.optics();
      const target = targetWorldCamera ?? selectionTarget(from, frame, optics, objectId);
      const flight = createSelectionFlight({ from: from.pose, to: target.pose, focusPositionM: targetFocusPositionM ?? frame.originM,
        durationS: centerSelection ? CENTER_SELECTION_DURATION_SECONDS : undefined });
      owner.setPreparedFocus?.(null);
      const running = createWorldFlight({ owner, from, flight,
        anchors: [{ positionM: frame.originM, radiusM: frame.bodyRadiusM }], signal, reducedMotion,
        windowTarget, documentTarget, onPaint(world) {
          lastCamera = world;
          if (world.pose.positionM.some((value, axis) => value !== from.pose.positionM[axis]) ||
              world.pose.orientationXyzw.some((value, axis) => value !== from.pose.orientationXyzw[axis])) timing.mark('first-motion');
        } });
      if (!(await running.finished).completed) throw cancellationReason(running.signal);
      lastCamera = owner.capture(); lastOptics = owner.optics();
    },
    async prepare({ fromId, toId, fromMount, toFactory, signal, reducedMotion, url, targetWorldCamera = null, targetFocusPositionM = null, centerSelection = false, preserveView = false, presentWorld = null, cameraViewport, timing = { mark() {} } }: PrepareRequest): Promise<WorldHandoff> {
      if (!supports(fromId, toId)) throw new TypeError('Objects do not share a prepared world frame.');
      const targetFrame = frames.get(toId)!;
      const source = fromMount?.navigation;
      const from = source?.capture() ?? lastCamera;
      const optics = source?.optics() ?? lastOptics;
      if (!from || !optics) throw new Error('The drawn world camera is not ready.');
      source?.setPreparedFocus?.(null);
      lastCamera = from; lastOptics = optics;
      if (preserveView) {
        // Input stays live while the new detail bank loads. Snapshot the last
        // drawn camera at handoff, not the camera from the start of preparation.
        const factory = await toFactory;
        if (!factory.navigation) throw new TypeError('Destination has no prepared navigation.');
        const ownership = createPreparedSceneOwnership(signal);
        try {
          const prepared = await factory.navigation.prepare({ signal: ownership.signal, cameraViewport,
            getView: () => ({ world: source?.capture() ?? lastCamera ?? from, viewport: source?.optics() ?? lastOptics ?? optics }) });
          ownership.own(prepared);
          if (signal.aborted) throw cancellationReason(signal);
          timing.mark('assets-ready');
          const checkpoint = source?.capture() ?? lastCamera ?? from;
          return {
            transferTo: ownership.transferTo,
            mountOptions: { preparedResources: prepared.resources, preparedTree: prepared.tree, initialWorldCamera: checkpoint, initialProjection: prepared.projection({ world: checkpoint, viewport: source?.optics() ?? lastOptics ?? optics }) },
            async afterMount(mount: ObjectSceneLifecycle) {
              if (signal.aborted) throw cancellationReason(signal);
              timing.mark('mounted');
              if (!mount.navigation) throw new Error('The destination camera is unavailable.');
              lastCamera = mount.navigation.capture(); lastOptics = mount.navigation.optics();
            },
          };
        } catch (error) { ownership.dispose(); throw error; }
      }

      const query = url ? new URL(url).searchParams : null;
      if ((query?.getAll('v').length ?? 0) > 1) throw new TypeError('A destination URL may contain only one saved view.');
      const saved = query?.has('v') ? parseSharedView(`v=${query.get('v')}`) : null;
      const target = targetWorldCamera ?? (saved ? savedWorldCamera(saved, targetFrame, optics)
        : selectionTarget(from, targetFrame, optics, toId, query?.get('dataset')));
      // One numeric flight survives the change of detailed object owner.
      const flight = createSelectionFlight({ from: from.pose, to: target.pose,
        focusPositionM: targetFocusPositionM ?? targetFrame.originM, durationS: centerSelection ? CENTER_SELECTION_DURATION_SECONDS : undefined });
      const anchors = [frames.get(fromId)!, targetFrame].map(frame => ({
        positionM: frame.originM, radiusM: frame.bodyRadiusM,
      }));
      const handoffTimeS = source && !reducedMotion
        ? detailHandoffTime(flight, from, source.frame, optics) : 0;
      // A replacement can arrive while the previous detail is still activating.
      // Its retirement must not retire the application's camera progression.
      const departureOwner = source ?? (presentWorld ? { apply(world: WorldCamera) {
        return presentWorld(world, optics, { signal: running.signal });
      } } : null);
      const approachLimitS = departureOwner && !reducedMotion
        ? destinationDetailTime(flight, from, targetFrame, optics) : 0;
      const ownership = createPreparedSceneOwnership(signal);
      let handedOff = false, bankReady = false, detailReady = false, moved = false, approaching = false;
      let incomingOwner: ObjectWorldNavigation | null = null;
      // Cancels only a publication superseded by the fully active detail. The
      // flight itself retains its clock, input policy and completion promise.
      const activation = new AbortController();
      let reachHandoff!: () => void;
      const handoffReady = new Promise<void>(resolve => { reachHandoff = resolve; });
      let departureHeld = !departureOwner || Boolean(reducedMotion);
      if (departureHeld) reachHandoff();
      let drawn = reducedMotion ? target : from;
      const running = createWorldFlight({ from, flight, anchors, signal, reducedMotion,
        paused: departureHeld, windowTarget, documentTarget,
        limitElapsedS: () => detailReady || incomingOwner?.detailActivated?.() ? flight.durationS : approachLimitS,
        canFinish: () => detailReady,
        interruptible: () => !moved || approaching,
        owner: { apply(world) {
          if (!handedOff) return departureOwner?.apply(world, { signal: running.signal });
          if (detailReady) return incomingOwner!.apply(world, { signal: running.signal });
          return presentWorld?.(world, optics, { signal: activationSignal,
            commit: () => incomingOwner?.apply(world) });
        } },
        onPaint(world, elapsedS) {
          drawn = lastCamera = world;
          approaching = elapsedS >= approachLimitS;
          if (!moved && (world.pose.positionM.some((value, axis) => value !== from.pose.positionM[axis]) ||
              world.pose.orientationXyzw.some((value, axis) => value !== from.pose.orientationXyzw[axis]))) {
            moved = true; timing.mark('first-motion');
          }
          if (!departureHeld && (approaching || bankReady && elapsedS >= handoffTimeS)) {
            departureHeld = true;
            running.hold(elapsedS);
            reachHandoff();
          }
        },
      });
      const activationSignal = AbortSignal.any([running.signal, activation.signal]);
      const interrupted = running.finished.then(() => {
        if (!handedOff) ownership.dispose();
        throw cancellationReason(running.signal);
      }, error => {
        if (!handedOff) ownership.dispose();
        throw error;
      });
      void interrupted.catch(() => {});
      const wait = <T,>(task: Promise<T>): Promise<T> => Promise.race([task, interrupted]);
      const preparation = Promise.resolve(toFactory).then(factory => {
        if (!factory.navigation) throw new TypeError('Destination has no prepared navigation.');
        return factory.navigation.prepare({ signal: ownership.signal, cameraViewport,
          getView: () => ({ world: drawn, viewport: optics }) });
      }).then(value => {
        ownership.own(value);
        if (running.signal.aborted) { ownership.dispose(); throw cancellationReason(running.signal); }
        bankReady = true;
        return value;
      });
      try {
        const [preparedLease] = await wait(Promise.all([preparation, handoffReady]));
        // Freeze the acknowledged pose until its exact material demand is ready.
        // This holds the existing flight; no segment or replacement clock starts.
        await wait(preparedLease.prepareView(() => ({ world: drawn, viewport: optics })));
        timing.mark('assets-ready');
        handedOff = true;
        const initialWorldCamera = drawn;
        const progressive = Boolean(presentWorld && !reducedMotion);
        if (progressive) running.resume();
        return {
          transferTo: ownership.transferTo,
          mountOptions: { preparedResources: preparedLease.resources, preparedTree: preparedLease.tree,
            initialWorldCamera, initialProjection: preparedLease.projection({ world: initialWorldCamera, viewport: optics }),
            arrivingByFlight: true,
            ...(progressive ? { progressiveActivation: approachLimitS > 0, onNavigationReady(owner: ObjectWorldNavigation) {
              if (running.signal.aborted) return;
              incomingOwner = owner; owner.apply(drawn);
            } } : {}) },
          async afterMount(mount: ObjectSceneLifecycle, { signal: mountedSignal }: {signal: AbortSignal}) {
            const cancelMounted = () => running.cancel(mountedSignal.reason);
            mountedSignal.addEventListener('abort', cancelMounted, { once: true });
            if (mountedSignal.aborted) cancelMounted();
            try {
              if (running.signal.aborted) throw cancellationReason(running.signal);
              if (!mount.navigation) throw new Error('The destination camera is unavailable.');
              timing.mark('mounted');
              incomingOwner = mount.navigation; detailReady = true;
              activation.abort();
              incomingOwner.apply(drawn);
              if (reducedMotion) running.complete(); else running.resume();
              if (!(await running.finished).completed) throw cancellationReason(running.signal);
              lastCamera = incomingOwner.capture(); lastOptics = incomingOwner.optics();
            } catch (error) { running.cancel(error); throw error; }
            finally {
              const reason: unknown = running.signal.reason;
              mount.features?.setNavigationInFlight?.(false, !running.signal.aborted ||
                (reason instanceof Error && 'preserveView' in reason && reason.preserveView === true));
              mountedSignal.removeEventListener('abort', cancelMounted);
            }
          },
        };
      } catch (error) {
        running.cancel(error); ownership.dispose();
        throw error;
      }
    },
  });
}

// Last safe source-owned sample: the target still fits its prepared proxy.
function destinationDetailTime(flight: Flight, from: WorldCamera, frame: WorldFrame, optics: Optics) {
  const sample = createSelectionFlightSample(), limit = optics.detailHandoffDiameterPixels;
  const needsDetail = (elapsed: number) => {
    const projected = presentWorldCamera(worldSample(flight, from, elapsed, sample), frame, optics);
    const ellipse = projected.silhouette, center = projected.centerPixels;
    if (!ellipse || !center) return false;
    // A target crossing the eye plane far outside the viewport can have an
    // enormous projected ellipse. It does not require a visible detail mount.
    const radius = Math.max(ellipse.radialSemiAxis, ellipse.tangentialSemiAxis);
    if (Math.abs(center[0]) > (optics.widthPixels ?? Infinity) / 2 + radius ||
        Math.abs(center[1]) > (optics.heightPixels ?? Infinity) / 2 + radius) return false;
    return 2 * ellipse.tangentialSemiAxis > limit;
  };
  if (needsDetail(0)) return 0;
  let previous = 0;
  for (let step = 1; step <= 64; step++) {
    const elapsed = flight.durationS * step / 64;
    if (needsDetail(elapsed)) {
      let low = previous, high = elapsed;
      for (let iteration = 0; iteration < 32; iteration++) {
        const middle = (low + high) / 2;
        if (needsDetail(middle)) high = middle; else low = middle;
      }
      return low;
    }
    previous = elapsed;
  }
  return flight.durationS;
}

// Find the first coarse-source sample using the existing prepared LOD limit.
// Clamping the departure to this exact time also survives a delayed RAF: it
// cannot skip from the departure straight to a large destination proxy.
function detailHandoffTime(flight: Flight, from: WorldCamera, frame: WorldFrame, optics: Optics) {
  const limit = optics.detailHandoffDiameterPixels;
  if (!(Number.isFinite(limit) && limit > 0)) throw new TypeError('World navigation needs a prepared detail handoff diameter.');
  const sample = createSelectionFlightSample();
  const isCoarse = (elapsedS: number) => {
    const projected = presentWorldCamera(worldSample(flight, from, elapsedS, sample), frame, optics);
    return projected.silhouette === null || 2 * projected.silhouette.tangentialSemiAxis <= limit;
  };
  if (isCoarse(0)) return 0;
  let previous = 0;
  for (let step = 1; step <= 64; step++) {
    const elapsedS = flight.durationS * step / 64;
    if (isCoarse(elapsedS)) {
      let low = previous, high = elapsedS;
      for (let iteration = 0; iteration < 32; iteration++) {
        const middle = (low + high) / 2;
        if (isCoarse(middle)) high = middle; else low = middle;
      }
      return high;
    }
    previous = elapsedS;
  }
  // A saved view can stay beside the departing body. It has no small-source
  // interval; switch at departure so its destination still owns the approach.
  return 0;
}

function createWorldFlight({ owner, from, flight, anchors, signal, reducedMotion = false, paused = false,
  limitElapsedS = () => flight.durationS, canFinish = () => true,
  windowTarget, documentTarget, onPaint = () => {}, interruptible = () => true }: WorldFlightRequest) {
  let elapsedS = 0, publishedElapsed: number | null = null;
  const sample = createSelectionFlightSample();
  const events = ['pointerdown', 'keydown', 'wheel'];
  function input(event: Event) {
    if (!isFlightInput(event)) return;
    if (event.type === 'wheel' || !interruptible()) {
      event.preventDefault(); event.stopImmediatePropagation();
      running.hurry(FLIGHT_WHEEL_SPEEDUP);
    } else {
      const error = cancelled(); error.preserveView = true;
      running.cancel(error);
    }
  }
  const running = createCameraFlight({ windowTarget, signal, paused,
    onFinish() { for (const event of events) documentTarget.removeEventListener(event, input, { capture: true }); },
    advance(clockS, stepS) {
      const permittedEndS = reducedMotion ? flight.durationS : limitElapsedS();
      const requestedElapsedS = reducedMotion ? flight.durationS : Math.min(flight.durationS, permittedEndS, clockS);
      const previousElapsed = elapsedS;
      elapsedS = reducedMotion ? requestedElapsedS
        : advanceSelectionFlightInto(flight, anchors, elapsedS, requestedElapsedS, sample);
      if (!reducedMotion) elapsedS = easeArrivalInto(flight, previousElapsed, elapsedS, stepS, sample);
      if (permittedEndS >= flight.durationS && arrivalIsInvisible(flight, anchors, sample)) elapsedS = flight.durationS;
      const world = worldSample(flight, from, elapsedS, sample);
      const acknowledge = (shown = true) => {
        if (running.signal.aborted) return 'idle' as const;
        if (!shown) { elapsedS = previousElapsed; return 'idle' as const; }
        const changed = publishedElapsed !== elapsedS;
        if (changed) { publishedElapsed = elapsedS; onPaint(world, elapsedS); }
        return elapsedS >= flight.durationS && canFinish() ? 'complete' as const : changed ? 'presented' as const : 'idle' as const;
      };
      const publication = publishedElapsed !== elapsedS ? owner.apply(world, { signal: running.signal }) : undefined;
      return publication && typeof publication.then === 'function' ? publication.then(acknowledge) : acknowledge();
    },
  });
  if (!running.signal.aborted) for (const event of events) documentTarget.addEventListener(event, input, { capture: true, passive: false });
  return running;
}

function worldSample(flight: Flight, from: WorldCamera, elapsedS: number, sample: FlightSample): WorldCamera {
  sampleSelectionFlightInto(flight, elapsedS, sample);
  return { referenceFrame: from.referenceFrame, epochJdTt: from.epochJdTt,
    pose: { positionM: [...sample.positionM], orientationXyzw: [...sample.orientationXyzw] } };
}
// A flight held back by the clearance cap would meet its target at full speed and stop dead. The
// progress still to go may shrink at most at the arrival ease rate of flight-clock time, so the
// camera slows into place. Flights on schedule already slow more gently near their end.
function easeArrivalInto(flight: Flight, fromElapsedS: number, toElapsedS: number, clockStepS: number, out: FlightSample) {
  const at = (elapsedS: number) => sampleSelectionFlightInto(flight, elapsedS, out).progress;
  if (toElapsedS <= fromElapsedS) return toElapsedS;
  const from = at(fromElapsedS);
  let rate = FLIGHT_ARRIVAL_EASE_RATE;
  if (flight.curve.startRangeM > flight.curve.endRangeM) {
    const [x, y, z] = out.positionM, [fx, fy, fz] = flight.focusPositionM;
    const rangeM = Math.hypot(x - fx, y - fy, z - fz);
    const scale = flight.curve.endRangeM / rangeM;
    const { startScale, fullScale, settleScale, easeRate } = FLIGHT_VISIBLE_APPROACH;
    const blend = Math.max(0, Math.min(1, (scale - startScale) / (fullScale - startScale)));
    const settle = Math.max(0, Math.min(1, (scale - settleScale) / (1 - settleScale)));
    rate += (easeRate - rate) * blend * blend * (3 - 2 * blend) * (1 - settle * settle * (3 - 2 * settle));
  }
  const limit = from + (1 - Math.exp(-rate * Math.max(0, clockStepS))) * (1 - from);
  if (at(toElapsedS) <= limit) return toElapsedS;
  let low = fromElapsedS, high = toElapsedS;
  for (let iteration = 0; iteration < 32; iteration++) {
    const middle = (low + high) / 2;
    if (at(middle) <= limit) low = middle; else high = middle;
  }
  // Rounding at the very end can leave no representable progress under the limit. Holding back
  // there would stall the flight, and no visible motion is left to ease.
  if (!(at(low) > from) && clockStepS > 0) { at(toElapsedS); return toElapsedS; }
  return low;
}
// The rest of a flight is invisible once the camera is within the arrival tolerance of its final
// pose: that fraction of its depth to the nearest anchor surface, and that many radians of turn.
function arrivalIsInvisible(flight: Flight, anchors: FlightAnchors, sample: FlightSample) {
  const [x, y, z] = sample.positionM, end = flight.to.positionM, q = sample.orientationXyzw, r = flight.to.orientationXyzw;
  let depthM = Infinity;
  for (const anchor of anchors) depthM = Math.min(depthM, Math.hypot(x - anchor.positionM[0], y - anchor.positionM[1], z - anchor.positionM[2]) - anchor.radiusM);
  const cosine = Math.min(1, Math.abs(q[0] * r[0] + q[1] * r[1] + q[2] * r[2] + q[3] * r[3]));
  return depthM > 0 && Math.hypot(x - end[0], y - end[1], z - end[2]) <= FLIGHT_ARRIVAL_TOLERANCE * depthM
    && 2 * Math.acos(cosine) <= FLIGHT_ARRIVAL_TOLERANCE;
}
function isFlightInput(event: Event) {
  const target = event.target;
  return target && 'closest' in target && typeof target.closest === 'function' && Boolean(target.closest('.object-input-surface, .object-surface-minimap')) &&
    (event.type !== 'keydown' || 'key' in event && typeof event.key === 'string' && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '-', '=', 'Escape'].includes(event.key));
}
function cancellationReason(signal: AbortSignal): unknown {
  const reason: unknown = signal.reason;
  return reason && typeof reason === 'object' && 'name' in reason && reason.name === 'AbortError' ? reason : cancelled();
}
function cancelled(): DOMException & {preserveView?: boolean} { return new DOMException('Object flight was cancelled.', 'AbortError'); }
