/** Same-artifact controls: an isolated, equal-length startup tripwire without rebuild drift. */
import { readdir, readFile, writeFile, mkdir, symlink, lstat, copyFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { SourceMapConsumer, SourceMapGenerator, type RawSourceMap } from 'source-map-js';
const dist = resolve(process.argv[2] ?? ''), root = resolve(process.argv[3] ?? '');
if (!relative(process.cwd(), dist).startsWith('output/') || !relative(process.cwd(), root).startsWith('output/')) throw new Error('Use local output paths');
if (await lstat(root).catch(() => null)) throw new Error('Refusing an existing control root');
const modules = [];
for (const name of await readdir(resolve(dist, '_astro'))) {
  if (!name.endsWith('.js.map')) continue;
  const input: unknown = JSON.parse(await readFile(resolve(dist, '_astro', name), 'utf8'));
  if (!input || typeof input !== 'object' || !('version' in input) || input.version !== 3 || !('sources' in input) || !Array.isArray(input.sources)
    || !input.sources.every(value => typeof value === 'string') || !('mappings' in input) || typeof input.mappings !== 'string'
    || !('names' in input) || !Array.isArray(input.names) || !input.names.every(value => typeof value === 'string')) throw new Error('Invalid source map');
  if (!input.sources.some(value => value.endsWith('/site/startup/startup-boot.mts'))) continue;
  const map: RawSourceMap = { version: '3', sources: input.sources, names: input.names, mappings: input.mappings };
  const generator = new SourceMapGenerator();
  new SourceMapConsumer(map).eachMapping(row => {
    if (row.source === null || row.originalLine === null || row.originalColumn === null) return;
    generator.addMapping({ generated: { line: row.generatedLine + 1, column: row.generatedColumn },
      original: { line: row.originalLine, column: row.originalColumn }, source: row.source, ...(row.name ? { name: row.name } : {}) });
  });
  modules.push({ name: name.slice(0, -4), map: generator.toString() });
}
if (modules.length !== 1) throw new Error(`Expected one real startup module, got ${modules.length}`);
await mkdir(root, { recursive: true });
const module = modules[0]!;
const original = await readFile(resolve(dist, '_astro', module.name), 'utf8');
for (const [name, enabled] of [['healthy-a', 0], ['healthy-b', 0], ['broken', 1]] as const) {
  const copy = resolve(root, name);
  await mkdir(resolve(copy, '_astro'), { recursive: true });
  for (const entry of await readdir(dist)) if (entry !== '_astro' && entry !== 'milky-way') await symlink(resolve(dist, entry), resolve(copy, entry));
  await mkdir(resolve(copy, 'milky-way'));
  await copyFile(resolve(dist, 'milky-way/index.html'), resolve(copy, 'milky-way/index.html'));
  for (const entry of await readdir(resolve(dist, '_astro'))) if (entry !== module.name && entry !== module.name + '.map')
    await symlink(resolve(dist, '_astro', entry), resolve(copy, '_astro', entry));
  const prefix = `if(${enabled}&&/AppleWebKit/u.test(navigator.userAgent)&&/Safari/u.test(navigator.userAgent)&&!/Chrome|Chromium|Edg/u.test(navigator.userAgent))throw new Error("Deliberate WebKit startup breakage");\n`;
  await writeFile(resolve(copy, '_astro', module.name), prefix + original);
  await writeFile(resolve(copy, '_astro', module.name + '.map'), module.map);
}
const a = await readFile(resolve(root, 'healthy-a/_astro', module.name));
const b = await readFile(resolve(root, 'healthy-b/_astro', module.name));
const fault = await readFile(resolve(root, 'broken/_astro', module.name));
if (!a.equals(b) || a.length !== fault.length || a.filter((value, index) => value !== fault[index]).length !== 1) throw new Error('Invalid equal-length control');
await writeFile(resolve(root, 'control.json'), JSON.stringify({ module: module.name, identicalHealthyCopies: true, changedBytes: 1,
  scope: 'Synthetic engine-specific tripwire in actual startup module; no existing browser branch claimed.' }, null, 2) + '\n');
console.log('ENGINE CONTROL READY: identical healthy artifacts; one-byte startup fault');
