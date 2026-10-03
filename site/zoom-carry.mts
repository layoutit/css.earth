import { dollyPoseAboutFocus } from '@cssearth/engine';
import { opacityClockFor } from '@cssearth/renderer';
import { worldCameraViewport, type presentWorldCamera } from '@cssearth/renderer/navigation/world-camera.ts';
import type { ObjectWorldNavigation } from '@cssearth/renderer/runtime/world-navigation-types.ts';

type WorldCamera = Parameters<typeof presentWorldCamera>[0];
type Optics = ReturnType<ObjectWorldNavigation['optics']>;
type PresentWorld = (world: WorldCamera, viewport: Optics, options: { signal: AbortSignal }) => unknown;
/** The scene's optics at a camera's projection scale. */
const viewportAt = (world: WorldCamera, optics: Optics): Optics => worldCameraViewport(world, optics);

/** The zoom is the world camera's, not a scene's. Each scene has its own wheel controls, and between the old scene's
 * retirement and the new one's mount nothing owned the camera: a steady zoom stood still through every hand-over, and a
 * glide that crossed one stopped dead. This carries the camera across: from the departing scene's last camera it keeps
 * the rate that scene's zoom had, publishes the shared world on each frame, and gives the new scene the latest camera
 * and the rate to take up. One scene is mounted throughout. On the iPad a steady zoom out of Earth had 9 frames with
 * nothing drawn in about 140 with the scenes handing over as they did, and 3 with the carry and the plan rule of
 * prepared-world-context.ts (interleaved runs, 2026-10-03). */
export function createZoomCarry({ windowTarget, presentWorld, signal, onMove }: {
  windowTarget: Parameters<typeof opacityClockFor>[0]; presentWorld: PresentWorld | null; signal: AbortSignal;
  /** Each camera the carry draws. */ onMove?(world: WorldCamera): void;
}) {
  const clock = opacityClockFor(windowTarget);
  let carried: { world: WorldCamera; viewport: Optics; rate: number; previous: number; frame: number } | null = null;
  const step = (time: number) => {
    const carry = carried;
    if (!carry || signal.aborted) return;
    const elapsed = Math.max(0, time - carry.previous);
    carry.previous = time;
    if (elapsed > 0) {
      carry.world = { ...carry.world, pose: dollyPoseAboutFocus(carry.world.pose, Math.exp(carry.rate * elapsed)) };
      onMove?.(carry.world);
      void presentWorld!(carry.world, viewportAt(carry.world, carry.viewport), { signal });
    }
    carry.frame = clock.request(step, 'input');
  };
  return {
    /** The carried camera, or null while nothing is carried. */
    world: () => carried?.world ?? null,
    /** Take the camera from a scene about to be retired, moving at \`rate\` (log units per millisecond, positive recedes). */
    begin(world: WorldCamera, viewport: Optics, rate: number) {
      if (rate === 0 || !presentWorld || signal.aborted) return;
      // The departing scene's last frame is still waiting to be drawn and goes with the scene: draw it from here.
      void presentWorld(world, viewportAt(world, viewport), { signal });
      carried = { world, viewport, rate, previous: clock.now(), frame: 0 };
      carried.frame = clock.request(step, 'input');
    },
    /** Stop, and say what the next owner takes up: the camera and the rate, or null when nothing was carried. */
    end(): { world: WorldCamera; rate: number } | null {
      const carry = carried;
      carried = null;
      if (!carry) return null;
      clock.cancel(carry.frame);
      return { world: carry.world, rate: carry.rate };
    },
  };
}
