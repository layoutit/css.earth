import { validatePreparedCssVolume, type PreparedCssVolume } from '@cssearth/objects';
import type { PreparedMaterialVolumeRuntime, PreparedVolumeMountOptions, VolumeCameraPublication } from './types.js';

const held = new WeakMap<PreparedCssVolume, readonly PreparedCssVolume[]>();
/** Transport already prepared local banks into the same physical frame; no geometry is computed here. */
export function preparedVolumeParts(input: PreparedCssVolume): readonly PreparedCssVolume[] {
  const payload = validatePreparedCssVolume(input), cached = held.get(payload);
  if (cached) return cached;
  const { components, ...base } = payload;
  const resources = new Map(payload.resources.map(r => [r.path, r]));
  const parts = [validatePreparedCssVolume(base), ...(components ?? []).map(component => {
    const paths = new Set(component.stacks.flatMap(s => s.leaves.map(l => l.texturePath)));
    return validatePreparedCssVolume({ schema: payload.schema, id: component.id,
      frame: { ...payload.frame, boundsUnits: component.boundsUnits }, anchors: [], stacks: component.stacks,
      resources: [...paths].map(path => resources.get(path)!), stackCompositing: 'transparent-normalized',
      ...(component.mergedOpticalCopies ? { mergedOpticalCopies: component.mergedOpticalCopies } : {}) });
  })];
  held.set(payload, parts); return parts;
}

export function mountPreparedVolumeComponents(options: PreparedVolumeMountOptions, mount: (options: PreparedVolumeMountOptions) => PreparedMaterialVolumeRuntime): PreparedMaterialVolumeRuntime {
  const parts = preparedVolumeParts(options.payload), counts = parts.map(p => p.stacks.reduce((n, s) => n + s.leaves.length, 0));
  const runtimes = parts.map(payload => mount({ ...options, payload }));
  const offsets = counts.map((_, i) => counts.slice(0, i).reduce((n, v) => n + v, 0)), total = counts.reduce((n, v) => n + v, 0);
  return Object.freeze({ roots: Object.freeze(runtimes.flatMap(r => r.roots)),
    publish(publication: VolumeCameraPublication) { for (const runtime of runtimes) runtime.publish(publication); },
    setTexture(index: number, url: string) { const part = offsets.findIndex((start, i) => index >= start && index < start + counts[i]!); if (part < 0) throw new TypeError('Invalid component material index.'); runtimes[part]!.setTexture(index - offsets[part]!, url); },
    setTextures(urls: readonly string[]) { if (urls.length !== total) throw new TypeError('Invalid component texture count.'); runtimes.forEach((r, i) => r.setTextures(urls.slice(offsets[i], offsets[i]! + counts[i]!))); },
    setMaterials(materials: Parameters<PreparedMaterialVolumeRuntime['setMaterials']>[0]) { if (materials.length !== total) throw new TypeError('Invalid component material count.'); runtimes.forEach((r, i) => r.setMaterials(materials.slice(offsets[i], offsets[i]! + counts[i]!))); },
    destroy() { for (const runtime of runtimes) runtime.destroy(); },
  });
}
