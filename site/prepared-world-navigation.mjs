import { createSelectionFlight, sampleSelectionFlightInto, createSelectionFlightSample } from '@cssearth/engine';
import { createWorldSelectionTarget, savedWorldCamera, parseSharedView } from '../src/renderers/css/dist/navigation.js';

/** Application routing over prepared physical frames. The CSS scene owns every camera write. */
export function createPreparedWorldNavigation({ objects, windowTarget = window, documentTarget = document }) {
  const frames = new Map(objects.map(object => [object.id, object.worldFrame]));
  let lastCamera = null, lastOptics = null;
  const supports = (from, to) => {
    const a = frames.get(from), b = frames.get(to);
    return Boolean(a && b && a.referenceFrame === b.referenceFrame && a.epochJdTt === b.epochJdTt);
  };
  return Object.freeze({ supports,
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
      const controller = new AbortController();
      const cancel = () => controller.abort();
      signal.addEventListener('abort', cancel, { once: true });
      if (signal.aborted) cancel();
      let prepared;
      const preparation = toFactory.navigation.prepare({ signal: controller.signal }).then(value => {
        prepared = value;
        return value;
      });
      preparation.catch(() => {});
      try {
        // Source detail remains mounted while its own sky presents the trip.
        // The destination bank decodes concurrently, without a second scene.
        await Promise.all([preparation, source ? fly(source, from, target, toFactory.navigation.frame, controller.signal, reducedMotion) : Promise.resolve()]);
        if (controller.signal.aborted) throw cancelled();
        return {
          mountOptions: { preparedResources: prepared.resources, initialWorldCamera: source ? target : from },
          async afterMount(mount, { signal: mountedSignal }) {
            try {
              if (mountedSignal.aborted) throw cancelled();
              if (!mount.navigation) throw new Error('The destination camera is unavailable.');
              if (source) mount.navigation.apply(target);
              else {
                mount.navigation.apply(from);
                await fly(mount.navigation, from, target, toFactory.navigation.frame, mountedSignal, reducedMotion);
              }
              lastCamera = mount.navigation.capture(); lastOptics = mount.navigation.optics();
            } finally { signal.removeEventListener('abort', cancel); }
          },
        };
      } catch (error) {
        controller.abort(); prepared?.resources.destroy();
        signal.removeEventListener('abort', cancel);
        throw error;
      }
    },
  });

  function fly(owner, from, to, targetFrame, signal, reducedMotion) {
    const flight = createSelectionFlight({ from: from.pose, to: to.pose,
      focusPositionM: targetFrame.originM });
    return animateWorldFlight({ owner, from, to, flight, signal, reducedMotion,
      windowTarget, documentTarget, onPaint(world) { lastCamera = world; } });
  }
}

export function animateWorldFlight({ owner, from, to, flight, signal, reducedMotion,
  windowTarget, documentTarget, onPaint = () => {} }) {
  return new Promise((resolve, reject) => {
    let frameId = null, started = null, finished = false;
    const sample = createSelectionFlightSample();
    const events = ['pointerdown', 'wheel', 'keydown'];
    function finish(error) {
      if (finished) return;
      finished = true;
      if (frameId !== null) windowTarget.cancelAnimationFrame(frameId);
      signal.removeEventListener('abort', abort);
      for (const event of events) documentTarget.removeEventListener(event, interrupt, true);
      if (error) reject(error); else resolve();
    }
    function abort() { finish(cancelled()); }
    function interrupt(event) {
      if (!event.target?.closest?.('.planet-input-surface')) return;
      if (event.type === 'keydown' && !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '-', '=', 'Escape'].includes(event.key)) return;
      const error = cancelled(); error.preserveView = true;
      finish(error);
    }
    function paint(time) {
      frameId = null;
      if (finished) return;
      try {
        if (started === null) started = time;
        sampleSelectionFlightInto(flight, reducedMotion ? flight.durationS : (time - started) / 1000, sample);
        const world = { referenceFrame: from.referenceFrame, epochJdTt: from.epochJdTt,
          pose: { positionM: [...sample.positionM], orientationXyzw: [...sample.orientationXyzw] } };
        owner.apply(world); onPaint(world);
        if (sample.complete) finish(); else frameId = windowTarget.requestAnimationFrame(paint);
      } catch (error) { finish(error); }
    }
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) { abort(); return; }
    for (const event of events) documentTarget.addEventListener(event, interrupt, true);
    frameId = windowTarget.requestAnimationFrame(paint);
  });
}

function cancelled() { return new DOMException('Object flight was cancelled.', 'AbortError'); }
