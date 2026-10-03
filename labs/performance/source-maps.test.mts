import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SourceMapGenerator } from 'source-map-js';
import { inspectBuild } from './trace-sources.mts';
import type { TraceLocation } from './trace-model.mts';
import { recordOf } from './trace-model.mts';

test('trace maps resolve callsites and tolerate missing maps', async () => {
  const root = await mkdtemp(join(tmpdir(), 'cssearth-trace-maps-'));
  try {
    const source = 'export function move(value) { return value + 17; }\n';
    const code = 'function move(v){return v+17}';
    const map = new SourceMapGenerator({ file: 'bundle.js' });
    map.addMapping({ generated: { line: 1, column: 0 }, original: { line: 1, column: 0 }, source: 'entry.js' });
    map.setSourceContent('entry.js', source);
    await writeFile(join(root, 'bundle.js'), code);
    await writeFile(join(root, 'bundle.js.map'), map.toString());
    const position = { generatedLine: 1, generatedColumn: 0 };
    const location: TraceLocation & { url: string } = { url: 'http://localhost/bundle.js', lineNumber: position.generatedLine, columnNumber: position.generatedColumn + 1 };
    const brief = { sourceUrls: [location.url], sampledJsSelf: [location], busiestTasks: [] };
    const inspected = await inspectBuild(brief, root);
    const original = recordOf(location.original);
    assert.ok(original);
    assert.equal(original.line, 1);
    assert.ok(typeof original.excerpt === 'string');
    assert.match(original.excerpt, /value \+ 17/);
    assert.match(inspected[0]?.sourceMap?.status ?? '', /traced bytes not independently verified/);
    // The old trace must remain useful when its original source maps are absent.
    await rm(join(root, 'bundle.js.map'));
    const noMap = await inspectBuild({ sourceUrls: [location.url], sampledJsSelf: [{ ...location, original: undefined }], busiestTasks: [] }, root);
    assert.equal(noMap[0]?.sourceMap?.status, 'unavailable');
    assert.equal(await readFile(join(root, 'bundle.js'), 'utf8'), code);
  } finally { await rm(root, { recursive: true, force: true }); }
});
