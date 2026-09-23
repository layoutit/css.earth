import { createCameraFlight } from './camera-flight.js';

/** The application owns one flight, including while its mounted detail changes. */
export function createCameraMotion() {
  type Flight = ReturnType<typeof createCameraFlight>;
  let active: { flight?: Flight } | null = null;
  return Object.freeze({
    get signal() { return active?.flight?.signal; },
    cancel() { const owner = active; active = null; owner?.flight?.cancel(); },
    start(options: Parameters<typeof createCameraFlight>[0]) {
      const previous = active, owner: { flight?: Flight } = {};
      active = owner;
      previous?.flight?.cancel();
      const flight = createCameraFlight({ ...options, onFinish(completed) {
        if (active === owner) active = null;
        options.onFinish?.(completed);
      } });
      owner.flight = flight;
      // A cancellation callback may have started a newer flight synchronously.
      if (active !== owner) flight.cancel();
      return flight;
    },
  });
}
export type CameraMotion = ReturnType<typeof createCameraMotion>;
