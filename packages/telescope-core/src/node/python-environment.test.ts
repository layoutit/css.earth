import assert from 'node:assert/strict';
import * as childProcess from 'node:child_process';
import { spawn as realSpawn, type SpawnOptions } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test, { mock } from 'node:test';
import { USER_ROOT, telescopePythonEnvironment } from './paths.js';

// Execute a real child in place of Python, so its environment and filesystem side effects are observable.
const probe = `const fs = require('node:fs'); process.stdin.resume(); process.stdin.on('end', () => {
 const env = Object.fromEntries(['HOME','USERPROFILE','XDG_CACHE_HOME','XDG_CONFIG_HOME','MPLCONFIGDIR','TMPDIR','TMP','TEMP'].map(key => [key, process.env[key]]));
 for (const key of ['HOME','XDG_CACHE_HOME','XDG_CONFIG_HOME','TMPDIR']) { if (!env[key]?.startsWith(${JSON.stringify(USER_ROOT + '/')})) process.exit(7); fs.mkdirSync(env[key], { recursive: true }); fs.writeFileSync(require('node:path').join(env[key], 'subprocess-probe'), key); }
 process.stdout.write(JSON.stringify(env)); });`;

test('Astroquery and PDS default subprocesses inherit user-root homes, caches, config and temp', async () => {
  const replacement = mock.module('node:child_process', { namedExports: {
    ...childProcess,
    spawn: (_python: string, _args: readonly string[], options: SpawnOptions) => realSpawn(process.execPath, ['-e', probe], options),
  } });
  try {
    const { runAstroqueryProcess } = await import('./astroquery.js');
    const { runPdsPackageProcess } = await import('./pds-client.js');
    const expected = telescopePythonEnvironment();
    for (const run of [
      () => runAstroqueryProcess('python', {}, { operation: 'tap-query', service: 'https://example.org/tap', query: 'SELECT 1' }),
      () => runPdsPackageProcess('python', {}, { operation: 'discover-target', targetLid: 'urn:nasa:pds:test' }),
    ]) {
      const actual = await run(); assert.ok(actual && typeof actual === 'object');
      for (const key of ['HOME','USERPROFILE','XDG_CACHE_HOME','XDG_CONFIG_HOME','MPLCONFIGDIR','TMPDIR','TMP','TEMP']) {
        assert.equal(Reflect.get(actual, key), expected[key]);
        assert.ok(String(Reflect.get(actual, key)).startsWith(`${USER_ROOT}/`));
      }
      for (const key of ['HOME','XDG_CACHE_HOME','XDG_CONFIG_HOME','TMPDIR']) assert.equal(await readFile(resolve(expected[key]!, 'subprocess-probe'), 'utf8'), key);
    }
  } finally { replacement.restore(); }
});
