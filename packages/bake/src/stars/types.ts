export interface RuntimeLabelPolicy {
  readonly activeSlots: number; readonly transitionSlots: number; readonly capHeightPx: number;
  readonly gapPx: number; readonly maxAlpha: number; readonly fadeMs: number;
}
export interface StarsRecipe {
  readonly schema: 'cssearth-stars-source@1';
  readonly catalogue: { readonly path: string; readonly count: number; readonly idPrefix: string };
  readonly provenance: { readonly path: string };
  readonly license: { readonly path: string };
  readonly tree: { readonly leafSize: number; readonly maximumDepth: number };
  readonly colors: { readonly count: number; readonly minimumTemperatureK: number; readonly maximumTemperatureK: number };
  readonly coverage: { readonly faceDivisions: number };
  readonly atlas: { readonly tileSize: number; readonly haloRadii: number; readonly coreInnerRadii: number; readonly coreOuterRadii: number; readonly haloPeak: number; readonly samplesPerPixelAxis: number };
  readonly photometry: { readonly minimumMagnitude: number; readonly maximumMagnitude: number; readonly step: number; readonly fovDegrees: number; readonly screenFactor: number; readonly floor: number };
  readonly policy: { readonly activeSlots: number; readonly transitionSlots: number; readonly maxErrorPx: number; readonly transitionMs: number };
  readonly labels: RuntimeLabelPolicy;
  readonly diffuseSky?: { readonly faces: readonly { readonly id: string; readonly path: string }[]; readonly width: number; readonly blurSigmaPixels: number };
}
