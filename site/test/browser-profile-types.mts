import type { ObjectControls } from "../../src/renderers/css/dist/platform/object-contract.js";

export type CameraField = "pitch" | "controlPitch" | "controlYaw" | "zoom";

export interface CameraState {
  readonly pitch: number;
  readonly controlPitch: number;
  readonly controlYaw: number;
  readonly zoom: number;
}

export interface CameraBounds {
  readonly minimumPitch: number;
  readonly maximumPitch: number;
  readonly defaultPitch: number;
  readonly pitchBounded: boolean;
  readonly minimumZoom: number;
  readonly maximumZoom: number;
  readonly defaultZoom: number;
}

export interface VisibleView {
  readonly lensId: string;
  readonly attribute: string;
  readonly value: string;
}

export interface BrowserProfileAudit {
  readonly preparedAssetPairs: readonly { readonly one: string; readonly two: string }[];
  readonly canonicalPreparedAssets?: readonly string[];
  readonly retained: {
    readonly lensIds?: readonly string[];
    readonly speedClicks?: number;
    readonly allowedMountSelectors: readonly string[];
  };
  readonly lensRace?: {
    readonly defaultId: string;
    readonly slowId: string;
    readonly winnerId: string;
    readonly slowAsset: string;
    readonly preReadyDisabled: boolean;
  };
  readonly [name: string]: unknown;
}

export interface BrowserPage {
  evaluate<Result>(callback: () => Result | Promise<Result>): Promise<Awaited<Result>>;
  evaluate<Argument, Result>(callback: (argument: Argument) => Result | Promise<Result>, argument: Argument): Promise<Awaited<Result>>;
  waitForFunction<Argument>(callback: (argument: Argument) => boolean | Promise<boolean>, argument: Argument): Promise<unknown>;
  locator(selector: string): {
    evaluate<Argument, Result>(callback: (element: Element, argument: Argument) => Result | Promise<Result>, argument: Argument): Promise<Awaited<Result>>;
  };
}

export interface ObjectBrowserProfile {
  readonly id: string;
  readonly inputSelector: ".planet-input-surface";
  readonly audit?: BrowserProfileAudit;
  readonly objectControls: ObjectControls;
  waitForRuntime(page: BrowserPage): Promise<void>;
  pause(page: BrowserPage): Promise<unknown>;
  playbackRunning(page: BrowserPage): Promise<boolean>;
  camera(page: BrowserPage): Promise<Partial<CameraState>>;
  setCamera(page: BrowserPage, state: Partial<CameraState> & Pick<CameraState, "zoom">): Promise<unknown>;
  bounds(page: BrowserPage): Promise<CameraBounds>;
  stable(page: BrowserPage): Promise<boolean>;
  runtimePresent(page: BrowserPage): Promise<boolean>;
  retainedImages(page: BrowserPage): Promise<number>;
  selectedDensity(page: BrowserPage): Promise<number>;
  selectLens(page: BrowserPage, lensId: string): Promise<boolean>;
  lens(page: BrowserPage): Promise<{ readonly id: string | null; readonly [name: string]: unknown }>;
  visibleLens(page: BrowserPage): Promise<string | null>;
  pressedLens(page: BrowserPage): Promise<string | null>;
  retainedReport(page: BrowserPage): Promise<{ readonly initialNodeCount: number; readonly stableNodeCount: number }>;
}

export interface CreateObjectBrowserProfileOptions {
  readonly id: string;
  readonly audit?: BrowserProfileAudit;
  readonly controls: unknown;
  readonly visibleViews?: readonly VisibleView[];
  readonly cameraFields?: readonly CameraField[];
}
