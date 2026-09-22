import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { PREPARED_INTERIOR_DISC_SIZE } from '../../src/renderers/css/dist/index.js';
import type { PreparedInteriorDisc } from '../../src/renderers/css/rendering/prepared-interior-disc.ts';
import type { PreparedPresentationDefinition, PreparedWrite } from '../../src/renderers/css/rendering/prepared-presentation.ts';
import type { PreparedAssets } from '../../src/renderers/css/rendering/prepared-residency.ts';

/** The complete disc, including two raster pixels of edge clearance, fits
 * inside the prepared inner ellipsoid at every camera orientation. */
export const interiorFillInset = (1 - 1e-6) / (1 + 4 / PREPARED_INTERIOR_DISC_SIZE);

/** Colours a surface paints where it has no observation. They are a display convention, so a body that declares one
 * keeps them out of the mean that stands in for its surface behind the leaves; otherwise a map that is mostly gap
 * gives an interior nothing like the part anyone looks at. */
export interface SurfaceMeanExclusion { colors: readonly (readonly number[])[]; tolerance: number }

export async function preparedSurfaceMean(paths: readonly string[], exclude?: SurfaceMeanExclusion): Promise<string> {
  const sum = [0, 0, 0]; let weight = 0;
  const excluded = (r: number, g: number, b: number) => exclude !== undefined && exclude.colors.some(color =>
    Math.abs(r - color[0]!) <= exclude.tolerance && Math.abs(g - color[1]!) <= exclude.tolerance && Math.abs(b - color[2]!) <= exclude.tolerance);
  for (const path of paths) {
    const { data, info } = await sharp(await readFile(path)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (info.channels !== 4) throw new Error('Surface mean requires RGBA pixels.');
    for (let i = 0; i < data.length; i += 4) {
      if (excluded(data[i]!, data[i + 1]!, data[i + 2]!)) continue;
      const alpha = data[i + 3]; weight += alpha;
      for (let channel = 0; channel < 3; channel++) sum[channel] += data[i + channel] * alpha;
    }
  }
  if (!weight) throw new Error('Surface mean requires visible source pixels.');
  return `rgb(${sum.map(value => Math.round(value / weight)).join(' ')})`;
}

/** Shared by prepared spherical and ellipsoidal bodies. The caller supplies geometry proven
 * inside that body's actual surface; there is no object-specific renderer. */
export async function withPreparedInteriorFill<T extends PreparedPresentationDefinition & { assets?: PreparedAssets }>(
  presentation: T, geometry: PreparedInteriorDisc | null, publicRoot: string | ((url: string) => string),
  exclude?: SurfaceMeanExclusion,
): Promise<T> {
  // Write-mode preparation stages every scene asset in a flat directory before publishing; the
  // surface mean must read those staged pixels, never a previously published copy under public/.
  const resolveAsset = typeof publicRoot === 'string' ? (url: string) => resolve(publicRoot, `.${url}`) : publicRoot;
  if (!geometry || presentation.viewBindings.some(binding => binding.kind === 'interior-disc')) return presentation;
  const assets = presentation.assets;
  if (!assets) throw new Error('Interior fill requires the prepared asset catalogue.');
  const target = presentation.tree.nodes.length;
  const colors = new Map<string, Promise<string>>();
  const variants = [];
  for (const variant of presentation.variants) {
    const interior = variant.writes.some(write => write.kind === 'attribute' && write.name === 'data-view' && write.value === 'interior');
    const surfaceKeys = variant.required.filter(key => key.startsWith('surface:') || key.startsWith('page:') || key.startsWith('shadow:') || key === 'surface');
    if (!interior && !surfaceKeys.length) throw new Error(`Missing prepared surface for ${variant.when.lensId}.`);
    const key = surfaceKeys.join(',');
    if (!interior && !colors.has(key)) {
      const paths = surfaceKeys.map(key => {
        const asset = assets.entries.find(asset => asset.key === key);
        if (!asset || !asset.url.startsWith('/scenes/') || asset.url.includes('..')) throw new Error('Interior fill requires local prepared surface pixels.');
        return resolveAsset(asset.url);
      });
      colors.set(key, preparedSurfaceMean(paths, exclude));
    }
    const writes: PreparedWrite[] = [
      { kind: 'style', target, name: 'display', value: interior ? 'none' : 'block' },
      { kind: 'style', target, name: 'background-color', value: interior ? 'transparent' : await colors.get(key)! },
    ];
    variants.push({ ...variant, writes: [...variant.writes, ...writes] });
  }
  return { ...presentation,
    tree: { ...presentation.tree, nodes: [...presentation.tree.nodes, {
      parent: presentation.tree.scene, tag: 'div', className: 'prepared-interior-fill', properties: [], attributes: {},
      style: `position:absolute;left:0;top:0;width:${PREPARED_INTERIOR_DISC_SIZE}px;height:${PREPARED_INTERIOR_DISC_SIZE}px;border-radius:50%;transform-origin:0 0;pointer-events:none;backface-visibility:visible;visibility:hidden`,
    }] },
    viewBindings: [...presentation.viewBindings, { kind: 'interior-disc', target, ...geometry }], variants,
  };
}

/** Recompilation always starts from the original retained surface. */
export function withoutPreparedInteriorFill<T extends PreparedPresentationDefinition>(presentation: T): T {
  const fill = presentation.viewBindings.find(binding => binding.kind === 'interior-disc');
  if (!fill) return presentation;
  if (fill.target !== presentation.tree.nodes.length - 1 || presentation.tree.nodes[fill.target].className !== 'prepared-interior-fill') {
    throw new Error('Prepared interior fill must remain the final generated leaf.');
  }
  return { ...presentation,
    tree: { ...presentation.tree, nodes: presentation.tree.nodes.slice(0, -1) },
    viewBindings: presentation.viewBindings.filter(binding => binding !== fill),
    variants: presentation.variants.map(variant => ({ ...variant, writes: variant.writes.filter(write => write.target !== fill.target) })),
  };
}
