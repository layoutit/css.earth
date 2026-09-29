/** The workspace packages a bundled lane compiles from their TypeScript sources rather than their builds. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Plugin } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { WORKSPACE } from '@cssearth/telescope/node';

/** Workspace entries a bundled lane compiles from their TypeScript sources, as it did when they were local modules. The FITS reader was a local module
 * (`tools/fits/`) before it became `@cssearth/fits`, the SPICE kernel readers were local modules (`tools/spice/`) before
 * they became `@cssearth/spice`, and the telescope library's product records, label readers and astronomy-package clients
 * were local modules under `tools/objects/` before they became `@cssearth/telescope`, and the photometric models and raster lane
 * were local modules (`tools/photometry/`, `src/preparation/raster/`) before they became `@cssearth/bake/photometry` and
 * `@cssearth/bake/raster`, as were the renderer's preparation compilers (`src/renderers/css/preparation/`), `src/platform/`
 * and `tools/prepared/` libraries and the `src/preparation/` topics before their `@cssearth/bake/<topic>` entries, and the shared object libraries under
 * `tools/objects/` before `@cssearth/bake/objects/<topic>`, the source catalogue and manifest checks (`src/platform/source-*.mts`)
 * before `@cssearth/objects/sources` and `@cssearth/objects/node`, and the renderer's world-rotation validation before it joined
 * `@cssearth/objects`, and the `tools/prepared/`, `tools/assets/`, `tools/sources/` and `tools/contract/` libraries before
 * `@cssearth/bake/{prepared-presentation,delivery,sources,contract}` and `@cssearth/objects/node/contract`, and the provenance,
 * exploration and source-usage records and the runtime asset closure (`src/platform/`) before `@cssearth/objects/provenance` and
 * `@cssearth/objects/node`, and the galaxy, cluster and nebula catalogue readers (`packages/catalog/src/`), which the navigation
 * destinations and the spatial source citations imported by path before they joined the bake, and the layered
 * provenance records and bindings (`tools/objects/`) before `@cssearth/bake/objects/provenance`; following them bundles
 * the code the lane runs from the checkout. Other packages stay external, as they always were. */
