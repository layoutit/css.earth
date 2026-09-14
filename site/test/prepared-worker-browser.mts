import {parseObjectDescriptor} from "@cssearth/objects";
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const origin = process.argv[2] ?? 'http://127.0.0.1:4210';
const descriptor = parseObjectDescriptor(JSON.parse(await readFile('src/objects/venus/object.json', 'utf8')));
const output = 'output/playwright/prepared-worker';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results:unknown[] = [], errors:string[] = [];
try {
  for (const dpr of [1, 2]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: dpr });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${origin}/sun/`);
    await page.waitForFunction(() => window.__cssEarth?.ready && window.__sun?.ready);
    const result = await page.evaluate(async descriptorJson => {
      const record=(value:unknown):Record<string,unknown>=>{if(!value||typeof value!=="object"||Array.isArray(value))throw new TypeError("Invalid prepared mutation fixture");return value as Record<string,unknown>;};
      const descriptor=record(JSON.parse(descriptorJson));
      const { loadPreparedCssObject } = await import('/src/renderers/css/dist/index.js');
      const source = await (await fetch('/src/objects/venus/prepared/object.json')).arrayBuffer();
      const NativeWorker = window.Worker;
      let created = 0, retired = 0;
      window.Worker = class extends NativeWorker {
        constructor(...args:ConstructorParameters<typeof NativeWorker>) { super(...args); created++; }
        terminate() { retired++; super.terminate(); }
      };
      const bytes = source.slice(0);
      const definition = await loadPreparedCssObject(descriptor, { read: async () => bytes });
      const detached = bytes.byteLength === 0;
      const failure = async (descriptor:unknown, bytes:ArrayBuffer) => {
        try { await loadPreparedCssObject(descriptor, { read: async () => bytes }); return null; }
        catch (error) { if(!(error instanceof Error))throw error;return { name: error.name, message: error.message }; }
      };
      const stale = await failure(descriptor, new Uint8Array([...new Uint8Array(source), 32]).buffer);
      const invalid:unknown = JSON.parse(new TextDecoder().decode(source));
      record(record(record(invalid).data).camera).defaultZoom = 0;
      const invalidBytes = new TextEncoder().encode(JSON.stringify(invalid)).buffer;
      const hash = await crypto.subtle.digest('SHA-256', invalidBytes);
      const sha256 = [...new Uint8Array(hash)].map(value => value.toString(16).padStart(2, '0')).join('');
      const malformed = await failure({ ...descriptor, prepared: { ...record(descriptor.prepared), sha256 } }, invalidBytes);
      const controller = new AbortController();
      const cancelled = loadPreparedCssObject(descriptor, { read: async () => source.slice(0) }, { signal: controller.signal })
        .then(() => 'unexpected success', (error:unknown) => {if(!(error instanceof Error))throw error;return error.name;});
      // The load starts its worker in a microtask before this timer aborts it.
      await new Promise<void>(resolve => setTimeout(() => { controller.abort(); resolve(); }, 0));
      const cancellation = await cancelled;
      window.Worker = NativeWorker;
      return { id: definition.id, detached, stale, malformed, cancellation, created, retired };
    }, JSON.stringify(descriptor));
    assert.equal(result.id, 'venus'); assert.equal(result.detached, true);
    assert.match(result.stale?.message ?? '', /SHA-256/);
    assert.equal(result.malformed?.name, 'TypeError');
    assert.match(result.malformed?.message ?? '', /zoom/i);
    assert.equal(result.cancellation, 'AbortError');
    // One retained worker serves every decode; only the cancelled decode retires it.
    // One retained worker serves every decode; its lifecycle is covered by prepared-object-worker-client.test.ts.
    assert.ok(result.created <= 1, `at most one worker is created after the retained one (${result.created})`);
    results.push({ dpr, ...result });
    await page.close();
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
  await writeFile(`${output}/report.json`, JSON.stringify({ results, errors }, null, 2));
}
console.log(JSON.stringify({ results, errors }));
