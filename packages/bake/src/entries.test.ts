import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

const source = fileURLToPath(new URL('.', import.meta.url));

async function sources(directory: string): Promise<string[]> {
  const found: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) found.push(...await sources(path));
    else if (/\.ts$/u.test(entry.name) && !/\.test\.ts$/u.test(entry.name)) found.push(path);
  }
  return found;
}
const specifiers = (text: string) => [...text.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/gu)].map(match => match[1]!);

it('the main volume entry stays host-neutral: only volume/node imports Node built-ins, sharp or Buffer, and nothing imports volume/node', async () => {
  const offenders: string[] = [];
  for (const path of await sources(join(source, 'volume'))) {
    const name = relative(source, path).replaceAll('\\', '/'), text = await readFile(path, 'utf8');
    if (name.startsWith('volume/node/')) continue;
    for (const specifier of specifiers(text)) {
      if (specifier.startsWith('node:') || /^(?:react(?:-dom)?(?:\/|$)|sharp$|vite$|@layoutit\/polycss$)/u.test(specifier) ||
          /(^|\/)node(\/|\.ts$|$)/u.test(specifier)) offenders.push(`${name} -> ${specifier}`);
    }
    if (/\bBuffer\b/u.test(text)) offenders.push(`${name} -> Buffer`);
  }
  expect(offenders).toEqual([]);
});

/** The topics a topic may import, always through one of that topic's entries (`index.ts`, or `node/index.ts` for the volume
 * bake): a lower layer, never a peer or a layer above. A topic missing here imports no other topic. */
const LOWER_TOPICS: Readonly<Record<string, readonly string[]>> = {
  raster: ['photometry'],
  scene: ['raster'],
  presentation: ['scene', 'raster'],
  'volume-leaves': ['scene', 'volume'],
  'stars': ['raster', 'volume'],
  'shell': ['scene', 'volume'],
  'sky': ['volume-leaves', 'volume'],
  'density': ['sky', 'volume-leaves', 'volume'],
  'image-layers': ['volume-leaves'],
  'environment': ['image-layers', 'shell', 'stars', 'density', 'volume'],
  'galaxy-catalog': ['volume'],
  'cluster-catalog': ['galaxy-catalog'],
  'objects/scene': ['presentation'],
  'objects/default-view': ['objects/scene', 'raster'],
  'objects/celestial': ['objects/scene', 'presentation'],
  'objects/host-adapters': ['presentation', 'scene', 'objects/scene', 'objects/layers/terrestrial'],
  'objects/interpretation': ['raster', 'objects/color', 'objects/geometry', 'objects/raster', 'objects/scene', 'objects/sources', 'objects/stellar', 'objects/layers/observation', 'objects/layers/shape-model', 'objects/layers/terrestrial'],
  'objects/raster': ['objects/scene', 'objects/geometry', 'objects/color', 'objects/cameras', 'raster', 'photometry'],
  'nebula': ['volume', 'volume-leaves', 'density', 'stars'],
  'objects/layers/observed-surfaces': ['raster', 'scene', 'objects/geometry'],
  'objects/layers/giant': ['delivery', 'photometry', 'presentation', 'scene', 'objects/color', 'objects/content', 'objects/geometry', 'objects/scene', 'objects/sources', 'objects/layers/observed-surfaces'],
  'objects/layers/material-composition': ['delivery', 'photometry', 'presentation', 'raster', 'scene', 'objects/color', 'objects/content', 'objects/geometry', 'objects/raster', 'objects/scene', 'objects/sources', 'objects/layers/cutaway', 'objects/layers/giant', 'objects/layers/observed-surfaces'],
  'objects/layers/shape-model': ['astronomy', 'contract', 'presentation', 'scene', 'objects/color', 'objects/content', 'objects/geometry', 'objects/scene', 'objects/sources', 'objects/layers/material-composition'],
  'objects/layers/observation': ['raster', 'objects/cameras', 'objects/color', 'objects/geometry', 'objects/raster'],
  'objects/stellar': ['objects/color', 'objects/raster', 'objects/sources'],
  'objects/acquisition': ['delivery', 'raster', 'objects/sources', 'objects/layers/observation', 'objects/layers/terrestrial'],
  'objects/sphere-survey': ['objects/cameras', 'objects/geometry', 'objects/layers/terrestrial', 'sources'],
  'objects/layers/paged-ellipsoid': ['raster', 'scene', 'photometry', 'presentation', 'objects/color', 'objects/content', 'objects/raster', 'objects/scene', 'objects/sources', 'objects/layers/observation'],
  'prepared-presentation': ['presentation', 'raster'],
  'delivery': ['objects/sources'],
  'sources': ['runtime-source', 'objects/content', 'delivery'],
  'run-implemented-objects': ['sources'],
  'prepare-objects': ['run-implemented-objects'],
  'contract': ['delivery', 'presentation', 'runtime-source', 'sources'],
  'refresh-shape-lighting': ['objects/layers/terrestrial', 'objects/scene'],
  'refresh-surface-observations': ['objects/layers/terrestrial', 'objects/content', 'surface-previews', 'contract', 'objects/scene'],
  'refresh-shape-materials': ['objects/layers/terrestrial', 'objects/sources', 'objects/scene', 'refresh-surface-observations', 'surface-previews', 'navigation', 'site-assets'],
  'refresh-terrain-photographs': ['objects/layers/terrestrial', 'objects/scene'],
  'asset-publication': ['contract', 'delivery', 'density', 'sky', 'volume', 'objects/sources'],
  'site-assets': ['raster', 'runtime-source', 'objects/raster', 'objects/charts'],
  'navigation': ['astronomy', 'delivery', 'raster', 'sources', 'objects/raster'],
  'objects/surface-features': ['objects/geometry', 'objects/raster', 'objects/scene', 'objects/layers/paged-ellipsoid', 'objects/layers/terrestrial'],
  'objects/lineage': ['objects/layers/terrestrial'],
  'surface-previews': ['raster', 'scene', 'objects/scene', 'objects/default-view', 'objects/interpretation', 'objects/layers/observation', 'objects/layers/giant', 'objects/layers/paged-ellipsoid'],
  'objects/layers/terrestrial': ['astronomy', 'contract', 'prepared-presentation', 'photometry', 'raster', 'scene', 'presentation', 'objects/cameras', 'objects/content', 'objects/color', 'objects/geometry', 'objects/raster', 'objects/scene', 'objects/sources', 'objects/layers/material-composition', 'objects/layers/shape-model'],
};

