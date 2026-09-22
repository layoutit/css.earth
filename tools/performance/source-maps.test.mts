import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'vite';
import type { Rollup } from 'vite';
import type { MappingItem } from 'source-map-js';
import { performanceSourceMaps } from './source-maps.mts';
import { inspectBuild, readSourceMap } from './trace-brief.mts';
import type { TraceLocation } from './trace-model.mts';
import { recordOf } from './trace-model.mts';

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
    const consumer = readSourceMap(mapText);
    const mappings: MappingItem[] = [];
    consumer.eachMapping(m => { if (!mappings.length && m.originalLine === 1) mappings.push(m); });
    const position = mappings[0];
    assert.ok(position);
    await writeFile(join(root, 'bundle.js'), chunk.code);
    await writeFile(join(root, 'bundle.js.map'), mapText);
    const location: TraceLocation & { url: string } = { url: 'http://localhost/bundle.js', lineNumber: position.generatedLine, columnNumber: position.generatedColumn + 1 };
    const brief = { sourceUrls: [location.url], sampledJsSelf: [location], busiestTasks: [] };
    const inspected = await inspectBuild(brief, root);
    const original = recordOf(location.original);
    assert.ok(original);
    assert.equal(original.line, 1);
    assert.ok(typeof original.excerpt === 'string');
    assert.match(original.excerpt, /value \+ 17/);
    assert.ok(typeof original.sourceContentSha256 === 'string');
    assert.equal(original.sourceContentSha256.length, 64);
    assert.match(inspected[0]?.sourceMap?.status ?? '', /traced bytes not independently verified/);
    // The old trace must remain useful when its original source maps are absent.
    await rm(join(root, 'bundle.js.map'));
    const noMap = await inspectBuild({ sourceUrls: [location.url], sampledJsSelf: [{ ...location, original: undefined }], busiestTasks: [] }, root);
    assert.equal(noMap[0]?.sourceMap?.status, 'unavailable');
    assert.equal(await readFile(join(root, 'bundle.js'), 'utf8'), chunk.code);
  } finally { await rm(root, { recursive: true, force: true }); }
});
