import { requireControls } from "../../src/renderers/css/dist/index.js";
import { requireObjectControls } from "../../src/renderers/css/dist/platform/object-contract.js";
import type { ObjectControls } from "../../src/renderers/css/dist/platform/object-contract.js";
import type {
  BrowserPage,
  CameraBounds,
  CameraField,
  CameraState,
  CreateObjectBrowserProfileOptions,
  ObjectBrowserProfile,
} from "./browser-profile-types.mts";

const profiles = new WeakSet<object>();
export const isObjectBrowserProfile = (profile: unknown): profile is ObjectBrowserProfile =>
  typeof profile === "object" && profile !== null && profiles.has(profile);

type BrowserObjectRuntime = {
  readonly ready?: boolean;
  readonly camera: {
    state(): CameraState;
    setState(state: Partial<CameraState>): unknown;
    stats(): {
      readonly minimumPitchDegrees: number;
      readonly maximumPitchDegrees: number;
      readonly defaultControlPitchDegrees: number;
      readonly pitchBounded: boolean;
      readonly minimumZoom: number;
      readonly maximumZoom: number;
      readonly defaultZoom: number;
    };
  };
  readonly runtime: {
    playback(): { readonly animations: readonly { readonly running: boolean }[] };
    resources(): { readonly images: { readonly entries: readonly { readonly ready: boolean }[] } };
    selection(): { readonly committed: { readonly lensId: string | null } };
  };
  readonly lenses: {
    select(lensId: string): boolean;
    state(): Record<string, unknown>;
  };
  readonly renderStats: { readonly selectedPreparedDensity: number };
  readonly assertStableDomIdentity: () => boolean;
  readonly dom: { readonly retainedInitialNodeCount: number };
  readonly stableNodes: { readonly length: number };
};

export function requireBrowserProfileControls(value: unknown, objectId: string): ObjectControls {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`Object ${objectId} must export object controls.`);
  }
  requireControls(value);
  return requireObjectControls(value, objectId);
}

export function browserProfileLensIds(value: unknown, objectId = "unknown"): readonly string[] {
  return requireBrowserProfileControls(value, objectId).lenses?.controls.map((lens) => lens.id) ?? [];
}

