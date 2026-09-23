import { createPreparedSceneOwnership } from './prepared-scene-ownership.mts';
import type { ObjectEntry } from './object-schema.mts';
import type { SceneFactory, ShellCamera, MountOptions } from './browser-types.mts';
import type { ObjectWorldNavigation } from '../src/renderers/css/runtime/world-navigation-types.ts';
import type { ObjectSceneLifecycle } from '../src/renderers/css/runtime/deferred-object-mount.ts';
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
interface FlightCheckpoint {world: WorldCamera; elapsedS: number; time?: number;}
/** Shared by every segment of one navigation, so a wheel keeps hurrying it across the handoff. */
interface FlightPace {speed: number;}
interface WorldFlightRequest {owner: Pick<ObjectWorldNavigation, 'apply'>; from: WorldCamera; flight: Flight; anchors: FlightAnchors; signal: AbortSignal; reducedMotion?: boolean; startElapsedS?: number; endElapsedS?: number; startTime?: number | null; limitElapsedS?: () => number; windowTarget: Pick<Window, 'requestAnimationFrame' | 'cancelAnimationFrame' | 'performance'>; documentTarget: Pick<Document, 'addEventListener' | 'removeEventListener'>; onPaint?: (world: WorldCamera, elapsedS: number) => void; stopWhen?: (elapsedS: number) => boolean; pace?: FlightPace;}

import { CENTER_SELECTION_DURATION_SECONDS, FLIGHT_ARRIVAL_EASE_RATE, FLIGHT_ARRIVAL_TOLERANCE, FLIGHT_VISIBLE_APPROACH, FLIGHT_WHEEL_SPEEDUP } from './runtime-policy.mts';
import { STELLAR_SYSTEMS, SYSTEM_CENTERS, SYSTEM_FRAMING_RADII, SYSTEM_RANGES, SYSTEM_VIEWS, SYSTEM_VIEW_HOSTS, GALACTIC_VOLUME, volumeZoomTarget, systemFramingRect, systemViewTarget, systemOverviewDistance } from './system-framing.mts';
import { bodyCardViewAtCamera } from './overview-context.mts';
import { createSelectionFlight, sampleSelectionFlightInto, createSelectionFlightSample, advanceSelectionFlightInto } from '@cssearth/engine';
import { createWorldSelectionTarget, worldCameraFromCenteredPresentation, savedWorldCamera, parseSharedView, presentWorldCamera } from '../src/renderers/css/dist/navigation.js';

/** A camera within this many pixels of a pair's centre already looks at it; no turn is needed. */
const AIMED_AT_CENTER_PIXELS = 2;

