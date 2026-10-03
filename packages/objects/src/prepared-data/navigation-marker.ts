/** Authored navigation marker wire records; image preparation stays with bake. */
/** A pin identifies bytes git does not hold; a marker image authored in this repository carries none. */
export interface MarkerSource { path: string; origin: string; credit: string; license: string; raster?: { kind: string }; width?: number; height?: number; }
/** Fields an object's marker recipe may add to its source: decoding hints its manifest record does not carry. */
export const MARKER_SOURCE_HINTS = ['raster'] as const;
export type MarkerOperation =
  | { type: "linear"; multiplier: number; offset: number }
  | { type: "rotate" | "ensure-alpha" | "png" }
  | { type: "trim"; threshold: number }
  | { type: "extract"; left: number; top: number; width: number; height: number }
  | { type: "resize"; width: string; height: string; kernel: "lanczos3"; fit?: "cover"; position?: "centre" }
  | { type: "missing-coverage"; kind: string; southConnected: boolean; northConnected?: boolean }
  | { type: "ellipse-mask"; cx: number; cy: number; rx: number; ry: number; shading?: { ambient: number; diffuse: number } }
  /** A 2:1 equirectangular map seen as a globe from far away, centred on the map point at these fractions of its width
   * (longitude) and height (latitude). Outside the disc is transparent. */
  | { type: "orthographic"; centerX: number; centerY: number };
export interface MarkerDescriptor { presentation?: unknown; schema: string; objectId: string; owner: string; source: MarkerSource; operations: readonly MarkerOperation[]; context?: { pixels: number }; }