// The profile supplies observations and user actions for the actual common
// runtime. Object files supply audit/source facts and declarative view mappings.
export function createObjectBrowserProfile({
  id,
  audit,
  controls,
  visibleViews = [],
  cameraFields = ["pitch", "zoom"],
}: CreateObjectBrowserProfileOptions): ObjectBrowserProfile {
  const objectControls = requireBrowserProfileControls(controls, id);
  const supportedCameraFields: readonly CameraField[] = ["pitch", "controlPitch", "controlYaw", "zoom"];
  if (!Array.isArray(cameraFields) || !cameraFields.includes("pitch") || !cameraFields.includes("zoom") ||
      new Set(cameraFields).size !== cameraFields.length || cameraFields.some((field) => !supportedCameraFields.includes(field))) {
    throw new TypeError("Camera observation fields must use the shared orbit coordinates and include pitch and zoom.");
  }
  const observedFields = Object.freeze([...cameraFields]);
  const lensIds = objectControls.lenses?.controls.map((lens) => lens.id) ?? [];
  for (const view of visibleViews) {
    if (!lensIds.includes(view.lensId) || !view.attribute.startsWith("data-")) {
      throw new TypeError("Visible view mapping must name a retained stage attribute and actual lens.");
    }
  }
  const key = `__${id}`;
  const defaultLens = objectControls.lenses?.defaultLens ?? null;
  const profile: ObjectBrowserProfile = {
    id,
    inputSelector: ".planet-input-surface",
    audit,
    objectControls,
    async waitForRuntime(page: BrowserPage): Promise<void> {
      if (await page.evaluate((runtimeKey) => (window as unknown as Record<string, BrowserObjectRuntime>)[runtimeKey]?.ready === true, key)) return;
      await page.waitForFunction((runtimeKey) => (window as unknown as Record<string, BrowserObjectRuntime>)[runtimeKey]?.ready === true, key);
    },
    pause: (page) => page.evaluate(() => {
      const input = document.querySelector<HTMLInputElement>('input[name="motion"]');
      if (input?.checked) input.click();
    }),
    playbackRunning: (page) => page.evaluate((runtimeKey) =>
      (window as unknown as Record<string, BrowserObjectRuntime>)[runtimeKey].runtime.playback().animations.some((animation) => animation.running), key),
    camera: (page) => page.evaluate(({ runtimeKey, fields }: { readonly runtimeKey: string; readonly fields: readonly CameraField[] }) => {
      const state = (window as unknown as Record<string, BrowserObjectRuntime>)[runtimeKey].camera.state();
      return Object.fromEntries(fields.map((field) => [field, state[field]]));
    }, { runtimeKey: key, fields: observedFields }),
    setCamera: (page, { pitch, controlPitch = pitch, controlYaw, zoom }) => page.evaluate(({ runtimeKey, nextPitch, nextYaw, nextZoom }) =>
      (window as unknown as Record<string, BrowserObjectRuntime>)[runtimeKey].camera.setState({ controlPitch: nextPitch, ...(nextYaw === undefined ? {} : { controlYaw: nextYaw }), zoom: nextZoom }),
    { runtimeKey: key, nextPitch: pitch ?? controlPitch, nextYaw: controlYaw, nextZoom: zoom }),
    bounds: (page) => page.evaluate((runtimeKey): CameraBounds => {
      const stats = (window as unknown as Record<string, BrowserObjectRuntime>)[runtimeKey].camera.stats();
      return { minimumPitch: stats.minimumPitchDegrees, maximumPitch: stats.maximumPitchDegrees,
        defaultPitch: stats.defaultControlPitchDegrees, pitchBounded: stats.pitchBounded,
        minimumZoom: stats.minimumZoom, maximumZoom: stats.maximumZoom, defaultZoom: stats.defaultZoom };
    }, key),
    stable: (page) => page.evaluate((runtimeKey) => (window as unknown as Record<string, BrowserObjectRuntime>)[runtimeKey].assertStableDomIdentity(), key),
    runtimePresent: (page) => page.evaluate((runtimeKey) => typeof (window as unknown as Record<string, unknown>)[runtimeKey] !== "undefined", key),
    retainedImages: (page) => page.evaluate((runtimeKey) => (window as unknown as Record<string, BrowserObjectRuntime>)[runtimeKey].runtime.resources().images.entries.filter((entry) => entry.ready).length, key),
    selectedDensity: (page) => page.evaluate((runtimeKey) => (window as unknown as Record<string, BrowserObjectRuntime>)[runtimeKey].renderStats.selectedPreparedDensity, key),
    selectLens: (page, lensId) => page.evaluate(({ runtimeKey, selectedLensId }) => (window as unknown as Record<string, BrowserObjectRuntime>)[runtimeKey].lenses.select(selectedLensId), { runtimeKey: key, selectedLensId: lensId }),
    lens: (page) => page.evaluate((runtimeKey) => {
      const runtime = (window as unknown as Record<string, BrowserObjectRuntime>)[runtimeKey];
      return { ...runtime.lenses.state(), id: runtime.runtime.selection().committed.lensId };
    }, key),
    visibleLens: (page) => page.locator(".planet-stage").evaluate((stage, mappings) =>
      mappings.visibleViews.find((view) => stage.getAttribute(view.attribute) === view.value)?.lensId ??
        stage.getAttribute("data-lens") ?? mappings.defaultLens,
    { defaultLens, visibleViews }),
    pressedLens: (page) => page.evaluate(() => {
      const pressed = [...document.querySelectorAll<HTMLButtonElement>('button[name="lens"][aria-pressed="true"]')].map((button) => button.value);
      if (pressed.length > 1) throw new Error(`Lens selection is exclusive; found multiple pressed buttons: ${pressed.join(", ")}`);
      return pressed[0] ?? null;
    }),
    retainedReport: (page) => page.evaluate((runtimeKey) => {
      const runtime = (window as unknown as Record<string, BrowserObjectRuntime>)[runtimeKey];
      return { initialNodeCount: runtime.dom.retainedInitialNodeCount, stableNodeCount: runtime.stableNodes.length };
    }, key),
  };
  const frozenProfile = Object.freeze(profile);
  profiles.add(frozenProfile);
  return frozenProfile;
}