/** Application routing over prepared physical frames. The CSS scene owns every camera write. */
export function createPreparedWorldNavigation({ objects, windowTarget = window, documentTarget = document,
  systemRadii = SYSTEM_FRAMING_RADII, systemViews = SYSTEM_VIEWS, systemViewHosts = SYSTEM_VIEW_HOSTS, systemCenters = SYSTEM_CENTERS, stellarSystems = STELLAR_SYSTEMS }: {objects: readonly (Pick<ObjectEntry, 'id' | 'worldFrame'> & Partial<Pick<ObjectEntry, 'discovery'>>)[]; windowTarget?: Window; documentTarget?: Document; systemRadii?: typeof SYSTEM_FRAMING_RADII; systemViews?: ReadonlyMap<string, Parameters<typeof systemViewTarget>[3]>; systemViewHosts?: ReadonlySet<string>; systemCenters?: typeof SYSTEM_CENTERS; stellarSystems?: ReadonlySet<string>}) {
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
      if (!view && systemViewHosts.has(objectId)) throw new Error(`System view candidates for ${objectId} are not loaded; navigation awaits loadSystemViews first.`);
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
      await animateWorldFlight({ owner, from, flight,
        anchors: [{ positionM: frame.originM, radiusM: frame.bodyRadiusM }], signal, reducedMotion,
        windowTarget, documentTarget, onPaint(world) {
          lastCamera = world;
          if (world.pose.positionM.some((value, axis) => value !== from.pose.positionM[axis]) ||
              world.pose.orientationXyzw.some((value, axis) => value !== from.pose.orientationXyzw[axis])) timing.mark('first-motion');
        } });
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
        return presentWorld(world, optics, { signal: controller.signal });
      } } : null);
      const approachLimitS = departureOwner && !reducedMotion
        ? destinationDetailTime(flight, from, targetFrame, optics) : 0;
      const controller = new AbortController();
      const cancel = () => controller.abort(signal.reason ?? cancelled());
      signal.addEventListener('abort', cancel, { once: true });
      if (signal.aborted) cancel();
      // After handoff the router owns the prepared lease until it mounts; input that ends the
      // flight in that gap must not release what the mount is about to claim.
      const ownership = createPreparedSceneOwnership(signal);
      let handedOff = false;
      const events = ['pointerdown', 'keydown'];
      // Stopping between bodies strands the camera far from the destination, often facing
      // along its path with the target off screen. Input there hurries the navigation like
      // a wheel; it stops the view only before any motion or once the approach is drawn.
      let moved = false, approaching = false;
      const interrupt = (event: Event) => {
        if (!isFlightInput(event)) return;
        if (moved && !approaching) {
          event.preventDefault(); event.stopImmediatePropagation();
          pace.speed = FLIGHT_WHEEL_SPEEDUP;
          return;
        }
        const error = cancelled(); error.preserveView = true;
        controller.abort(error);
      };
      // A wheel hurries this navigation instead of abandoning it far from the destination.
      // The navigation listens before its flights do, so it owns the wheel for every segment.
      const pace: FlightPace = { speed: 1 };
      const hurry = (event: Event) => {
        if (!isFlightInput(event)) return;
        event.preventDefault(); event.stopPropagation();
        pace.speed = FLIGHT_WHEEL_SPEEDUP;
      };
      for (const event of events) documentTarget.addEventListener(event, interrupt, { capture: true });
      documentTarget.addEventListener('wheel', hurry, { capture: true, passive: false });
      let rejectInterruption!: (reason: unknown) => void;
      const release = ownership.dispose;
      const interrupted = new Promise<never>((_, reject) => { rejectInterruption = reject; });
      interrupted.catch(() => {});
      const abort = () => { if (!handedOff) release(); rejectInterruption(cancellationReason(controller.signal)); cleanup(); };
      controller.signal.addEventListener('abort', abort, { once: true });
      if (controller.signal.aborted) abort();
      function cleanup() {
        signal.removeEventListener('abort', cancel);
        controller.signal.removeEventListener('abort', abort);
        for (const event of events) documentTarget.removeEventListener(event, interrupt, { capture: true });
        documentTarget.removeEventListener('wheel', hurry, { capture: true });
      }
      let bankReady = false;
      const preparation = Promise.resolve(toFactory).then(factory => {
        if (!factory.navigation) throw new TypeError('Destination has no prepared navigation.');
        return factory.navigation.prepare({ signal: ownership.signal, cameraViewport,
          getView: () => ({ world: reducedMotion ? target : lastCamera ?? from, viewport: optics }) });
      }).then(value => {
        ownership.own(value);
        if (controller.signal.aborted) { release(); throw cancellationReason(controller.signal); }
        bankReady = true;
        return value;
      });
      preparation.catch(() => {});
      const onPaint = (world: WorldCamera, elapsedS: number) => {
        lastCamera = world;
        if (elapsedS >= approachLimitS) approaching = true;
        if (!moved && (world.pose.positionM.some((value, axis) => value !== from.pose.positionM[axis]) ||
            world.pose.orientationXyzw.some((value, axis) => value !== from.pose.orientationXyzw[axis]))) {
          moved = true; timing.mark('first-motion');
        }
      };
      try {
        // Keep moving with the current owner while the bank loads. Transfer as
        // soon as it is ready and the source is coarse, or hold before the
        // destination proxy would grow into a detailed view.
        const departure: Promise<FlightCheckpoint> = departureOwner && !reducedMotion
          ? animateWorldFlight({ owner: departureOwner, from, flight, anchors, signal: controller.signal, pace,
            endElapsedS: approachLimitS,
            stopWhen: elapsed => bankReady && elapsed >= handoffTimeS,
            windowTarget, documentTarget, onPaint })
          : Promise.resolve({ world: reducedMotion ? target : from, elapsedS: reducedMotion ? flight.durationS : 0 });
        const [preparedLease, checkpoint] = await Promise.race([Promise.all([preparation, departure]), interrupted]);
        // A final RAF can cross a material boundary after preparation resolves.
        // Keep the existing scene until this exact drawn view is decoded too.
        await preparedLease.prepareView(() => ({ world: checkpoint.world, viewport: optics }));
        if (controller.signal.aborted) throw cancellationReason(controller.signal);
        timing.mark('assets-ready');
        // Camera progression belongs to the application, not to the lifetime
        // of a detailed object. Keep presenting the coarse world while the
        // destination activates its prepared groups over successive paints.
        let incomingOwner: ObjectWorldNavigation | null = null, detailReady = false;
        const activation = new AbortController();
        const activationSignal = AbortSignal.any([controller.signal, activation.signal]);
        const continuation = presentWorld && !reducedMotion && checkpoint.elapsedS < flight.durationS
          ? animateWorldFlight({ owner: { apply(world: WorldCamera) {
              if (detailReady) return incomingOwner?.apply(world, { signal: controller.signal });
              // The activating detail and the surrounding world share the
              // worker's publication, instead of racing two camera owners.
              return presentWorld(world, optics, { signal: activationSignal,
                commit: () => incomingOwner?.apply(world) });
            } }, from, flight, anchors, signal: controller.signal, pace,
            startElapsedS: checkpoint.elapsedS, startTime: checkpoint.time ?? null,
            // The approach holds only until the incoming detail is fully active.
            limitElapsedS: () => detailReady || incomingOwner?.detailActivated?.() ? flight.durationS : Math.max(checkpoint.elapsedS, approachLimitS),
            windowTarget, documentTarget, onPaint }) : null;
        continuation?.catch(() => {});
        handedOff = true;
        return {
          transferTo: ownership.transferTo,
          mountOptions: { preparedResources: preparedLease.resources, preparedTree: preparedLease.tree, initialWorldCamera: checkpoint.world, initialProjection: preparedLease.projection({ world: checkpoint.world, viewport: optics }),
            // The destination holds its catalogue load until this flight ends; see afterMount.
            arrivingByFlight: true,
            ...(continuation ? { progressiveActivation: approachLimitS > 0, onNavigationReady(owner: ObjectWorldNavigation) {
              // An interrupted flight still mounts its destination; afterMount reports the interruption.
              if (controller.signal.aborted) return;
              incomingOwner = owner; owner.apply(lastCamera ?? from);
            } } : {}) },
          async afterMount(mount: ObjectSceneLifecycle, { signal: mountedSignal }: {signal: AbortSignal}) {
            const cancelMounted = () => controller.abort(mountedSignal.reason ?? cancelled());
            mountedSignal.addEventListener('abort', cancelMounted, { once: true });
            if (mountedSignal.aborted) cancelMounted();
            try {
              if (controller.signal.aborted) throw cancellationReason(controller.signal);
              if (!mount.navigation) throw new Error('The destination camera is unavailable.');
              timing.mark('mounted');
              if (continuation) {
                incomingOwner = mount.navigation; detailReady = true;
                activation.abort();
                incomingOwner.apply(lastCamera ?? from);
                await continuation;
              } else if (checkpoint.elapsedS < flight.durationS) {
                mount.navigation.apply(checkpoint.world);
                await animateWorldFlight({ owner: mount.navigation, from, flight, anchors, signal: controller.signal, pace,
                  startElapsedS: checkpoint.elapsedS, windowTarget, documentTarget, onPaint });
              } else mount.navigation.apply(checkpoint.world);
              lastCamera = mount.navigation.capture(); lastOptics = mount.navigation.optics();
            } finally {
              // The flight ended. The destination stays on screen when it landed or the visitor stopped it (preserveView);
              // a navigation that replaced it will retire it, so the loads it held are dropped.
              const reason: unknown = controller.signal.reason;
              mount.features?.setNavigationInFlight?.(false, !controller.signal.aborted ||
                (reason instanceof Error && 'preserveView' in reason && reason.preserveView === true));
              mountedSignal.removeEventListener('abort', cancelMounted);
              cleanup();
            }
          },
        };
      } catch (error) {
        controller.abort(error); release(); cleanup();
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

export function animateWorldFlight({ owner, from, flight, anchors, signal, reducedMotion = false,
  startElapsedS = 0, endElapsedS = flight.durationS, startTime = null, limitElapsedS = () => endElapsedS,
  windowTarget, documentTarget, onPaint = () => {}, stopWhen = () => false, pace = { speed: 1 } }: WorldFlightRequest): Promise<FlightCheckpoint> {
  return new Promise<FlightCheckpoint>((resolve, reject) => {
    let frameId: number | null = null, started = startTime, finished = false, elapsedS = startElapsedS, publishedElapsed: number | null = null;
    // Flight time runs on its own clock, so a wheel can hurry the arrival without a jump.
    let clockS = 0, clockTime: number | null = null;
    const sample = createSelectionFlightSample();
    const events = ['pointerdown', 'keydown'];
    function finish(error: unknown, result?: FlightCheckpoint) {
      if (finished) return;
      finished = true;
      if (frameId !== null) windowTarget.cancelAnimationFrame(frameId);
      signal.removeEventListener('abort', abort);
      for (const event of events) documentTarget.removeEventListener(event, interrupt, { capture: true });
      documentTarget.removeEventListener('wheel', hurry, { capture: true });
      if (error || !result) reject(error); else resolve(result);
    }
    function abort() { finish(cancellationReason(signal)); }
    function interrupt(event: Event) {
      if (!isFlightInput(event)) return;
      const error = cancelled(); error.preserveView = true;
      finish(error);
    }
    // A wheel asks to get there, not to stop. The flight speeds up and swallows the
    // wheel, so zoom starts from the arrival framing instead of fighting the flight.
    function hurry(event: Event) {
      if (!isFlightInput(event)) return;
      event.preventDefault(); event.stopPropagation();
      pace.speed = FLIGHT_WHEEL_SPEEDUP;
    }
    function paint(time: number) {
      frameId = null;
      if (finished) return;
      try {
        if (started === null) started = time;
        const previousClockS = clockS;
        if (clockTime === null) clockS = (time - started) / 1000;
        else clockS += (time - clockTime) / 1000 * pace.speed;
        clockTime = time;
        const permittedEndS = reducedMotion ? endElapsedS : limitElapsedS();
        const requestedElapsedS = reducedMotion ? endElapsedS
          : Math.min(endElapsedS, permittedEndS, startElapsedS + clockS);
        const previousElapsed = elapsedS;
        elapsedS = reducedMotion ? requestedElapsedS
          : advanceSelectionFlightInto(flight, anchors, elapsedS, requestedElapsedS, sample);
        if (!reducedMotion) elapsedS = easeArrivalInto(flight, previousElapsed, elapsedS, clockS - previousClockS, sample);
        // The curve approaches its terminal pose exponentially; its last second or so moves the
        // view by under a pixel. Finish once the rest is invisible instead of publishing that
        // tail. Rounded progress is no signal: from galactic range it reaches 1 while the camera
        // is still thousands of kilometres out. A detail readiness hold must still be respected.
        if (endElapsedS === flight.durationS && permittedEndS >= endElapsedS &&
            arrivalIsInvisible(flight, anchors, sample)) elapsedS = endElapsedS;
        const world = worldSample(flight, from, elapsedS, sample);
        const advance = (shown = true, continueNow = false) => {
          if (finished) return;
          if (!shown) elapsedS = previousElapsed;
          else {
            if (publishedElapsed !== elapsedS) { onPaint(world, elapsedS); publishedElapsed = elapsedS; }
            if (elapsedS >= endElapsedS || stopWhen(elapsedS)) { finish(null, { world, elapsedS, time }); return; }
          }
          // An asynchronous publication already crossed its presentation rAF.
          // Plan the next pose now, so a second admission rAF cannot halve the
          // flight cadence. A stationary readiness hold still sleeps on rAF.
          if (continueNow && shown) paint(windowTarget.performance.now());
          else frameId = windowTarget.requestAnimationFrame(paint);
        };
        const publication = publishedElapsed !== elapsedS ? owner.apply(world, { signal }) : undefined;
        if (publication && typeof publication.then === 'function') publication.then(shown => advance(shown, true)).catch(finish);
        else advance();
      } catch (error) { finish(error); }
    }
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) { abort(); return; }
    for (const event of events) documentTarget.addEventListener(event, interrupt, { capture: true });
    documentTarget.addEventListener('wheel', hurry, { capture: true, passive: false });
    frameId = windowTarget.requestAnimationFrame(paint);
  });
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
