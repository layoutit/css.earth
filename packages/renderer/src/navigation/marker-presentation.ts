import type { MarkerPresentation } from '@cssearth/objects';
import { DEFAULT_CONTEXT_LABEL_OPACITY } from '../labels/label-presentation.ts';
export interface PreparedNavigationMarker { url2x: string; url2xPixels?: number; presentation: MarkerPresentation; index: number; count: number; context?: { url: string; pixels?: number }; }
export interface ResolvedMarkerStyle {
  color?: string;
  size: number;
  image: string;
  position: string;
  backgroundSize: string;
  ring: null | {
    width: number;
    height: number;
    colorShare: number;
    opacity: number;
    angle: number;
    outlineOpacity: number;
    outlineOffset: number;
  };
}

export function resolveMarkerStyle(marker: PreparedNavigationMarker, { color, scale = 1, view = "navigation" }: { color?: string; scale?: number; view?: string } = {}): ResolvedMarkerStyle {
  if (!marker) throw new Error("Prepared object marker is missing; run prepare:navigation.");
  const p = view === "scale" ? { ...marker.presentation, ...marker.presentation.scale } : marker.presentation;
  const ringed = p.ringAngle !== undefined;
  const size = p.size * scale;
  const position = `${(marker.index / Math.max(1, marker.count - 1) * 100).toFixed(4)}%`;
  return {
    color,
    size,
    image: marker.url2x,
    position,
    backgroundSize: `${marker.count * 100}% 100%`,
    ring: ringed ? {
      width: size + (p.ringExtra ?? Number.NaN) * scale,
      height: (p.ringHeight ?? Number.NaN) * scale,
      colorShare: p.ringColorShare ?? 100,
      opacity: p.ringOpacity ?? 0.65,
      angle: p.ringAngle!,
      outlineOpacity: p.ringOutlineOpacity ?? 0,
      outlineOffset: p.ringOutlineOffset ?? 0,
    } : null,
  };
}

export function markerStyle(marker: PreparedNavigationMarker, options: { color?: string; scale?: number; view?: string } = {}) {
  const resolved = resolveMarkerStyle(marker, options);
  return {
    ringed: resolved.ring !== null,
    style: `color:${resolved.color}`,
    innerStyle: `width:${resolved.size}px;height:${resolved.size}px;background-image:url("${resolved.image}");background-position:${resolved.position} center;background-size:${resolved.backgroundSize}`,
    ringStyle: resolved.ring ? [
      `width:${resolved.ring.width}px`,
      `height:${resolved.ring.height}px`,
      `border-color:color-mix(in srgb, currentColor ${resolved.ring.colorShare}%, white)`,
      `opacity:${resolved.ring.opacity}`,
      `transform:translate(-50%, -50%) rotate(${resolved.ring.angle}deg)`,
      `outline:${resolved.ring.outlineOpacity ? `1px solid color-mix(in srgb, currentColor ${resolved.ring.outlineOpacity}%, transparent)` : "none"}`,
      `outline-offset:${resolved.ring.outlineOffset}px`,
    ].join(";") : "",
  };
}

// Existing scene annotation weights, supplied once from the object registry.
export function contextAnnotationOpacity(classification: string): { line: number; label: number } {
  return {
    line: ['asteroid', 'comet'].includes(classification) ? .2
      : ['satellite', 'dwarf-planet', 'trans-neptunian', 'interstellar'].includes(classification) ? .5 : .65,
    label: ['dwarf-planet', 'comet', 'trans-neptunian', 'interstellar'].includes(classification) ? .5 : DEFAULT_CONTEXT_LABEL_OPACITY,
  };
}
