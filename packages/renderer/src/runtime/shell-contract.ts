import type { ObjectSceneLifecycle } from './object-scene.js';
// A `.ts` sibling, so Node tools can load this module from its source subpath without a bundler.

// The shell checks this lifecycle shape. The renderer supplies the complete
// scene contract, including shared-view and navigation capabilities.
export type SceneLifecycle = Pick<ObjectSceneLifecycle, "pause" | "resume" | "destroy"> & {
  readonly ready: PromiseLike<unknown>;
};

export function requireSceneLifecycle(mount: unknown, objectId = "unknown"): SceneLifecycle {
  // Shape only. The scene session retains the handle before validation and
  // commands playback under the application's shared policy. Cancellation,
  // failure cleanup and idempotence are earned by executable lifecycle tests.
  if (!objectLike(mount) || !objectLike(mount.ready) ||
      typeof mount.ready.then !== "function" ||
      typeof mount.pause !== "function" ||
      typeof mount.resume !== "function" ||
      typeof mount.destroy !== "function") {
    throw new TypeError(
      `cssEarth scene ${objectId} must provide ready, pause, resume, and destroy.`,
    );
  }
  return mount as SceneLifecycle;
}

function objectLike(value: unknown): value is Record<string, unknown> {
  return value !== null && (typeof value === "object" || typeof value === "function");
}
