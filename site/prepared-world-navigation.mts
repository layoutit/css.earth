import { namesSystem } from './navigation/navigation-scope.mts';
import { satelliteSystemByHost } from './satellite-systems.mts';
import { eyeDistanceM, sameEyePlace } from '@cssearth/engine';
import { createZoomCarry } from './world/zoom-carry.mts';
import { createPreparedSceneOwnership } from './navigation/prepared-scene-ownership.mts';
import { createPreparedArrival } from './navigation/prepared-arrival.mts';
import { canUseArrivalBillboard, frameArrivalBillboard, prepareArrivalBillboard } from './navigation/arrival-billboard.mts';
import type { ObjectEntry } from './objects.mts';
import type { SceneFactory, ShellCamera, MountOptions } from './browser/browser-types.mts';
import type { ObjectWorldNavigation } from '@cssearth/renderer/runtime/world-navigation-types.ts';
import type { ObjectSceneLifecycle } from '@cssearth/renderer/runtime/object-scene.ts';
type WorldCamera = Parameters<typeof presentWorldCamera>[0];
type WorldFrame = Parameters<typeof presentWorldCamera>[1];
type Optics = ReturnType<ObjectWorldNavigation['optics']>;
type Flight = ReturnType<typeof createSelectionFlight>;
type FlightSample = ReturnType<typeof createSelectionFlightSample>;
type FlightAnchors = Parameters<typeof advanceSelectionFlightInto>[1];
interface Timing {mark(name: string): void;}
interface TargetRequest {objectId: string; fromId: string; mount?: ShellCamera | null; force?: boolean;}
import type { WorldHandoff } from './navigation/navigation-types.mts';
export type { WorldHandoff } from './navigation/navigation-types.mts';
interface FocusRequest {objectId: string; mount: ShellCamera; signal: AbortSignal; reducedMotion?: boolean; targetWorldCamera?: WorldCamera | null; targetFocusPositionM?: WorldFrame['originM'] | null; centerSelection?: boolean; timing?: Timing;}
interface PrepareRequest {fromId: string; toId: string; fromMount: ShellCamera | null; toFactory: SceneFactory | Promise<SceneFactory>; signal: AbortSignal; stage?: HTMLElement; reducedMotion?: boolean; url?: string | URL | null; targetWorldCamera?: WorldCamera | null; targetFocusPositionM?: WorldFrame['originM'] | null; centerSelection?: boolean; preserveView?: boolean; presentWorld?: ((world: WorldCamera, optics: Optics, options: { signal: AbortSignal; commit?: () => void }) => Promise<boolean> | void) | null; cameraViewport?: Parameters<NonNullable<SceneFactory['navigation']>['prepare']>[0]['cameraViewport']; timing?: Timing;}
interface WorldFlightRequest {
  motion: ReturnType<typeof createCameraMotion>;
  owner: Pick<ObjectWorldNavigation, 'apply'>; from: WorldCamera; flight: Flight; anchors: FlightAnchors; signal: AbortSignal;
  reducedMotion?: boolean; paused?: boolean; limitElapsedS?: () => number; canFinish?: () => boolean;
  windowTarget: Pick<Window, 'requestAnimationFrame' | 'cancelAnimationFrame' | 'performance'>;
  documentTarget: Pick<Document, 'addEventListener' | 'removeEventListener'>;
  bindWheel(handler: (event: Event) => void): () => void;
  targetProjectionScale?: number;
  onPaint?: (world: WorldCamera, elapsedS: number) => void;
  interruptible?: () => boolean;
}