/** A topic is a top-level folder of `src/`, except `objects/`, whose every folder is a topic of its own (`objects/color`,
 * published as `@cssearth/bake/objects/color`), and `objects/layers/`, whose every folder is one too (`objects/layers/giant`).
 * Returns the topic and the path inside it. */
function topicOf(name: string): readonly [string, string] {
  const parts = name.split('/'), depth = parts[0] !== 'objects' ? 1 : parts[1] === 'layers' ? 3 : 2;
  return [parts.slice(0, depth).join('/'), parts.slice(depth).join('/')];
}

/** The imports of `files` (source paths under `src/` → text) that break the topic order. */
function topicOffenders(files: ReadonlyMap<string, string>): string[] {
  const offenders: string[] = [];
  for (const [name, text] of files) {
    const [topic] = topicOf(name);
    for (const specifier of specifiers(text)) {
      if (specifier.startsWith('@cssearth/bake')) offenders.push(`${name} -> ${specifier}`);
      if (!specifier.startsWith('.')) continue;
      const target = relative(source, join(source, name, '..', specifier)).replaceAll('\\', '/'), [targetTopic, rest] = topicOf(target);
      if (target.startsWith('..')) offenders.push(`${name} -> ${specifier}`);
      else if (targetTopic !== topic && !(LOWER_TOPICS[topic]?.includes(targetTopic) && ['index.ts', 'node/index.ts'].includes(rest))) offenders.push(`${name} -> ${specifier}`);
    }
  }
  return offenders;
}

it('topics import only the lower topics declared for them, through their index, never the application or another package\'s sources', async () => {
  const files = new Map<string, string>();
  for (const path of await sources(source)) files.set(relative(source, path).replaceAll('\\', '/'), await readFile(path, 'utf8'));
  expect(topicOffenders(files)).toEqual([]);
});

it('each folder under objects/ and objects/layers/ is a topic of its own: one imports another only as a declared lower topic, through its index', () => {
  expect(topicOffenders(new Map([
    ['objects/geometry/shape.ts', "import { a } from './mesh.ts';\nimport { b } from '../color/color-transfer.ts';\nimport { c } from '../color/index.ts';"],
    ['objects/color/color-transfer.ts', "import { d } from '../../raster/index.ts';"],
    ['objects/layers/giant/rings.ts', "import { e } from './geometry.ts';\nimport { f } from '../cutaway/materials.ts';"],
  ]))).toEqual([
    "objects/geometry/shape.ts -> ../color/color-transfer.ts",
    "objects/geometry/shape.ts -> ../color/index.ts",
    "objects/color/color-transfer.ts -> ../../raster/index.ts",
    "objects/layers/giant/rings.ts -> ../cutaway/materials.ts",
  ]);
});

it('the declared topic order has no cycle', () => {
  const visiting = new Set<string>(), done = new Set<string>();
  const visit = (topic: string, path: readonly string[]) => {
    if (done.has(topic)) return;
    if (visiting.has(topic)) throw new TypeError(`Topic cycle: ${[...path, topic].join(' -> ')}`);
    visiting.add(topic);
    for (const lower of LOWER_TOPICS[topic] ?? []) visit(lower, [...path, topic]);
    visiting.delete(topic); done.add(topic);
  };
  for (const topic of Object.keys(LOWER_TOPICS)) visit(topic, []);
});

/** Imports of `files` that name a built renderer entry (`@cssearth/renderer`, `@cssearth/renderer/platform/<name>`) rather than a
 * TypeScript source subpath. The renderer's development build depends on this package, so the two build in parallel and a built
 * entry may not exist yet when a topic is bundled; its sources always do. */
function builtRendererImports(files: ReadonlyMap<string, string>): string[] {
  return [...files].flatMap(([name, text]) => specifiers(text)
    .filter(specifier => /^@cssearth\/renderer(?:\/|$)/u.test(specifier) && !/^@cssearth\/renderer\/.+\.ts$/u.test(specifier))
    .map(specifier => `${name} -> ${specifier}`));
}

it('topics read the renderer through its TypeScript source subpaths, never a built entry the parallel build may not have written', async () => {
  const files = new Map<string, string>();
  for (const path of await sources(source)) files.set(relative(source, path).replaceAll('\\', '/'), await readFile(path, 'utf8'));
  expect(builtRendererImports(files)).toEqual([]);
  expect(builtRendererImports(new Map([['objects/scene/probe.ts', "import { a } from '@cssearth/renderer/platform/solar-view-direction';\nimport { b } from '@cssearth/renderer/solar-system/types.ts';"]])))
    .toEqual(['objects/scene/probe.ts -> @cssearth/renderer/platform/solar-view-direction']);
});
