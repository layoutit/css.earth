import '../test-support/index.mts';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { readToolchainPins } from '@cssearth/telescope-core/node';

async function fixture() {
  const root = await mkdtemp(resolve(tmpdir(), 'keck-provisioning-'));
  const pins = readToolchainPins('astroquery', 'toolchain.json'), e = pins.entry;
  const versions = [e.astroquery, e.pyvo, e.scipy, e.batman, e.orbitize, e.whereistheplanet, e.cdflib, e.pyuvdata, e.astropyHealpix].join(' ');
  const python = `#!${process.execPath}
const args = process.argv.slice(2);
if (args.includes('-I') && args.includes('-c')) console.log('3.12.1');
else if (args[0] === '-c' && args[1].includes('print(astroquery.__version__')) console.log(${JSON.stringify(versions)});
else if (args[0] === '-c') {
  let text = ''; process.stdin.setEncoding('utf8'); process.stdin.on('data', chunk => { text += chunk; });
  process.stdin.on('end', () => {
    const request = JSON.parse(text);
    if (request.operation !== 'tap-query') throw new Error('Expected the real default KOA TAP query');
    console.log(JSON.stringify({ schema: 'cssearth-astroquery-answer@2', astroquery: ${JSON.stringify(e.astroquery)}, pyvo: ${JSON.stringify(e.pyvo)},
      operation: request.operation, tap: { queryStatus: 'OK', complete: true },
      rows: request.query.includes('SELECT TOP') ? [{ koaid: 'N2.20090805.31896.fits', targname: 'Fixture', koaimtyp: 'object',
        filehand: '/NIRC2/20090805/lev0/N2.20090805.31896.fits', date_obs: '2009-08-05' }] : [{ targname: 'Fixture', frames: '1' }] }));
  });
}
`;
  const mamba = resolve(root, 'micromamba'), creations = resolve(root, 'creations');
  await writeFile(mamba, `#!${process.execPath}
const fs = require('node:fs'), path = require('node:path'), args = process.argv.slice(2);
const prefix = args[args.indexOf('-p') + 1];
if (args[0] !== 'create' || !prefix) throw new Error('Unexpected installer invocation');
fs.appendFileSync(${JSON.stringify(creations)}, 'create\\n');
fs.mkdirSync(path.join(prefix, 'bin'), { recursive: true });
fs.writeFileSync(path.join(prefix, 'bin/python'), ${JSON.stringify(python)}, { mode: 0o755 });
`, { mode: 0o755 });
  const scratch = resolve(root, 'scratch'); await mkdir(scratch);
  const env: NodeJS.ProcessEnv = { ...process.env, CSSEARTH_TELESCOPE_HOME: root, CSSEARTH_TELESCOPE_MICROMAMBA: mamba,
    CSSEARTH_TELESCOPE_TOOLCHAIN_HOME: resolve(root, 'missing-legacy'), CSS_EARTH_ASTROQUERY_CACHE: resolve(root, 'missing-cache'),
    TMPDIR: scratch, TMP: scratch, TEMP: scratch };
  delete env.CSSEARTH_WORKSPACE;
  const run = (extraEnv: NodeJS.ProcessEnv = {}) => spawnSync(process.execPath,
    ['--import', resolve('packages/core/src/node/register-vite-suffix.mts'), '--input-type=module', '-e', `
import assert from 'node:assert/strict';
import { astroqueryToolchainSync } from '@cssearth/telescope-core/node';
import { searchKeckLeads } from ${JSON.stringify(new URL('./archive-leads.mts', import.meta.url).href)};
assert.throws(() => astroqueryToolchainSync(), /not installed/);
const answer = await searchKeckLeads(${JSON.stringify(root)}, undefined, undefined, { instrument: 'nirc2' }, { raDeg: 1, decDeg: 2, radiusDeg: 0.1 });
console.log(JSON.stringify(answer));
`], { env: { ...env, ...extraEnv }, encoding: 'utf8', timeout: 15_000 });
  return { root, creations, run, cleanup: () => rm(root, { recursive: true, force: true }) };
}

test('default Keck discovery provisions a missing toolchain before its real KOA query', async () => {
  const f = await fixture();
  try {
    const result = f.run();
    assert.equal(result.status, 0, result.stderr);
    const answer = JSON.parse(result.stdout);
    assert.equal(answer.state, 'sampled', answer.reason);
    assert.equal(answer.sources.length, 1);
    assert.equal(await readFile(f.creations, 'utf8'), 'create\n', 'the real async getter must invoke the installer once');
    assert.equal(answer.sources[0].koaid, 'N2.20090805.31896.fits');
  } finally { await f.cleanup(); }
});

test('default Keck discovery preserves a source-build prerequisite failure as unavailable', async () => {
  const f = await fixture();
  try {
    const result = f.run({ PATH: f.root, CC: resolve(f.root, 'missing-compiler'), SDKROOT: '/' });
    assert.equal(result.status, 0, result.stderr);
    const answer = JSON.parse(result.stdout);
    assert.equal(answer.state, 'unavailable');
    assert.match(answer.reason, /^Managed source-build prerequisite: .*working C compiler/u);
    await assert.rejects(access(f.creations), { code: 'ENOENT' });
  } finally { await f.cleanup(); }
});
