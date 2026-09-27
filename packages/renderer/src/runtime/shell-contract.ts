import type { LensControl, SettingControl } from './object-contract.js';
import type { ObjectSceneLifecycle } from './object-scene.js';
// A `.ts` sibling, so Node tools can load this module from its source subpath without a bundler.
import { SHELL_SETTING_NAMES } from './shell-settings.ts';

// The shell checks this lifecycle shape. The renderer supplies the complete
// scene contract, including shared-view and navigation capabilities.
export type SceneLifecycle = Pick<ObjectSceneLifecycle, "pause" | "resume" | "destroy"> & {
  readonly ready: PromiseLike<unknown>;
};

// Shell content validation checks IDs and live control values. Lens labels,
// presentation fields and cycle-state tables belong to their owning validators.
type ShellSettingControl = Extract<SettingControl, { kind: "toggle" }>
  | Omit<Extract<SettingControl, { kind: "cycle" }>, "states">;

export interface ShellObjectControls {
  readonly lenses: {
    readonly defaultLens?: unknown;
    readonly controls: readonly Pick<LensControl, "id">[];
  } | null | undefined;
  readonly settings: {
    readonly controls: readonly ShellSettingControl[];
  } | null | undefined;
}


function objectLike(value: unknown): value is Record<string, unknown> {
  return value !== null && (typeof value === "object" || typeof value === "function");
}

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

function controls(value: unknown, name: "lenses" | "settings", objectId: string): readonly unknown[] {
  if (value == null) return [];
  if (!objectLike(value) || !Array.isArray(value.controls)) {
    throw new TypeError(`Object ${objectId} ${name} controls must be an array.`);
  }
  return value.controls;
}

// This validates the actual content supplied to the shared shell, not a second
// declaration of supported capabilities. Unknown data stays unknown until its
// properties have passed the corresponding runtime checks.
export function requireObjectControls(content: unknown, objectId = "unknown"): ShellObjectControls {
  if (!content || typeof content !== "object" ||
      !Object.hasOwn(content, "lenses") || !Object.hasOwn(content, "settings")) {
    throw new TypeError(`Object ${objectId} must export its lenses and settings content.`);
  }
  const record = content as Record<string, unknown>;
  const lenses = controls(record.lenses, "lenses", objectId);
  const settings = controls(record.settings, "settings", objectId);
  const lensIds = lenses.map((lens) => objectLike(lens) ? lens.id : undefined);
  const defaultLens = objectLike(record.lenses) ? record.lenses.defaultLens : undefined;
  if (lensIds.some((id) => typeof id !== "string" || !id) ||
      new Set(lensIds).size !== lensIds.length ||
      (lenses.length && !lensIds.includes(defaultLens))) {
    throw new TypeError(`Object ${objectId} lens IDs/default are invalid.`);
  }
  const names = settings.map((setting) => objectLike(setting) ? setting.name : undefined);
  if (names.some((name) => typeof name !== "string" || !name ||
      SHELL_SETTING_NAMES.has(name)) ||
      new Set(names).size !== names.length ||
      settings.some((setting) => !objectLike(setting) ||
        (setting.kind !== "toggle" && setting.kind !== "cycle") ||
        typeof setting.label !== "string" || !setting.label ||
        (setting.kind === "toggle" ? typeof setting.checked !== "boolean"
          : typeof setting.state !== "string"))) {
    throw new TypeError(`Object ${objectId} settings controls are invalid.`);
  }
  return content as ShellObjectControls;
}
