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
    async focus({ objectId, mount, signal, reducedMotion = false }) {
      const owner = mount?.navigation, frame = frames.get(objectId);
      if (!owner || !frame) throw new TypeError('Object focus requires its mounted prepared camera.');
      const from = owner.capture(), optics = owner.optics();
      const target = createWorldSelectionTarget(from, frame, optics);
      const flight = createSelectionFlight({ from: from.pose, to: target.pose, focusPositionM: frame.originM });
      await animateWorldFlight({ owner, from, flight,
        anchors: [{ positionM: frame.originM, radiusM: frame.bodyRadiusM }], signal, reducedMotion,
        windowTarget, documentTarget, onPaint(world) { lastCamera = world; } });
      lastCamera = owner.capture(); lastOptics = owner.optics();
    },
    async prepare({ fromId, toId, fromMount, toFactory, signal, reducedMotion, url }) {
      if (!supports(fromId, toId) || !toFactory.navigation) throw new TypeError('Objects do not share a prepared world frame.');
      const source = fromMount?.navigation;
      const from = source?.capture() ?? lastCamera;
      const optics = source?.optics() ?? lastOptics;
      if (!from || !optics) throw new Error('The drawn world camera is not ready.');
      lastCamera = from; lastOptics = optics;
      const query = url ? new URL(url).searchParams : null;
      if (query?.getAll('v').length > 1) throw new TypeError('A destination URL may contain only one saved view.');
      const saved = query?.has('v') ? parseSharedView(`v=${query.get('v')}`) : null;
      const target = saved ? savedWorldCamera(saved, toFactory.navigation.frame, optics)
        : createWorldSelectionTarget(from, toFactory.navigation.frame, optics);
      // One numeric flight survives the change of detailed object owner.
      const flight = createSelectionFlight({ from: from.pose, to: target.pose,
        focusPositionM: toFactory.navigation.frame.originM });
      const anchors = [frames.get(fromId), toFactory.navigation.frame].map(frame => ({
        positionM: frame.originM, radiusM: frame.bodyRadiusM,
      }));
      const handoffTimeS = source && !reducedMotion
        ? detailHandoffTime(flight, from, source.frame, optics) : 0;
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
      const release = () => { if (prepared && !released) { released = true; prepared.resources.destroy(); } };
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
      const preparation = toFactory.navigation.prepare({ signal: controller.signal }).then(value => {
        prepared = value;
        if (controller.signal.aborted) { release(); throw cancellationReason(controller.signal); }
        return value;
      });
      preparation.catch(() => {});
      const onPaint = world => { lastCamera = world; };
      try {
        // Depart immediately, but stop while source detail is already coarse.
        // Slow preparation can only hold this distant view, never an enlarged
        // destination proxy. Nothing mounts until its full bank is decoded.
        const departure = source && !reducedMotion
          ? animateWorldFlight({ owner: source, from, flight, anchors, signal: controller.signal,
            endElapsedS: handoffTimeS, windowTarget, documentTarget, onPaint })
          : Promise.resolve({ world: reducedMotion ? target : from, elapsedS: reducedMotion ? flight.durationS : 0 });
        const [, checkpoint] = await Promise.race([Promise.all([preparation, departure]), interrupted]);
        if (controller.signal.aborted) throw cancellationReason(controller.signal);
        return {
          mountOptions: { preparedResources: prepared.resources, initialWorldCamera: checkpoint.world },
          async afterMount(mount, { signal: mountedSignal }) {
            const cancelMounted = () => controller.abort(mountedSignal.reason ?? cancelled());
            mountedSignal.addEventListener('abort', cancelMounted, { once: true });
            if (mountedSignal.aborted) cancelMounted();
            try {
              if (controller.signal.aborted) throw cancellationReason(controller.signal);
              if (!mount.navigation) throw new Error('The destination camera is unavailable.');
              mount.navigation.apply(checkpoint.world);
              if (checkpoint.elapsedS < flight.durationS) {
                await animateWorldFlight({ owner: mount.navigation, from, flight, anchors, signal: controller.signal,
                  startElapsedS: checkpoint.elapsedS, windowTarget, documentTarget, onPaint });
              }
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
  startElapsedS = 0, endElapsedS = flight.durationS, windowTarget, documentTarget, onPaint = () => {} }) {
  return new Promise((resolve, reject) => {
    let frameId = null, started = null, finished = false, elapsedS = startElapsedS;
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
        const requestedElapsedS = reducedMotion ? endElapsedS
          : Math.min(endElapsedS, startElapsedS + (time - started) / 1000);
        elapsedS = reducedMotion ? requestedElapsedS
          : advanceSelectionFlightInto(flight, anchors, elapsedS, requestedElapsedS, sample);
        const world = worldSample(flight, from, elapsedS, sample);
        owner.apply(world); onPaint(world);
        if (elapsedS >= endElapsedS) finish(null, { world, elapsedS });
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
  return event.target?.closest?.('.planet-input-surface') &&
    (event.type !== 'keydown' || ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '-', '=', 'Escape'].includes(event.key));
}
function cancellationReason(signal) { return signal.reason?.name === 'AbortError' ? signal.reason : cancelled(); }
function cancelled() { return new DOMException('Object flight was cancelled.', 'AbortError'); }
