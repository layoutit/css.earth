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
  'cluster-catalog': ['galaxy-catalog'],
};

/** A topic is a top-level folder of `src/`, except `objects/`, whose every folder is a topic of its own (`objects/color`,
 * published as `@cssearth/bake/objects/color`). Returns the topic and the path inside it. */
function topicOf(name: string): readonly [string, string] {
  const parts = name.split('/'), depth = parts[0] === 'objects' ? 2 : 1;
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

it('each folder under objects/ is a topic of its own: one imports another only as a declared lower topic, through its index', () => {
  expect(topicOffenders(new Map([
    ['objects/geometry/shape.ts', "import { a } from './mesh.ts';\nimport { b } from '../color/color-transfer.ts';\nimport { c } from '../color/index.ts';"],
    ['objects/color/color-transfer.ts', "import { d } from '../../raster/index.ts';"],
  ]))).toEqual([
    "objects/geometry/shape.ts -> ../color/color-transfer.ts",
    "objects/geometry/shape.ts -> ../color/index.ts",
    "objects/color/color-transfer.ts -> ../../raster/index.ts",
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
