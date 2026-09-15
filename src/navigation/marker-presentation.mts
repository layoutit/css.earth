import { DEFAULT_CONTEXT_LABEL_OPACITY } from '../renderers/css/labels/label-presentation.ts';

export interface MarkerPresentation {
  size: number; ringAngle?: number; ringExtra?: number; ringHeight?: number; ringOpacity?: number;
  ringColorShare?: number; ringOutlineOpacity?: number; ringOutlineOffset?: number;
  scale?: Partial<Omit<MarkerPresentation, "scale">>;
}
export interface PreparedNavigationMarker { url: string; url2x: string; url2xPixels?: number; presentation: MarkerPresentation; index: number; count: number; context?: { url: string; pixels?: number }; }
// Shared shell presentation; values come only from each object's marker recipe.
const fields = new Set(["size", "ringAngle", "ringExtra", "ringHeight", "ringOpacity", "ringColorShare", "ringOutlineOpacity", "ringOutlineOffset"]);
export function validateMarkerPresentation(input: unknown, partial?: false): MarkerPresentation;
export function validateMarkerPresentation(input: unknown, partial: true): Partial<MarkerPresentation>;
export function validateMarkerPresentation(input: unknown, partial: boolean): Partial<MarkerPresentation>;
export function validateMarkerPresentation(input: unknown, partial = false): Partial<MarkerPresentation> {
  const value = input as Partial<MarkerPresentation>;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError("Marker presentation is missing.");
  for (const [key, number] of Object.entries(value)) {
    if (key === "scale" && !partial) {
      if (typeof number !== "object" || number === null) throw new TypeError("Marker presentation is missing.");
      validateMarkerPresentation(number, true); continue;
    }
    if (!fields.has(key) || typeof number !== "number" || !Number.isFinite(number)) throw new TypeError(`Invalid marker presentation field: ${key}.`);
    if (key !== "ringAngle" && number < 0) throw new TypeError(`Negative marker presentation: ${key}.`);
    if (["size", "ringExtra", "ringHeight"].includes(key) && number === 0) throw new TypeError(`Empty marker dimension: ${key}.`);
    if (["ringColorShare", "ringOutlineOpacity"].includes(key) && number > 100 || key === "ringOpacity" && number > 1) throw new TypeError(`Invalid marker opacity: ${key}.`);
  }
  if (!partial && (!((value.size ?? Number.NaN) > 0) || Object.keys(value).some((key) => key.startsWith("ring")) && !(value.ringAngle !== undefined && (value.ringExtra ?? Number.NaN) > 0 && (value.ringHeight ?? Number.NaN) > 0))) throw new TypeError("Incomplete marker presentation.");
  if (!partial && value.scale) {
    const { scale, ...base } = value;
    validateMarkerPresentation({ ...base, ...scale });
  }
  return value;
}

export function markerStyle(marker: PreparedNavigationMarker, { color, scale = 1, view = "navigation" }: { color?: string; scale?: number; view?: string } = {}) {
  if (!marker) throw new Error("Prepared object marker is missing; run prepare:navigation.");
  const p = view === "scale" ? { ...marker.presentation, ...marker.presentation.scale } : marker.presentation;
  const ringed = p.ringAngle !== undefined;
  const size = p.size * scale;
  const position = `${(marker.index / Math.max(1, marker.count - 1) * 100).toFixed(4)}%`;
  return {
    ringed,
    style: `color:${color}`,
    innerStyle: `width:${size}px;height:${size}px;background-image:url("${marker.url2x}");background-position:${position} center;background-size:${marker.count * 100}% 100%`,
    ringStyle: ringed ? [
      `width:${size + (p.ringExtra ?? Number.NaN) * scale}px`,
      `height:${(p.ringHeight ?? Number.NaN) * scale}px`,
      `border-color:color-mix(in srgb, currentColor ${p.ringColorShare ?? 100}%, white)`,
      `opacity:${p.ringOpacity ?? 0.65}`,
      `transform:translate(-50%, -50%) rotate(${p.ringAngle}deg)`,
      `outline:${p.ringOutlineOpacity ? `1px solid color-mix(in srgb, currentColor ${p.ringOutlineOpacity}%, transparent)` : "none"}`,
      `outline-offset:${p.ringOutlineOffset ?? 0}px`,
    ].join(";") : "",
  };
}

// Resolved context uses its prepared native-density image. Layout size is still
// the same physical proxy basis used by the world camera; DPR never selects it.
// Most markers are drawn a few pixels wide: they show the prepared @2x tile,
// two texels per CSS pixel, and switch to the large context image only when
// drawn wider than that tile can resolve. Neither image is resized at runtime.
export function contextMarkerSprite(marker: PreparedNavigationMarker) {
  const tile = { url: marker.url2x, index: marker.index, count: marker.count, size: marker.presentation.size };
  if (!marker.context) return tile;
  const detail = { url: marker.context.url, index: 0, count: 1 };
  if (!(marker.url2xPixels && marker.url2xPixels > 0)) return { ...detail, size: marker.presentation.size };
  return { ...tile, detail: { ...detail, fromDiameterPixels: marker.url2xPixels / 2 } };
}

// Existing scene annotation weights, supplied once from the object registry.
export function contextAnnotationOpacity(classification: string): { line: number; label: number } {
  return {
    line: classification === 'asteroid' ? .35
      : ['satellite', 'dwarf-planet', 'trans-neptunian', 'comet', 'interstellar'].includes(classification) ? .5 : .65,
    label: ['dwarf-planet', 'comet', 'trans-neptunian', 'interstellar'].includes(classification) ? .5 : DEFAULT_CONTEXT_LABEL_OPACITY,
  };
}
