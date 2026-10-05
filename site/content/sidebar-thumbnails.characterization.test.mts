import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';

/** Inject the subject's JSON import by its import attribute, independent of its private path. */
function readBank(value: unknown) {
  const directory = mkdtempSync(join(tmpdir(), 'cssearth-thumbnails-'));
  try {
    const manifest = join(directory, 'bank.json');
    const script = join(directory, 'read.mts');
    const subject = new URL('./sidebar-thumbnails.mts', import.meta.url).href;
    writeFileSync(manifest, JSON.stringify(value));
    writeFileSync(script, `import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, nextResolve) {
  if (context.parentURL === ${JSON.stringify(subject)} && context.importAttributes.type === 'json') {
    return { url: ${JSON.stringify(pathToFileURL(manifest).href)}, shortCircuit: true };
  }
  return nextResolve(specifier, context);
} });
const { sidebarThumbnail } = await import(${JSON.stringify(subject)});
console.log(JSON.stringify([
  sidebarThumbnail('earth'), sidebarThumbnail('earth', 'radar'),
  sidebarThumbnail('earth', ''), sidebarThumbnail('earth', 'missing'),
  sidebarThumbnail('unknown'), sidebarThumbnail('missing')
]));
`);
    const result = spawnSync(process.execPath, [script], { encoding: 'utf8', timeout: 10000 });
    if (result.error) throw result.error;
    return result;
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

test('thumbnail defaults, explicit datasets and absent images have distinct outcomes', () => {
  const result = readBank({
    schema: 'cssearth-sidebar-thumbnails@1', defaults: { earth: 'earth/normal', unknown: 42 },
    images: { 'earth/normal': { url2x: '/navigation/focus-earth-normal@2x.webp' }, 'earth/radar': { url2x: '/navigation/focus-earth-radar@2x.webp' } },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), [
    { url2x: '/navigation/focus-earth-normal@2x.webp' },
    { url2x: '/navigation/focus-earth-radar@2x.webp' },
    { url2x: '/navigation/focus-earth-normal@2x.webp' }, null, null, null,
  ]);
});
test('thumbnail bank refuses unsupported schemas and unsafe navigation image URLs at import', () => {
  for (const [input, message] of [
    [{ schema: 'bad', defaults: {}, images: {} }, 'Invalid sidebar thumbnail bank'],
    [{ schema: 'cssearth-sidebar-thumbnails@1', defaults: {}, images: { earth: { url2x: 'https://example.test/focus-earth@2x.webp' } } }, 'Invalid sidebar thumbnail URL: earth'],
  ] as const) {
    const result = readBank(input);
    assert.equal(result.status, 1);
    assert.ok(result.stderr.includes(message), result.stderr);
  }
});