const FOLLOWED_WORKSPACE_ENTRIES: Readonly<Record<string, string>> = {
  '@cssearth/fits': 'packages/fits/src/index.ts',
  '@cssearth/catalog': 'packages/catalog/src/index.ts',
  '@cssearth/fits/node': 'packages/fits/src/node/index.ts',
  '@cssearth/objects': 'packages/objects/src/index.ts',
  '@cssearth/objects/sources': 'packages/objects/src/sources/index.ts',
  '@cssearth/objects/provenance': 'packages/objects/src/provenance/index.ts',
  '@cssearth/objects/node': 'packages/objects/src/node/index.ts',
  '@cssearth/spice': 'packages/spice/src/index.ts',
  '@cssearth/spice/node': 'packages/spice/src/node/index.ts',
  '@cssearth/telescope': 'packages/telescope/src/index.ts',
  '@cssearth/telescope/node': 'packages/telescope/src/node/index.ts',
  '@cssearth/bake/photometry': 'packages/bake/src/photometry/index.ts',
  '@cssearth/bake/raster': 'packages/bake/src/raster/index.ts',
  '@cssearth/bake/scene': 'packages/bake/src/scene/index.ts',
  '@cssearth/bake/presentation': 'packages/bake/src/presentation/index.ts',
  '@cssearth/bake/nebula': 'packages/bake/src/nebula/index.ts',
  '@cssearth/bake/world-context': 'packages/bake/src/world-context/index.ts',
  '@cssearth/bake/cluster-catalog': 'packages/bake/src/cluster-catalog/index.ts',
  '@cssearth/bake/galaxy-catalog': 'packages/bake/src/galaxy-catalog/index.ts',
  '@cssearth/bake/environment': 'packages/bake/src/environment/index.ts',
  '@cssearth/bake/image-layers': 'packages/bake/src/image-layers/index.ts',
  '@cssearth/bake/density': 'packages/bake/src/density/index.ts',
  '@cssearth/bake/sky': 'packages/bake/src/sky/index.ts',
  '@cssearth/bake/shell': 'packages/bake/src/shell/index.ts',
  '@cssearth/bake/stars': 'packages/bake/src/stars/index.ts',
  '@cssearth/bake/volume-leaves': 'packages/bake/src/volume-leaves/index.ts',
  '@cssearth/bake/objects/color': 'packages/bake/src/objects/color/index.ts',
  '@cssearth/bake/objects/cameras': 'packages/bake/src/objects/cameras/index.ts',
  '@cssearth/bake/objects/geometry': 'packages/bake/src/objects/geometry/index.ts',
  '@cssearth/bake/objects/raster': 'packages/bake/src/objects/raster/index.ts',
  '@cssearth/bake/objects/scene': 'packages/bake/src/objects/scene/index.ts',
  '@cssearth/bake/objects/sources': 'packages/bake/src/objects/sources/index.ts',
  '@cssearth/bake/objects/charts': 'packages/bake/src/objects/charts/index.ts',
  '@cssearth/bake/objects/content': 'packages/bake/src/objects/content/index.ts',
  '@cssearth/bake/objects/surface-features': 'packages/bake/src/objects/surface-features/index.ts',
  '@cssearth/bake/objects/layers/observation': 'packages/bake/src/objects/layers/observation/index.ts',
  '@cssearth/bake/objects/layers/shape-model': 'packages/bake/src/objects/layers/shape-model/index.ts',
  '@cssearth/bake/objects/layers/cutaway': 'packages/bake/src/objects/layers/cutaway/index.ts',
  '@cssearth/bake/objects/layers/giant': 'packages/bake/src/objects/layers/giant/index.ts',
  '@cssearth/bake/objects/layers/material-composition': 'packages/bake/src/objects/layers/material-composition/index.ts',
  '@cssearth/bake/objects/layers/observed-surfaces': 'packages/bake/src/objects/layers/observed-surfaces/index.ts',
  '@cssearth/bake/objects/layers/paged-ellipsoid': 'packages/bake/src/objects/layers/paged-ellipsoid/index.ts',
  '@cssearth/bake/objects/layers/terrestrial': 'packages/bake/src/objects/layers/terrestrial/index.ts',
  '@cssearth/bake/objects/stellar': 'packages/bake/src/objects/stellar/index.ts',
  '@cssearth/bake/objects/candidates': 'packages/bake/src/objects/candidates/index.ts',
  '@cssearth/bake/objects/provenance': 'packages/bake/src/objects/provenance/index.ts',
  '@cssearth/bake/objects/acquisition': 'packages/bake/src/objects/acquisition/index.ts',
  '@cssearth/bake/objects/sphere-survey': 'packages/bake/src/objects/sphere-survey/index.ts',
  '@cssearth/bake/objects/default-view': 'packages/bake/src/objects/default-view/index.ts',
  '@cssearth/bake/objects/celestial': 'packages/bake/src/objects/celestial/index.ts',
  '@cssearth/bake/objects/host-adapters': 'packages/bake/src/objects/host-adapters/index.ts',
  '@cssearth/bake/objects/interpretation': 'packages/bake/src/objects/interpretation/index.ts',
  '@cssearth/bake/runtime-source': 'packages/bake/src/runtime-source/index.ts',
  '@cssearth/bake/prepared-presentation': 'packages/bake/src/prepared-presentation/index.ts',
  '@cssearth/bake/delivery': 'packages/bake/src/delivery/index.ts',
  '@cssearth/bake/sources': 'packages/bake/src/sources/index.ts',
  '@cssearth/bake/contract': 'packages/bake/src/contract/index.ts',
  '@cssearth/bake/astronomy': 'packages/bake/src/astronomy/index.ts',
  '@cssearth/bake/navigation': 'packages/bake/src/navigation/index.ts',
  '@cssearth/bake/site-assets': 'packages/bake/src/site-assets/index.ts',
  '@cssearth/bake/facility-renders': 'packages/bake/src/facility-renders/index.ts',
  '@cssearth/bake/asset-publication': 'packages/bake/src/asset-publication/index.ts',
  '@cssearth/bake/surface-previews': 'packages/bake/src/surface-previews/index.ts',
  '@cssearth/bake/preparation': 'packages/bake/src/preparation/index.ts',
  '@cssearth/bake/thread-pool': 'packages/bake/src/thread-pool/index.ts',
  '@cssearth/objects/node/contract': 'packages/objects/src/node/contract/index.ts',
};
/** The CSS renderer runtime was relative modules under `src/renderers/css/` before it became `@cssearth/renderer`, and an
 * operation that renders or validates prepared data ran them as its own code. Its built entries map to the sources its
 * tsup configuration names (`@cssearth/renderer/navigation` → `src/navigation/index.ts`); its source subpaths name the file. */
