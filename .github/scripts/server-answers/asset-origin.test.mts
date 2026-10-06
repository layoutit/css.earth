/** Origin routing exercises the stand-in branch used by the real child host. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { object } from './model.mts';
import { assetOrigin, fetchRoute } from './asset-origin.mts';
import { postBuildSteps } from './revision-entries.mts';
test('both qualification and production asset origins route offline, and other origins fail', () => {
  for (const origin of ['https://assets.invalid', 'https://earth-assets.lowpoly.cc']) {
    assert.equal(assetOrigin(origin), origin);
    assert.equal(fetchRoute(`${origin}/runtime-assets/file/data.json`, origin, 'http://127.0.0.1:1234'), 'asset');
    assert.equal(fetchRoute('https://answers.invalid/earth/', origin, 'http://127.0.0.1:1234'), 'site');
    assert.equal(fetchRoute('http://127.0.0.1:1234/earth/', origin, 'http://127.0.0.1:1234'), 'site');
    assert.throws(() => fetchRoute('https://network.invalid/data', origin, 'http://127.0.0.1:1234'), /Network forbidden/u);
  }
  for (const origin of ['https://example.com/path', 'file:///tmp/data', 'https://user:pass@example.com']) assert.throws(() => assetOrigin(origin));
});
test('the Worker bundler runs after at most one other revision-owned bundler; unknown post-build stages fail explicitly', () => {
  const scripts = { 'build:deploy': 'pnpm prepare && astro build && node site/build/share-images.mts && node packages/bake/cli/run-implemented-objects.mts assemble', 'deploy:cloudflare-preview': 'pnpm worker:bundle && npx wrangler deploy', 'worker:bundle': 'node moved/worker.mts --noindex' };
  assert.deepEqual(postBuildSteps(scripts), ['node moved/worker.mts']);
  const older = { ...scripts, 'build:deploy': scripts['build:deploy'] + ' && pnpm functions:bundle', 'functions:bundle': 'node moved/functions.mts' };
  assert.deepEqual(postBuildSteps(older), ['node moved/functions.mts', 'node moved/worker.mts']);
  for (const step of ['astro build', 'node unknown.mts', 'node moved/functions.mts; curl network.invalid']) assert.throws(() => postBuildSteps({ ...older, 'build:deploy': older['build:deploy'] + ' && ' + step }));
  for (const step of ['astro build', 'node moved/functions.mts; curl network.invalid']) assert.throws(() => postBuildSteps({ ...scripts, 'build:deploy': scripts['build:deploy'] + ' && ' + step }));
  const named = { ...older, 'build:deploy': older['build:deploy'].replace('astro build', 'astro build --config site/astro.config.mts') };
  assert.deepEqual(postBuildSteps(named), ['node moved/functions.mts', 'node moved/worker.mts'], 'a recipe naming the config under site/ has the same boundary');
  assert.throws(() => postBuildSteps({ ...older, 'build:deploy': older['build:deploy'].replace('astro build', 'pnpm exec astro build') }), /one standalone Astro build/u);
});


test('real child host resolves both origins from inventory and preserves static range/validator behavior offline', async () => {
  for (const origin of ['https://assets.invalid', 'https://earth-assets.lowpoly.cc']) {
    const root = await mkdtemp(resolve(tmpdir(), 'answer-origin-host-'));
    let child: ReturnType<typeof spawn> | undefined;
    try {
      for (const dir of ['dist', 'src/objects/earth', 'site/public/scenes/earth']) await mkdir(resolve(root, dir), { recursive: true });
      await writeFile(resolve(root, 'site/public/scenes/earth/probe.json'), '{"offline":true}');
      await writeFile(resolve(root, 'src/objects/earth/inventory.json'), JSON.stringify({ assets: [{ location: 'public', filename: 'probe.json', sha256: 'a'.repeat(64) }] }));
      await writeFile(resolve(root, 'wrangler.jsonc'), '{"main":"worker.mjs","assets":{"run_worker_first":true}}');
      await writeFile(resolve(root, 'worker.mjs'), `export default { fetch(request, env) { return env.ASSETS.fetch(new Request(${JSON.stringify(origin + '/runtime-assets/' + 'a'.repeat(64) + '/probe.json')}, request)); } };`);
      child = spawn(process.execPath, [resolve(import.meta.dirname, 'host.mts'), 'cloudflare', resolve(root, 'dist'), origin], { cwd: root, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
      let log = '';
      child.stderr?.on('data', chunk => { log += String(chunk); });
      const next = () => new Promise<Record<string, unknown>>((accept, reject) => {
        const timer = setTimeout(() => { child?.kill('SIGKILL'); reject(new Error(`Host timed out: ${log}`)); }, 10_000);
        const exited = () => { clearTimeout(timer); reject(new Error(`Host exited: ${log}`)); };
        child!.once('exit', exited);
        child!.once('message', message => { clearTimeout(timer); child!.off('exit', exited); accept(object(message)); });
      });
      assert.equal((await next()).ready, true);
      const ask = async (headers: Record<string, string>) => {
        const reply = next();
        child!.send(JSON.stringify({ path: '/probe', method: 'GET', headers }));
        return reply;
      };
      const full = await ask({ 'accept-encoding': 'gzip' });
      assert.equal(full.status, 200);
      assert.equal(Buffer.from(String(full.bytes), 'base64').toString(), '{"offline":true}');
      const headers = new Headers(Array.isArray(full.headers) ? full.headers.map(raw => { if (!Array.isArray(raw) || typeof raw[0] !== 'string' || typeof raw[1] !== 'string') throw new Error('Invalid headers'); return [raw[0], raw[1]] as [string, string]; }) : []);
      assert.equal(headers.get('content-encoding'), 'gzip');
      assert.ok(headers.get('etag'));
      assert.equal((await ask({ 'if-none-match': headers.get('etag')! })).status, 304);
      const range = await ask({ range: 'bytes=0-3' });
      assert.equal(range.status, 206);
      assert.equal(Buffer.from(String(range.bytes), 'base64').toString(), '{"of');
    } finally {
      if (child && child.exitCode === null) {
        const exited = new Promise<void>(accept => child!.once('exit', () => accept()));
        child.kill('SIGTERM');
        await exited;
      }
      await rm(root, { recursive: true, force: true });
    }
  }
});

test('the Worker ASSETS binding reads the built site by path under either published origin', async () => {
  for (const origin of ['https://assets.invalid', 'https://earth-assets.lowpoly.cc']) {
    const root = await mkdtemp(resolve(tmpdir(), 'answer-binding-host-'));
    let child: ReturnType<typeof spawn> | undefined;
    try {
      await mkdir(resolve(root, 'dist'), { recursive: true });
      await writeFile(resolve(root, 'dist/binding.json'), '{"binding":true}');
      await writeFile(resolve(root, 'wrangler.jsonc'), '{"main":"worker.mjs","assets":{"run_worker_first":true}}');
      // deploy/cloudflare/assets.ts reads its own site through this exact URL; the binding must serve the path whatever the published origin is.
      await writeFile(resolve(root, 'worker.mjs'), `export default { fetch(request, env) { return env.ASSETS.fetch(new URL('/binding.json', 'https://assets.invalid')); } };`);
      child = spawn(process.execPath, [resolve(import.meta.dirname, 'host.mts'), 'cloudflare', resolve(root, 'dist'), origin], { cwd: root, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
      let log = '';
      child.stderr?.on('data', chunk => { log += String(chunk); });
      const next = () => new Promise<Record<string, unknown>>((accept, reject) => {
        const timer = setTimeout(() => { child?.kill('SIGKILL'); reject(new Error(`Host timed out: ${log}`)); }, 10_000);
        const exited = () => { clearTimeout(timer); reject(new Error(`Host exited: ${log}`)); };
        child!.once('exit', exited);
        child!.once('message', message => { clearTimeout(timer); child!.off('exit', exited); accept(object(message)); });
      });
      assert.equal((await next()).ready, true);
      const reply = next();
      child.send(JSON.stringify({ path: '/binding', method: 'GET', headers: {} }));
      const answer = await reply;
      assert.equal(answer.status, 200, log);
      assert.equal(Buffer.from(String(answer.bytes), 'base64').toString(), '{"binding":true}');
    } finally {
      if (child && child.exitCode === null) {
        const exited = new Promise<void>(accept => child!.once('exit', () => accept()));
        child.kill('SIGTERM');
        await exited;
      }
      await rm(root, { recursive: true, force: true });
    }
  }
});
