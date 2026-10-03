import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'vite';
import type { Rollup } from 'vite';
import type { MappingItem } from 'source-map-js';
import { performanceSourceMaps } from './source-maps.mts';
import { SourceMapConsumer } from 'source-map-js';

test('performance maps resolve generated callsites without changing served JS or production output', async () => {
  const root = await mkdtemp(join(tmpdir(), 'cssearth-trace-maps-'));
  try {
    const source = 'export function move(value) { return value + 17; }\nwindow.result = move(1);\n';
    await writeFile(join(root, 'entry.js'), source);
    const compile = async (mode: string) => {
      const result = await build({ configFile: false, root, mode, logLevel: 'silent', plugins: [performanceSourceMaps()],
        build: { write: false, minify: true, rollupOptions: { input: join(root, 'entry.js') } } });
      assert.ok('output' in result, 'A single unwatched build returns one output.');
      return result.output;
    };
    const isChunk = (c: Rollup.OutputChunk | Rollup.OutputAsset): c is Rollup.OutputChunk => c.type === 'chunk';
    const production = await compile('production');
    const performance = await compile('performance');
    const chunk = performance.find(isChunk);
    assert.ok(chunk);
    assert.equal(chunk.code, production.find(isChunk)?.code);
    assert.equal(production.some(c => c.fileName.endsWith('.map')), false);
    assert.equal(chunk.code.includes('sourceMappingURL'), false);
    const map = performance.find(c => c.fileName === chunk.fileName + '.map');
    assert.ok(map && map.type === 'asset');
    const mapText = String(map.source);
    const consumer = new SourceMapConsumer(mapText);
    const mappings: MappingItem[] = [];
    consumer.eachMapping(m => { if (!mappings.length && m.originalLine === 1) mappings.push(m); });
    const position = mappings[0];
    assert.ok(position);
    assert.equal(position.originalLine, 1);
    assert.equal(consumer.sourceContentFor(position.source)?.includes('value + 17'), true);
  } finally { await rm(root, { recursive: true, force: true }); }
});
