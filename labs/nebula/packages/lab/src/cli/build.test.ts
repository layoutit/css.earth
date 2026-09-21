import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { buildLabModule } from './build.ts';

test('bundles preserve imported source URLs and text while only the real entry runs its guard', async () => {
  const directory = await realpath(await mkdtemp(join(tmpdir(), 'nebula-module-url-')));
  const dependency = join(directory, 'dependency.ts'), entry = join(directory, 'entry.ts'), outfile = join(directory, 'bundle.mjs');
  const guard = `import { pathToFileURL } from 'node:url';
    const direct = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;`;
  try {
    await writeFile(dependency, `${guard}
      if (direct) throw new Error('An imported command ran its entry guard');
      export const source = import.meta.url;
      export const spaced = import . meta . url;
      export const bracket = import.meta['url'];
      export const literal = "import.meta.url";
      export const template = \`literal import.meta.url / \${import.meta.url}\`;
      export const pattern = /import.meta.url/.source;`);
    await writeFile(entry, `${guard}
      import { source, spaced, bracket, literal, template, pattern } from './dependency.ts';
      if (direct) console.log(JSON.stringify({ source, spaced, bracket, literal, template, pattern }));`);
    await buildLabModule({ entryPoints: [entry], outfile, bundle: true, platform: 'node', format: 'esm', packages: 'external' });
    const result = spawnSync(process.execPath, [outfile], { encoding: 'utf8', timeout: 10_000 });
    assert.equal(result.status, 0, result.stderr);
    const source = pathToFileURL(dependency).href;
    assert.deepEqual(JSON.parse(result.stdout), { source, spaced: source, bracket: source, literal: 'import.meta.url',
      template: `literal import.meta.url / ${source}`, pattern: 'import.meta.url' });
  } finally { await rm(directory, { recursive: true, force: true }); }
});
