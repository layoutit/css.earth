/** Match two prepared material banks without changing the retained scene geometry. */
import type { PreparedCssVolume } from '../../adapters/viewer/prepared-loaders';
import type { ToneResource } from '../../adapters/viewer/tone-runtime';

/** Saved results may swap materials in place only when they claim the same model geometry and the same star layer. */
export function sharesMaterialGeometry(current: { materialGeometry?: string; stars?: string; comparisonGroup?: string },
  next: { materialGeometry?: string; stars?: string; comparisonGroup?: string }): boolean {
  return current.materialGeometry !== undefined && current.materialGeometry === next.materialGeometry &&
    current.stars === next.stars && current.comparisonGroup === next.comparisonGroup;
}

/**
 * The mounted bank's texture paths stay the binding keys (`mountedDirectory`); each replacement URL comes from
 * `replacementDirectory`. Throws unless every retained leaf keeps its identity, extent, placement and style.
 */
export function materialResources(original: PreparedCssVolume, replacement: PreparedCssVolume, mountedDirectory: string,
  replacementDirectory: string, url: (path: string) => string): (ToneResource & { replacementPath: string })[] {
  if (JSON.stringify(original.frame) !== JSON.stringify(replacement.frame) || original.stacks.length !== replacement.stacks.length)
    throw new TypeError('Material bank changes the prepared physical frame.');
  const paths = new Map<string, string>();
  for (let s = 0; s < original.stacks.length; s++) {
    const left = original.stacks[s]!, right = replacement.stacks[s]!;
    if (left.axis !== right.axis || left.leaves.length !== right.leaves.length) throw new TypeError('Material bank changes the volume stacks.');
    for (let i = 0; i < left.leaves.length; i++) {
      const a = left.leaves[i]!, b = right.leaves[i]!;
      if (a.id !== b.id || a.widthPx !== b.widthPx || a.heightPx !== b.heightPx || JSON.stringify(a.centerUnits) !== JSON.stringify(b.centerUnits) || JSON.stringify(a.style) !== JSON.stringify(b.style))
        throw new TypeError('Material bank changes a retained cloud leaf.');
      const old = paths.get(a.texturePath);
      if (old && old !== b.texturePath) throw new TypeError('Ambiguous prepared material mapping.');
      paths.set(a.texturePath, b.texturePath);
    }
  }
  return original.resources.map(resource => {
    const path = paths.get(resource.path), other = replacement.resources.find(item => item.path === path);
    if (!other || resource.width !== other.width || resource.height !== other.height) throw new TypeError('Missing matching prepared material resource.');
    const replacementPath = `${replacementDirectory}/prepared/${other.path}`;
    return { sourcePath: `${mountedDirectory}/prepared/${resource.path}`, url: url(replacementPath), replacementPath, width: resource.width, height: resource.height };
  });
}