let rendererEntries: Promise<Readonly<Record<string, string>>> | undefined;
/** Read once, when a bundle first reaches the renderer, so a change to the renderer's entry list touches only those. */
const loadRendererEntries = () => rendererEntries ??= import(pathToFileURL(resolve(WORKSPACE, 'packages/renderer/tsup.config.ts')).href)
  .then((config: { default: { entry: Record<string, string> } }) => Object.fromEntries(Object.entries(config.default.entry)
    .map(([name, source]) => [name, `src/${source.slice(source.lastIndexOf('/src/') + '/src/'.length)}`])));
async function rendererSource(specifier: string): Promise<string | undefined> {
  if (specifier !== '@cssearth/renderer' && !specifier.startsWith('@cssearth/renderer/')) return undefined;
  const subpath = specifier.slice('@cssearth/renderer/'.length);
  const built = (await loadRendererEntries())[subpath || 'index'];
  if (built) return `packages/renderer/${built}`;
  return /^[a-z-]+\/[\w./-]+\.ts$/u.test(subpath) && !subpath.split('/').includes('..') ? `packages/renderer/src/${subpath}` : undefined;
}
/** The telescope command's modules were relative modules under `tools/objects/telescopes/` before they became
 * `@cssearth/telescope-cli`. A subpath is followed to the source its package.json `exports` entry declares, as Node resolves it
 * (`@cssearth/telescope-cli/archives/jwst/imaging/image3` → `src/archives/jwst/imaging/image3.mts`); a subpath the package does
 * not export stays external, as Node would refuse it. The map is read from the bundled checkout, once per bundle. */
async function telescopeCliExports(root: string): Promise<ReadonlyMap<string, string>> {
  let text: string;
  try { text = await readFile(resolve(root, 'packages/telescope-cli/package.json'), 'utf8'); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return new Map(); throw error; }
  const manifest: unknown = JSON.parse(text);
  const exports = typeof manifest === 'object' && manifest !== null && 'exports' in manifest ? manifest.exports : undefined;
  if (typeof exports !== 'object' || exports === null) return new Map();
  const sources = new Map<string, string>();
  for (const [subpath, target] of Object.entries(exports)) {
    const conditions: Readonly<Record<string, unknown>> = typeof target === 'object' && target !== null ? { ...target } : { default: target };
    const source = conditions.types ?? conditions.default;
    if (subpath.startsWith('./') && typeof source === 'string' && /^\.\/src\/[\w./-]+\.m?ts$/u.test(source) && !source.split('/').includes('..'))
      sources.set(`@cssearth/telescope-cli/${subpath.slice(2)}`, `packages/telescope-cli/${source.slice(2)}`);
  }
  return sources;
}
/** An esbuild plugin that bundles the followed workspace entries from their sources under `root`. */
export function followedWorkspaceSources(root: string): Plugin {
  return { name: 'followed-workspace-sources', setup(builder) {
    let telescopeCli: Promise<ReadonlyMap<string, string>> | undefined;
    builder.onResolve({ filter: /^@cssearth\// }, async args => {
      const source = FOLLOWED_WORKSPACE_ENTRIES[args.path] ?? await rendererSource(args.path)
        ?? (args.path.startsWith('@cssearth/telescope-cli/') ? (await (telescopeCli ??= telescopeCliExports(root))).get(args.path) : undefined);
      return source ? { path: resolve(root, source) } : undefined;
    });
  } };
}

