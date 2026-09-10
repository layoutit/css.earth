export interface MarkerPresentation {
  size: number; ringAngle?: number; ringExtra?: number; ringHeight?: number; ringOpacity?: number;
  ringColorShare?: number; ringOutlineOpacity?: number; ringOutlineOffset?: number;
  scale?: Partial<Omit<MarkerPresentation, "scale">>;
}
export interface PreparedNavigationMarker { presentation: MarkerPresentation; index: number; count: number; context?: { url: string }; }
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
  return { ringed, style: [
    `--planet-color:${color}`,
    `--planet-size:${p.size * scale}px`,
    `--planet-marker-count:${marker.count}`,
    `--planet-marker-position:${(marker.index / Math.max(1, marker.count - 1) * 100).toFixed(4)}%`,
    ...(ringed ? [
      `--planet-ring-angle:${p.ringAngle}deg`,
      `--planet-ring-extra:${(p.ringExtra ?? Number.NaN) * scale}px`,
      `--planet-ring-height:${(p.ringHeight ?? Number.NaN) * scale}px`,
      `--planet-ring-opacity:${p.ringOpacity ?? 0.65}`,
      `--planet-ring-color:color-mix(in srgb, currentColor ${p.ringColorShare ?? 100}%, white)`,
      `--planet-ring-outline:1px solid color-mix(in srgb, currentColor ${p.ringOutlineOpacity ?? 0}%, transparent)`,
      `--planet-ring-outline-offset:${p.ringOutlineOffset ?? 0}px`,
    ] : []),
  ].join(";") };
}

// Resolved context uses its prepared native-density image. Layout size is still
// the same physical proxy basis used by the world camera; DPR never selects it.
export function contextMarkerSprite(marker: PreparedNavigationMarker) {
  return {
    url: marker.context?.url ?? "/navigation/planet-markers@2x.webp",
    index: marker.context ? 0 : marker.index,
    count: marker.context ? 1 : marker.count,
    size: marker.presentation.size,
  };
}