import { CENTER_SELECTION_DURATION_SECONDS, FLIGHT_ARRIVAL_EASE_RATE, FLIGHT_ARRIVAL_TOLERANCE, FLIGHT_VISIBLE_APPROACH, FLIGHT_WHEEL_SPEEDUP, MOBILE_VIEWPORT_QUERY } from './browser/runtime-policy.mts';
import { STELLAR_SYSTEMS, SYSTEM_CENTERS, SYSTEM_FRAMING_RADII, SYSTEM_RANGES, SYSTEM_VIEWS, SYSTEM_VIEW_HOSTS, DATASET_VOLUMES, categoryZoomTarget, drawnGalaxiesZoomTarget, volumeZoomTarget, systemFramingRect, systemViewTarget, systemOverviewDistance } from './system-framing.mts';
import { bodyViewAtCamera, zoomFrameDistanceM } from './zoom-scope.mts';
import { knownObject } from './object-directory.mts';
import { systemHostId } from './model/system-address.mts';
import { createSelectionFlight, sampleSelectionFlightInto, createSelectionFlightSample, advanceSelectionFlightInto } from '@cssearth/engine';
import { createCameraMotion, createWorldSelectionTarget, savedWorldCamera, parseSharedView } from '@cssearth/renderer/navigation';
import { worldCameraFromCenteredPresentation } from '@cssearth/engine';
import { worldCameraViewport, presentWorldCamera } from '@cssearth/renderer/navigation/world-camera.ts';

/** A camera within this many pixels of a pair's centre already looks at it; no turn is needed. */
const AIMED_AT_CENTER_PIXELS = 2;

