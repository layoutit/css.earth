import { createSelectionFlight, sampleSelectionFlightInto, createSelectionFlightSample, advanceSelectionFlightInto } from '@cssearth/engine';
import { createWorldSelectionTarget, savedWorldCamera, parseSharedView, presentWorldCamera } from '../src/renderers/css/dist/navigation.js';

/** Application routing over prepared physical frames. The CSS scene owns every camera write. */
export function createPreparedWorldNavigation({ objects, windowTarget = window, documentTarget = document }) {
  const frames = new Map(objects.map(object => [object.id, object.worldFrame]));
  let lastCamera = null, lastOptics = null;
  const supports = (from, to) => {
    const a = frames.get(from), b = frames.get(to);
    return Boolean(a && b && a.referenceFrame === b.referenceFrame && a.epochJdTt === b.epochJdTt);
  };
  return Object.freeze({ supports,
    async focus({ objectId, mount, signal, reducedMotion = false, targetWorldCamera = null, timing = { mark() {} } }) {
      const owner = mount?.navigation, frame = frames.get(objectId);
      if (!owner || !frame) throw new TypeError('Object focus requires its mounted prepared camera.');
      const from = owner.capture(), optics = owner.optics();
      const target = targetWorldCamera ?? createWorldSelectionTarget(from, frame, optics);
      const flight = createSelectionFlight({ from: from.pose, to: target.pose, focusPositionM: frame.originM });
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
    async prepare({ fromId, toId, fromMount, toFactory, signal, reducedMotion, url, targetWorldCamera = null, preserveView = false, presentWorld = null, cameraViewport, timing = { mark() {} } }) {
      if (!supports(fromId, toId)) throw new TypeError('Objects do not share a prepared world frame.');
      const targetFrame = frames.get(toId);
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
        const prepared = await factory.navigation.prepare({ signal, cameraViewport,
          getView: () => ({ world: source?.capture() ?? lastCamera, viewport: source?.optics() ?? lastOptics }) });
        timing.mark('assets-ready');
        const release = () => prepared.destroy();
        if (signal.aborted) { release(); throw cancellationReason(signal); }
        signal.addEventListener('abort', release, { once: true });
        const checkpoint = source?.capture() ?? lastCamera;
        return {
          mountOptions: { preparedResources: prepared.resources, preparedTree: prepared.tree, initialWorldCamera: checkpoint, initialProjection: prepared.projection({ world: checkpoint, viewport: source?.optics() ?? lastOptics }) },
          async afterMount(mount) {
            signal.removeEventListener('abort', release);
            if (signal.aborted) throw cancellationReason(signal);
            timing.mark('mounted');
            lastCamera = mount.navigation.capture(); lastOptics = mount.navigation.optics();
          },
        };
      }
      const query = url ? new URL(url).searchParams : null;
      if (query?.getAll('v').length > 1) throw new TypeError('A destination URL may contain only one saved view.');
      const saved = query?.has('v') ? parseSharedView(`v=${query.get('v')}`) : null;
      const target = targetWorldCamera ?? (saved ? savedWorldCamera(saved, targetFrame, optics)
        : createWorldSelectionTarget(from, targetFrame, optics));
      // One numeric flight survives the change of detailed object owner.
      const flight = createSelectionFlight({ from: from.pose, to: target.pose,
        focusPositionM: targetFrame.originM });
      const anchors = [frames.get(fromId), targetFrame].map(frame => ({
        positionM: frame.originM, radiusM: frame.bodyRadiusM,
      }));
      const handoffTimeS = source && !reducedMotion
        ? detailHandoffTime(flight, from, source.frame, optics) : 0;
      // A replacement can arrive while the previous detail is still activating.
      // Its retirement must not retire the application's camera progression.
      const departureOwner = source ?? (presentWorld ? { apply(world) { presentWorld(world, optics); } } : null);
      const approachLimitS = departureOwner && !reducedMotion
        ? destinationDetailTime(flight, from, targetFrame, optics) : 0;
      const controller = new AbortController();
      const cancel = () => controller.abort(signal.reason ?? cancelled());
      signal.addEventListener('abort', cancel, { once: true });
      if (signal.aborted) cancel();
      const events = ['pointerdown', 'wheel', 'keydown'];
      const interrupt = event => {
        if (!isFlightInput(event)) return;
        const error = cancelled(); error.preserveView = true;
        controller.abort(error);
      };
      for (const event of events) documentTarget.addEventListener(event, interrupt, { capture: true });
      let prepared, released = false, rejectInterruption;
      const release = () => { if (prepared && !released) { released = true; prepared.destroy(); } };
      const interrupted = new Promise((_, reject) => { rejectInterruption = reject; });
      interrupted.catch(() => {});
      const abort = () => { release(); rejectInterruption(cancellationReason(controller.signal)); cleanup(); };
      controller.signal.addEventListener('abort', abort, { once: true });
      if (controller.signal.aborted) abort();
      function cleanup() {
        signal.removeEventListener('abort', cancel);
        controller.signal.removeEventListener('abort', abort);
        for (const event of events) documentTarget.removeEventListener(event, interrupt, { capture: true });
      }
      let bankReady = false;
      const preparation = Promise.resolve(toFactory).then(factory => {
        if (!factory.navigation) throw new TypeError('Destination has no prepared navigation.');
        return factory.navigation.prepare({ signal: controller.signal, cameraViewport,
          getView: () => ({ world: reducedMotion ? target : lastCamera, viewport: optics }) });
      }).then(value => {
        prepared = value;
        if (controller.signal.aborted) { release(); throw cancellationReason(controller.signal); }
        bankReady = true;
        return value;
      });
      preparation.catch(() => {});
      let moved = false;
      const onPaint = world => {
        lastCamera = world;
        if (!moved && (world.pose.positionM.some((value, axis) => value !== from.pose.positionM[axis]) ||
            world.pose.orientationXyzw.some((value, axis) => value !== from.pose.orientationXyzw[axis]))) {
          moved = true; timing.mark('first-motion');
        }
      };
      try {
        // Keep moving with the current owner while the bank loads. Transfer as
        // soon as it is ready and the source is coarse, or hold before the
        // destination proxy would grow into a detailed view.
        const departure = departureOwner && !reducedMotion
          ? animateWorldFlight({ owner: departureOwner, from, flight, anchors, signal: controller.signal,
            endElapsedS: approachLimitS,
            stopWhen: elapsed => bankReady && elapsed >= handoffTimeS,
            windowTarget, documentTarget, onPaint })
          : Promise.resolve({ world: reducedMotion ? target : from, elapsedS: reducedMotion ? flight.durationS : 0 });
        const [, checkpoint] = await Promise.race([Promise.all([preparation, departure]), interrupted]);
        // A final RAF can cross a material boundary after preparation resolves.
        // Keep the existing scene until this exact drawn view is decoded too.
        await prepared.prepareView(() => ({ world: checkpoint.world, viewport: optics }));
        if (controller.signal.aborted) throw cancellationReason(controller.signal);
        timing.mark('assets-ready');
        // Camera progression belongs to the application, not to the lifetime
        // of a detailed object. Keep presenting the coarse world while the
        // destination activates its prepared groups over successive paints.
        let incomingOwner = null, detailReady = false;
        const continuation = presentWorld && !reducedMotion && checkpoint.elapsedS < flight.durationS
          ? animateWorldFlight({ owner: { apply(world) {
              incomingOwner?.apply(world);
              if (!detailReady) presentWorld(world, optics);
            } }, from, flight, anchors, signal: controller.signal,
            startElapsedS: checkpoint.elapsedS, startTime: checkpoint.time ?? null,
            limitElapsedS: () => detailReady ? flight.durationS : Math.max(checkpoint.elapsedS, approachLimitS),
            windowTarget, documentTarget, onPaint }) : null;
        continuation?.catch(() => {});
        return {
          mountOptions: { preparedResources: prepared.resources, preparedTree: prepared.tree, initialWorldCamera: checkpoint.world, initialProjection: prepared.projection({ world: checkpoint.world, viewport: optics }),
            ...(continuation ? { progressiveActivation: approachLimitS > 0, onNavigationReady(owner) {
              if (controller.signal.aborted) throw cancellationReason(controller.signal);
              incomingOwner = owner; owner.apply(lastCamera);
            } } : {}) },
          async afterMount(mount, { signal: mountedSignal }) {
            const cancelMounted = () => controller.abort(mountedSignal.reason ?? cancelled());
            mountedSignal.addEventListener('abort', cancelMounted, { once: true });
            if (mountedSignal.aborted) cancelMounted();
            try {
              if (controller.signal.aborted) throw cancellationReason(controller.signal);
              if (!mount.navigation) throw new Error('The destination camera is unavailable.');
              timing.mark('mounted');
              if (continuation) {
                incomingOwner = mount.navigation; detailReady = true;
                incomingOwner.apply(lastCamera);
                await continuation;
              } else if (checkpoint.elapsedS < flight.durationS) {
                mount.navigation.apply(checkpoint.world);
                await animateWorldFlight({ owner: mount.navigation, from, flight, anchors, signal: controller.signal,
                  startElapsedS: checkpoint.elapsedS, windowTarget, documentTarget, onPaint });
              } else mount.navigation.apply(checkpoint.world);
              lastCamera = mount.navigation.capture(); lastOptics = mount.navigation.optics();
            } finally {
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
function destinationDetailTime(flight, from, frame, optics) {
  const sample = createSelectionFlightSample(), limit = optics.detailHandoffDiameterPixels;
  const needsDetail = elapsed => {
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
function detailHandoffTime(flight, from, frame, optics) {
  const limit = optics.detailHandoffDiameterPixels;
  if (!(Number.isFinite(limit) && limit > 0)) throw new TypeError('World navigation needs a prepared detail handoff diameter.');
  const sample = createSelectionFlightSample();
  const isCoarse = elapsedS => {
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
  windowTarget, documentTarget, onPaint = () => {}, stopWhen = () => false }) {
  return new Promise((resolve, reject) => {
    let frameId = null, started = startTime, finished = false, elapsedS = startElapsedS, publishedElapsed = null;
    const sample = createSelectionFlightSample();
    const events = ['pointerdown', 'wheel', 'keydown'];
    function finish(error, result) {
      if (finished) return;
      finished = true;
      if (frameId !== null) windowTarget.cancelAnimationFrame(frameId);
      signal.removeEventListener('abort', abort);
      for (const event of events) documentTarget.removeEventListener(event, interrupt, { capture: true });
      if (error) reject(error); else resolve(result);
    }
    function abort() { finish(cancellationReason(signal)); }
    function interrupt(event) {
      if (!isFlightInput(event)) return;
      const error = cancelled(); error.preserveView = true;
      finish(error);
    }
    function paint(time) {
      frameId = null;
      if (finished) return;
      try {
        if (started === null) started = time;
        const permittedEndS = reducedMotion ? endElapsedS : limitElapsedS();
        const requestedElapsedS = reducedMotion ? endElapsedS
          : Math.min(endElapsedS, permittedEndS, startElapsedS + (time - started) / 1000);
        elapsedS = reducedMotion ? requestedElapsedS
          : advanceSelectionFlightInto(flight, anchors, elapsedS, requestedElapsedS, sample);
        // At extreme range ratios the source curve reaches its exact terminal
        // position before its duration cap. Do not keep publishing that same
        // pose after both position and orientation have finished. A detail
        // readiness hold must still be respected.
        if (endElapsedS === flight.durationS && permittedEndS >= endElapsedS &&
            sample.progress === 1 && elapsedS >= flight.orientationDurationS) elapsedS = endElapsedS;
        const world = worldSample(flight, from, elapsedS, sample);
        if (publishedElapsed !== elapsedS) { owner.apply(world); onPaint(world); publishedElapsed = elapsedS; }
        if (elapsedS >= endElapsedS || stopWhen(elapsedS)) finish(null, { world, elapsedS, time });
        else frameId = windowTarget.requestAnimationFrame(paint);
      } catch (error) { finish(error); }
    }
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) { abort(); return; }
    for (const event of events) documentTarget.addEventListener(event, interrupt, { capture: true });
    frameId = windowTarget.requestAnimationFrame(paint);
  });
}

function worldSample(flight, from, elapsedS, sample) {
  sampleSelectionFlightInto(flight, elapsedS, sample);
  return { referenceFrame: from.referenceFrame, epochJdTt: from.epochJdTt,
    pose: { positionM: [...sample.positionM], orientationXyzw: [...sample.orientationXyzw] } };
}
function isFlightInput(event) {
  return event.target?.closest?.('.planet-input-surface, .planet-surface-minimap') &&
    (event.type !== 'keydown' || ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '-', '=', 'Escape'].includes(event.key));
}
function cancellationReason(signal) { return signal.reason?.name === 'AbortError' ? signal.reason : cancelled(); }
function cancelled() { return new DOMException('Object flight was cancelled.', 'AbortError'); }
