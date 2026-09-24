import { createCameraFlight } from './camera-flight.js';
import { createOpacityClock } from '../stars/opacity-clock.js';

type FlightOptions = Parameters<typeof createCameraFlight>[0];
interface MotionOptions extends FlightOptions { inputSpeedUp?: number; }
export interface CameraTrajectory {
  windowTarget: FlightOptions['windowTarget'];
  sample(progress: number, signal: AbortSignal): void | Promise<boolean>;
  durationMilliseconds: number;
  signal?: AbortSignal;
  inputSpeedUp?: number;
  onFinish?(completed: boolean): void;
}

/** One flight owns the camera, including while its mounted detail changes. */
export function createCameraMotion() {
  type Flight = ReturnType<typeof createCameraFlight>;
  let active: { flight?: Flight; sourceSignal?: AbortSignal; inputSpeedUp?: number } | null = null;
  const motion = Object.freeze({
    get signal() { return active?.flight?.signal; },
    owns(signal: AbortSignal) { return active?.sourceSignal === signal; },
    cancel(signal?: AbortSignal) {
      if (signal && !motion.owns(signal)) return;
      const owner = active; active = null; owner?.flight?.cancel();
    },
    /** Destination input accelerates arrival; other input can take over. */
    hurryForInput() {
      if (!active?.inputSpeedUp || !active.flight) return false;
      active.flight.hurry(active.inputSpeedUp); return true;
    },
    arrive() { if (active?.inputSpeedUp) active.flight?.finish(); },
    start(options: MotionOptions) {
      const previous = active, owner: NonNullable<typeof active> = { sourceSignal: options.signal, inputSpeedUp: options.inputSpeedUp };
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
    fly({ windowTarget, sample, durationMilliseconds, signal, inputSpeedUp, onFinish }: CameraTrajectory) {
      if (!Number.isFinite(durationMilliseconds) || durationMilliseconds < 0) throw new TypeError('Invalid camera flight duration.');
      const clock = createOpacityClock(windowTarget);
      const flight = motion.start({ signal, inputSpeedUp, windowTarget: {
        requestAnimationFrame: callback => clock.request(callback, 'input'),
        cancelAnimationFrame: id => clock.cancel(id), performance: { now: clock.now },
      }, onFinish(completed) { clock.destroy(); onFinish?.(completed); }, advance(elapsedS) {
        const progress = durationMilliseconds === 0 ? 1 : Math.min(1, elapsedS * 1000 / durationMilliseconds);
        const acknowledge = (shown = true) => !shown || flight.signal.aborted ? 'idle' as const
          : progress === 1 ? 'complete' as const : 'presented' as const;
        const publication = sample(progress, flight.signal);
        return publication && typeof publication.then === 'function' ? publication.then(acknowledge) : acknowledge();
      } });
      if (durationMilliseconds === 0) flight.finish();
      return flight;
    },
  });
  return motion;
}
export type CameraMotion = ReturnType<typeof createCameraMotion>;