/** Application routing over prepared physical frames. The CSS scene owns every camera write. */
export function createPreparedWorldNavigation({ objects, motion = createCameraMotion(), windowTarget = window, documentTarget = document,
  systemRadii = SYSTEM_FRAMING_RADII, systemViews = SYSTEM_VIEWS, systemViewHosts = SYSTEM_VIEW_HOSTS, systemCenters = SYSTEM_CENTERS, stellarSystems = STELLAR_SYSTEMS }: {objects: readonly (Pick<ObjectEntry, 'id' | 'worldFrame'> & Partial<Pick<ObjectEntry, 'discovery'>>)[];
  /** The camera motion the first body mounted with, when navigation is created after it. */ motion?: ReturnType<typeof createCameraMotion>; windowTarget?: Window; documentTarget?: Document; systemRadii?: typeof SYSTEM_FRAMING_RADII; systemViews?: ReadonlyMap<string, Parameters<typeof systemViewTarget>[3]>; systemViewHosts?: ReadonlySet<string>; systemCenters?: typeof SYSTEM_CENTERS; stellarSystems?: ReadonlySet<string>}) {
  // `objects` may be the live directory (site/object-directory.mts): an object's frame is read when navigation asks for it.
  const find = (id: string) => objects.find(object => object.id === id);
  const frames = { get: (id: string) => find(id)?.worldFrame };
  const arrivals = { get: (id: string) => find(id)?.discovery?.arrival };
  // WebKit includes wheel listeners in its inherited event-region style. Removing/readding
  // a document listener between approach and close-up restyled the whole scene on the iPad.
  // Keep the native listener for this navigation owner's lifetime; only its flight changes.
  let wheelInput: ((event: Event) => void) | null = null;
  const onWheel = (event: Event) => wheelInput?.(event);
  documentTarget.addEventListener('wheel', onWheel, { capture: true, passive: false });
  const bindWheel = (handler: (event: Event) => void) => {
    wheelInput = handler;
    return () => { if (wheelInput === handler) wheelInput = null; };
  };
  function frameSystem(from: WorldCamera, frame: WorldFrame, optics: Optics, objectId: string, force: boolean) {
    const view = systemViews.get(objectId), systemRadius = systemRadii.get(objectId);
    if (!view && systemViewHosts.has(objectId)) throw new Error(`System view candidates for ${objectId} are not loaded; navigation awaits loadSystemView first.`);
    if (view) return systemViewTarget(from, frame, optics, view, systemFramingRect(optics, documentTarget),
      systemOverviewDistance(frame.bodyRadiusM, systemRadius ?? frame.bodyRadiusM, optics), stellarSystems.has(objectId), SYSTEM_RANGES.get(objectId));
    return systemRadius || force ? createWorldSelectionTarget(from, { ...frame,
      bodyRadiusM: systemRadius ?? frame.bodyRadiusM,
    }, optics) : selectionTarget(from, frame, optics, objectId);
  }
  function selectionTarget(from: WorldCamera, frame: WorldFrame, optics: Optics, id: string, dataset?: string | null) {
    const framed = createWorldSelectionTarget(from, frame, optics), arrival = arrivals.get(id);
    if (!arrival || !arrival.datasetIds.includes(dataset ?? arrival.defaultDataset)) return framed;
    const distanceUnits = presentWorldCamera(framed, frame, optics).distanceUnits;
    const oriented = worldCameraFromCenteredPresentation({ rotation: arrival.rotation, distanceUnits }, frame, optics);
    return arrival.billboard && (dataset ?? arrival.defaultDataset) === arrival.defaultDataset
      ? frameArrivalBillboard(arrival, oriented, frame, optics) : oriented;
  }
  let lastCamera: WorldCamera | null = null, lastOptics: Optics | null = null;
  const supports = (from: string, to: string) => {
    const a = frames.get(from), b = frames.get(to);
    return Boolean(a && b && a.referenceFrame === b.referenceFrame && a.epochJdTt === b.epochJdTt);
  };
  return Object.freeze({ supports, motion,
    destroy() { wheelInput = null; documentTarget.removeEventListener('wheel', onWheel, { capture: true }); },
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
    /** A scope of the zoom out of `objectId`, framed around it: its own system, or an object seen from inside, which keeps the
     * direction the camera looks in; a page opened cold has no view to keep and asks for `objectId`'s own default direction
     * (`view: 'default'`). */
    overviewTarget({ scope, objectId, fromId, mount, view }: TargetRequest & {scope: string; view?: 'default'}) {
      if (systemHostId(scope) !== null) {
        const world = this.systemTarget({ objectId, fromId, mount, force: true });
        return world ? { world, focusPositionM: frames.get(objectId)!.originM } : null;
      }
      const overview = knownObject(scope);
      if (!overview?.zoom) return null;
      const owner = mount?.navigation;
      const from = owner?.capture() ?? lastCamera, current = owner?.optics() ?? lastOptics;
      if (!from || !current) return null;
      // An overview is framed through the normal dataset, not a close-up's magnification, so its page looks the same however
      // it is reached (a cold load has no close-up to inherit).
      const optics = worldCameraViewport({ projectionScale: 1 }, current);
      // Its `zoom.frame` (object.json): fit what it draws, or a distance from the centre, looking the way the camera looks.
      const distanceM = zoomFrameDistanceM({ zoom: overview.zoom });
      const frame = frames.get(objectId), arrival = view === 'default' ? arrivals.get(objectId) : undefined;
      // The centre's own default view, at its body: what a fit backs out from when the level opens by its page.
      const origin = arrival && frame ? worldCameraFromCenteredPresentation({ rotation: arrival.rotation, distanceUnits: 4 * frame.bodyRadiusM / frame.metersPerUnit }, frame, optics) : from;
      if (distanceM === null) return drawnGalaxiesZoomTarget(overview.id, origin, optics, systemFramingRect(optics, documentTarget));
      if (!frame) return null;
      const projection = arrival ? { rotation: arrival.rotation } : presentWorldCamera(from, frame, optics);
      return { world: worldCameraFromCenteredPresentation({ rotation: projection.rotation, distanceUnits: distanceM / frame.metersPerUnit },
        frame, optics), focusPositionM: frame.originM };
    },
    /** Fly to every member of one classification on the map (its header pill), keeping the camera angle and the selection.
     * Framed through the normal dataset like an overview, so it looks the same from any close-up. Nothing to fly to without a
     * prepared box; another camera move that cancels the flight is not a failure. */
    async frameCategory({ classification, ...request }: Omit<FocusRequest, 'targetWorldCamera' | 'targetFocusPositionM' | 'centerSelection'> & { classification: string }) {
      const owner = request.mount.navigation;
      if (!owner) return;
      const optics = worldCameraViewport({ projectionScale: 1 }, owner.optics());
      const target = categoryZoomTarget(classification, owner.capture(), optics, systemFramingRect(optics, documentTarget));
      if (!target) return;
      try { await this.focus({ ...request, targetWorldCamera: target.world, targetFocusPositionM: target.focusPositionM, centerSelection: true }); }
      catch (error) { if (!(error instanceof Error && error.name === 'AbortError')) throw error; }
    },
    /** Fit a volume the body shows through its dataset, when the view does not already hold it. Null when the view is
     * already as far out as the fit, or the volume is unknown, or the volume is another object's extent: M87* shows its
     * galaxy's volume around it and opened 6.3 million light-years out, its own image under a pixel (2026-10-01). */
    datasetVolumeTarget({ objectId, volumeId, mount }: { objectId: string; volumeId: string; mount?: ShellCamera | null }) {
      const bank = DATASET_VOLUMES.get(volumeId), volume = !bank || (bank.host !== undefined && bank.host !== objectId) ? undefined : bank.frame;
      const frame = frames.get(objectId), owner = mount?.navigation;
      const from = owner?.capture() ?? lastCamera, current = owner?.optics() ?? lastOptics;
      if (!volume || !frame || !from || !current) return null;
      // The fitted camera carries no magnification, so the fit is made through the normal projection, like an overview's. An
      // arrival holds its close-up's magnification (3.76 on a phone): fitted through it, M 31 reached from another body
      // ended that many times farther out than its own page opens, about 20 px wide (2026-10-02).
      const optics = worldCameraViewport({ projectionScale: 1 }, current), magnification = current.focalPixels / optics.focalPixels;
      const target = volumeZoomTarget(from, volume, optics, systemFramingRect(optics, documentTarget), frame.originM);
      const distance = (camera: WorldCamera) => eyeDistanceM(camera.pose, frame.originM);
      // What the view holds is its apparent size: a magnified view stands that many times closer.
      return distance(target.world) > distance(from) / magnification ? target : null;
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
      if (!force && objectId === fromId && bodyViewAtCamera(from, frame, optics, objectId) === 'detail') return null;
      return frameSystem(from, frame, optics, objectId, force);
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
      const running = createWorldFlight({ motion, owner, from, flight,
        targetProjectionScale: target.projectionScale,
        anchors: [{ positionM: frame.originM, radiusM: frame.bodyRadiusM }], signal, reducedMotion,
        windowTarget, documentTarget, bindWheel, onPaint(world) {
          lastCamera = world;
          if (!sameEyePlace(world.pose, from.pose) ||
              world.pose.orientationXyzw.some((value, axis) => value !== from.pose.orientationXyzw[axis])) timing.mark('first-motion');
        } });
      if (!(await running.finished).completed) throw cancellationReason(running.signal);
      lastCamera = owner.capture(); lastOptics = owner.optics();
    },
    async prepare({ fromId, toId, fromMount, toFactory, signal, stage, reducedMotion, url, targetWorldCamera = null, targetFocusPositionM = null, centerSelection = false, preserveView = false, presentWorld = null, cameraViewport, timing = { mark() {} } }: PrepareRequest): Promise<WorldHandoff> {
      if (!supports(fromId, toId)) throw new TypeError('Objects do not share a prepared world frame.');
      const targetFrame = frames.get(toId)!;
      let source = fromMount?.navigation;
      fromMount = null;
      const from = source?.capture() ?? lastCamera;
      const optics = source?.optics() ?? lastOptics;
      if (!from || !optics) throw new Error('The drawn world camera is not ready.');
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
          // The camera the new scene mounts on, read when it mounts: the carried one, else the departing scene's last.
          let handed: { world: WorldCamera; viewport: Optics } = { world: checkpoint, viewport: source?.optics() ?? lastOptics ?? optics };
          const mountOptions: Partial<MountOptions> = { preparedResources: prepared.resources, preparedTree: prepared.tree,
            get initialWorldCamera() { return carry.world() ?? handed.world; },
            get initialProjection() { return prepared.projection({ world: carry.world() ?? handed.world, viewport: handed.viewport }); } };
          source = undefined;
          // The camera is carried through the mount at the rate the departing scene's zoom had (zoom-carry.mts).
          const carry = createZoomCarry({ windowTarget: windowTarget as Parameters<typeof createZoomCarry>[0]['windowTarget'],
            presentWorld: reducedMotion ? null : presentWorld, signal, onMove(world) { lastCamera = world; } });
          return {
            transferTo: ownership.transferTo,
            mountOptions,
            beforeRetire(departing: ObjectWorldNavigation) {
              // The new scene mounts where the camera is now, not where it was when its assets were ready.
              handed = { world: departing.capture(), viewport: departing.optics() };
              lastCamera = handed.world; lastOptics = handed.viewport;
              carry.begin(handed.world, handed.viewport, departing.zoomRate?.() ?? 0);
            },
            async afterMount(mount: ObjectSceneLifecycle) {
              const carried = carry.end();
              if (signal.aborted) throw cancellationReason(signal);
              timing.mark('mounted');
              if (!mount.navigation) throw new Error('The destination camera is unavailable.');
              if (carried) {
                await mount.navigation.apply(carried.world, { signal });
                mount.navigation.resumeZoom?.(carried.rate);
              }
              lastCamera = mount.navigation.capture(); lastOptics = mount.navigation.optics();
            },
          };
        } catch (error) { ownership.dispose(); throw error; }
      }

      const query = url ? new URL(url).searchParams : null;
      if ((query?.getAll('v').length ?? 0) > 1) throw new TypeError('A destination URL may contain only one saved view.');
      const saved = query?.has('v') ? parseSharedView(`v=${query.get('v')}`) : null;
      // A system target was provisionally framed before the destination transport
      // loaded. Resolve its final range with the destination's prepared fit before
      // starting motion, so its settled card uses the same zoom boundary.
      const frameSatelliteSystem = centerSelection && url != null && namesSystem(url) && satelliteSystemByHost(toId) !== null && !saved;
      let targetOptics = optics;
      if (!saved && (!targetWorldCamera || frameSatelliteSystem) && cameraViewport) {
        const factory = await toFactory;
        if (!factory.navigation) throw new TypeError('Destination has no prepared navigation.');
        const framingRadiusPixels = await factory.navigation.framingRadius(cameraViewport,
          windowTarget.matchMedia(MOBILE_VIEWPORT_QUERY).matches, signal);
        targetOptics = { ...optics, framingRadiusPixels };
      }
      const target = frameSatelliteSystem ? frameSystem(from, targetFrame, targetOptics, toId, true)
        : targetWorldCamera ?? (saved ? savedWorldCamera(saved, targetFrame, optics)
        : selectionTarget(from, targetFrame, targetOptics, toId, query?.get('dataset')));
      const arrival = arrivals.get(toId);
      const useBillboard = stage && !saved && !targetWorldCamera && !reducedMotion &&
        canUseArrivalBillboard(arrival, target, targetFrame, optics, query?.get('dataset'));
      const billboard = useBillboard ? await prepareArrivalBillboard(stage!, arrival!, targetFrame, signal) : null;
      if (billboard) timing.mark('billboard-ready');
      // One flight reaches the final viewport framing. The billboard covers the
      // entire approach and the detail attaches at that same stationary camera.
      const flight = createSelectionFlight({ from: from.pose, to: target.pose,
        focusPositionM: targetFocusPositionM ?? targetFrame.originM, durationS: centerSelection ? CENTER_SELECTION_DURATION_SECONDS : undefined });
      const anchors = [frames.get(fromId)!, targetFrame].map(frame => ({
        positionM: frame.originM, radiusM: frame.bodyRadiusM,
      }));
      const handoffTimeS = billboard ? flight.durationS : source && !reducedMotion
        ? detailHandoffTime(flight, from, source.frame, optics) : 0;
      // A replacement can arrive while the previous detail is still activating.
      // Its retirement must not retire the application's camera progression.
      let departureOwner = source ?? (presentWorld ? { apply(world: WorldCamera) {
        return presentWorld(world, worldCameraViewport(world, optics), { signal: running.signal });
      } } : null);
      const approachLimitS = billboard ? flight.durationS : departureOwner && !reducedMotion
        ? destinationDetailTime(flight, from, targetFrame, optics) : 0;
      const ownership = createPreparedArrival(signal, billboard, () => { if (billboard) timing.mark('billboard-removed'); },
        stage?.ownerDocument.querySelector<HTMLElement>('.object-input-surface'));
      type Publisher =
        | { kind: 'departure'; held: boolean }
        | { kind: 'mounting'; owner: ObjectWorldNavigation | null }
        | { kind: 'destination'; owner: ObjectWorldNavigation };
      let publisher: Publisher = { kind: 'departure', held: !departureOwner || Boolean(reducedMotion) };
      let bankReady = false, moved = false, drawnElapsedS = 0;
      // Cancels only a publication superseded by the fully active detail. The
      // flight itself retains its clock, input policy and completion promise.
      const activation = new AbortController();
      let reachHandoff!: () => void;
      const handoffReady = new Promise<void>(resolve => { reachHandoff = resolve; });
      if (publisher.held) reachHandoff();
      let drawn = reducedMotion ? target : from;
      const running = createWorldFlight({ motion, from, flight, anchors,
        targetProjectionScale: target.projectionScale,
        signal: AbortSignal.any([signal, ownership.signal]), reducedMotion,
        paused: publisher.held, windowTarget, documentTarget, bindWheel,
        limitElapsedS: () => publisher.kind === 'destination' ||
          publisher.kind === 'mounting' && publisher.owner?.detailActivated?.() ? flight.durationS : approachLimitS,
        canFinish: () => publisher.kind === 'destination',
        interruptible: () => !billboard && (!moved || drawnElapsedS >= approachLimitS),
        owner: { apply(world) {
          if (publisher.kind === 'departure') return departureOwner?.apply(world, { signal: running.signal, departing: true });
          if (publisher.kind === 'destination') return publisher.owner.apply(world, { signal: running.signal });
          return presentWorld?.(world, worldCameraViewport(world, optics), { signal: activationSignal,
            commit: () => {
              if (publisher.kind === 'mounting') void publisher.owner?.apply(world, { signal: running.signal });
            } });
        } },
        onPaint(world, elapsedS) {
          billboard?.publish(world, source?.optics() ?? optics);
          drawn = lastCamera = world;
          drawnElapsedS = elapsedS;
          if (!moved && (!sameEyePlace(world.pose, from.pose) ||
              world.pose.orientationXyzw.some((value, axis) => value !== from.pose.orientationXyzw[axis]))) {
            moved = true; timing.mark('first-motion');
          }
          if (publisher.kind === 'departure' && !publisher.held &&
              (elapsedS >= approachLimitS || bankReady && elapsedS >= handoffTimeS)) {
            publisher.held = true;
            running.hold(elapsedS);
            reachHandoff();
          }
        },
      });
      const activationSignal = AbortSignal.any([running.signal, activation.signal]);
      const interrupted = running.finished.then(() => {
        if (publisher.kind === 'departure') ownership.dispose();
        throw cancellationReason(running.signal);
      }, error => {
        if (publisher.kind === 'departure') ownership.dispose();
        throw error;
      });
      void interrupted.catch(() => {});
      const wait = <T,>(task: Promise<T>): Promise<T> => Promise.race([task, interrupted]);
      const preparation = ownership.prepare(toFactory, { cameraViewport,
        getView: () => ({ world: billboard ? target : drawn, viewport: optics }) }).then(value => {
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
        publisher = { kind: 'mounting', owner: null };
        // The destination retains its handoff callbacks. Keeping the departed
        // owner here chains every retired camera/scene into the current mount.
        // Once mounting starts, only the shared world and destination may publish.
        source = undefined;
        departureOwner = null;
        const progressive = Boolean(presentWorld && !reducedMotion && !billboard);
        if (progressive) running.resume();
        return ownership.handoff(() => ({ world: drawn, viewport: optics }), {
          ...(progressive ? { progressiveActivation: approachLimitS > 0, onNavigationReady(owner: ObjectWorldNavigation) {
            if (running.signal.aborted || publisher.kind !== 'mounting') return;
            publisher.owner = owner; void owner.apply(drawn, { signal: running.signal });
          } } : {}),
        }, {
          beforePublish(mount) {
            if (running.signal.aborted) throw cancellationReason(running.signal);
            timing.mark('mounted');
            publisher = { kind: 'destination', owner: mount.navigation! };
            activation.abort();
          },
          async afterPublish(mount) {
            try {
              if (reducedMotion) running.complete();
              else running.resume();
              if (!(await running.finished).completed) throw cancellationReason(running.signal);
              lastCamera = mount.navigation!.capture(); lastOptics = mount.navigation!.optics();
            } catch (error) { running.cancel(error); throw error; }
          },
        });
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

function createWorldFlight({ motion, owner, from, flight, anchors, signal, reducedMotion = false, paused = false,
  limitElapsedS = () => flight.durationS, canFinish = () => true,
  windowTarget, documentTarget, bindWheel, targetProjectionScale = 1, onPaint = () => {}, interruptible = () => true }: WorldFlightRequest) {
  let elapsedS = 0, publishedElapsed: number | null = null;
  const sample = createSelectionFlightSample();
  const events = ['pointerdown', 'keydown'];
  let releaseWheel = () => {};
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
  const running = motion.start({ windowTarget, signal, paused,
    onFinish() {
      releaseWheel();
      for (const event of events) documentTarget.removeEventListener(event, input, { capture: true });
    },
    advance(clockS, stepS) {
      const permittedEndS = reducedMotion ? flight.durationS : limitElapsedS();
      const requestedElapsedS = reducedMotion ? flight.durationS : Math.min(flight.durationS, permittedEndS, clockS);
      const previousElapsed = elapsedS;
      elapsedS = reducedMotion ? requestedElapsedS
        : advanceSelectionFlightInto(flight, anchors, elapsedS, requestedElapsedS, sample);
      if (!reducedMotion) elapsedS = easeArrivalInto(flight, previousElapsed, elapsedS, stepS, sample);
      let world = worldSample(flight, from, elapsedS, sample, targetProjectionScale);
      if (permittedEndS >= flight.durationS && arrivalIsInvisible(flight, anchors, world, targetProjectionScale)) {
        elapsedS = flight.durationS;
        world = worldSample(flight, from, elapsedS, sample, targetProjectionScale);
      }
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
  if (!running.signal.aborted) {
    releaseWheel = bindWheel(input);
    for (const event of events) documentTarget.addEventListener(event, input, { capture: true, passive: false });
  }
  return running;
}

function worldSample(flight: Flight, from: WorldCamera, elapsedS: number, sample: FlightSample, targetProjectionScale = from.projectionScale ?? 1): WorldCamera {
  sampleSelectionFlightInto(flight, elapsedS, sample);
  // Position, orientation and optical scale follow the same eased path. Raw
  // clock progress can leave a visible zoom unfinished when the pose arrives.
  const progress = sample.progress;
  const startScale = from.projectionScale ?? 1;
  const projectionScale = progress === 0 ? startScale : progress === 1 ? targetProjectionScale
    : Math.exp(Math.log(startScale) + (Math.log(targetProjectionScale) - Math.log(startScale)) * progress);
  return { referenceFrame: from.referenceFrame, epochJdTt: from.epochJdTt,
    ...(projectionScale === 1 ? {} : { projectionScale }),
    pose: { positionM: [...sample.positionM], orientationXyzw: [...sample.orientationXyzw],
      ...(sample.hasFocusOffset ? { focusOffset: { originM: [...sample.focusOriginM], offsetM: [...sample.focusOffsetM] } } : {}) } };
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
// pose: that fraction of its depth to the nearest anchor surface, that many radians of turn,
// and that fraction of optical scale. A stationary pose can still be visibly zooming.
function arrivalIsInvisible(flight: Flight, anchors: FlightAnchors, world: WorldCamera, targetProjectionScale: number) {
  if (Math.abs((world.projectionScale ?? 1) / targetProjectionScale - 1) > FLIGHT_ARRIVAL_TOLERANCE) return false;
  const end = flight.to.positionM, q = world.pose.orientationXyzw, r = flight.to.orientationXyzw;
  let depthM = Infinity;
  for (const anchor of anchors) depthM = Math.min(depthM, eyeDistanceM(world.pose, anchor.positionM) - anchor.radiusM);
  const cosine = Math.min(1, Math.abs(q[0] * r[0] + q[1] * r[1] + q[2] * r[2] + q[3] * r[3]));
  return depthM > 0 && eyeDistanceM(world.pose, end) <= FLIGHT_ARRIVAL_TOLERANCE * depthM
    && 2 * Math.acos(cosine) <= FLIGHT_ARRIVAL_TOLERANCE;
}
function isFlightInput(event: Event) {
  const target = event.target;
  return target && 'closest' in target && typeof target.closest === 'function' && Boolean(target.closest('.object-input-surface')) &&
    (event.type !== 'keydown' || 'key' in event && typeof event.key === 'string' && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '-', '=', 'Escape'].includes(event.key));
}
function cancellationReason(signal: AbortSignal): unknown {
  const reason: unknown = signal.reason;
  return reason && typeof reason === 'object' && 'name' in reason && reason.name === 'AbortError' ? reason : cancelled();
}
function cancelled(): DOMException & {preserveView?: boolean} { return new DOMException('Object flight was cancelled.', 'AbortError'); }
