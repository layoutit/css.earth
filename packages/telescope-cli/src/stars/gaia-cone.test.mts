import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GAIA_CONE_SCHEMA, gaiaCone, gaiaConeQuery, parseGaiaConeRows, readGaiaConeRequest } from './gaia-cone.mts';
import { parseCli } from '../cli-arguments.mts';

const row = (overrides: Record<string, string> = {}): Record<string, string> => ({ source_id: '4157149651519003392', ra: '256.41', dec: '-10.14',
  pmra: '1.5', pmdec: '-2.25', parallax: '1.2', parallax_error: '0.05', phot_g_mean_mag: '12.5', phot_bp_mean_mag: '13.0', phot_rp_mean_mag: '11.8',
  ruwe: '1.01', r_med_geo: '820', r_lo_geo: '790', r_hi_geo: '850', ...overrides });

test('the cone query bounds the circle and the G limit before the brightest rows join their distances', () => {
  const query = gaiaConeQuery(readGaiaConeRequest({ raDeg: 350.85, decDeg: 58.815, radiusDeg: 0.25, magnitudeLimit: 15, limit: 300 }));
  assert.match(query, /CIRCLE\('ICRS',350\.85,58\.815,0\.25\)/);
  assert.match(query, /phot_g_mean_mag<15\)/);
  // One row past the limit: its presence is how a cut answer is told from a whole one.
  assert.match(query, /SELECT TOP 301 /);
  assert.match(query, /LEFT OUTER JOIN gedr3dist\.main AS d ON c\.source_id=d\.source_id ORDER BY c\.phot_g_mean_mag,c\.source_id$/);
  assert.throws(() => readGaiaConeRequest({ raDeg: 360, decDeg: 0, radiusDeg: 1 }), RangeError);
  assert.throws(() => readGaiaConeRequest({ raDeg: 1, decDeg: 0, radiusDeg: 0 }), RangeError);
  assert.throws(() => readGaiaConeRequest({ raDeg: 1, decDeg: 0, radiusDeg: 1, limit: 1.5 }), RangeError);
});

test('a row parses to a star: color from BP and RP, absent values null, a distance only with its percentiles', () => {
  const [star, bare] = parseGaiaConeRows([row(), row({ source_id: '4157149651519003393', pmra: '', pmdec: '', parallax: '', parallax_error: '', phot_bp_mean_mag: '', ruwe: '', r_med_geo: '', r_lo_geo: '', r_hi_geo: '' })]);
  assert.equal(star!.sourceId, '4157149651519003392');
  assert.equal(star!.raDeg, 256.41); assert.equal(star!.decDeg, -10.14);
  assert.ok(Math.abs(star!.bpRp! - 1.2) < 1e-12);
  assert.deepEqual([star!.parallaxMas, star!.distancePc, star!.distanceLowerPc, star!.distanceUpperPc], [1.2, 820, 790, 850]);
  assert.deepEqual([bare!.pmRaMasYr, bare!.parallaxMas, bare!.bpRp, bare!.ruwe, bare!.distancePc], [null, null, null, null, null]);
  assert.throws(() => parseGaiaConeRows([row({ source_id: 'Gaia 1' })]), /not a Gaia DR3 identity/);
  assert.throws(() => parseGaiaConeRows([row(), row()]), /repeated/);
  assert.throws(() => parseGaiaConeRows([row({ ra: '' })]), /ra is not a number/);
  assert.throws(() => parseGaiaConeRows([row({ r_lo_geo: '900' })]), /do not bracket/);
});

test('the cone asks one row past its limit, says when it was cut, and keeps the answer at --out', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'gaia-cone-'));
  const asked: { query: string; maxrec?: number; mode?: string }[] = [];
  // The archive answers as ADQL does: never more rows than the query's TOP, whatever maxrec allows.
  const held = [row(), row({ source_id: '4157149651519003393' })];
  const rows = async (_service: string, query: string, maxrec?: number, mode?: 'async') => {
    asked.push({ query, maxrec, mode }); return held.slice(0, Math.min(Number(/SELECT TOP (\d+) /.exec(query)![1]), maxrec ?? Infinity));
  };
  const cone = await gaiaCone(readGaiaConeRequest({ raDeg: 256.4, decDeg: -10.1, radiusDeg: 0.1, limit: 1 }), { out: join(directory, 'cone.json'), rows });
  assert.deepEqual(asked.map(call => ({ maxrec: call.maxrec, mode: call.mode })), [{ maxrec: 2, mode: 'async' }]);
  assert.equal(cone.truncated, true); assert.equal(cone.stars.length, 1);
  // A field that holds no more than the limit is whole.
  const whole = await gaiaCone(readGaiaConeRequest({ raDeg: 256.4, decDeg: -10.1, radiusDeg: 0.1, limit: 2 }), { rows });
  assert.equal(whole.truncated, false); assert.equal(whole.stars.length, 2);
  const saved = JSON.parse(await readFile(join(directory, 'cone.json'), 'utf8'));
  assert.equal(saved.schema, GAIA_CONE_SCHEMA); assert.equal(saved.stars[0].sourceId, '4157149651519003392');
});

test('telescope gaia-cone reads RA,DEC,RADIUS as one argument, so a southern declination is not an option', () => {
  assert.deepEqual(parseCli(['gaia-cone', '256.408,-10.143,0.2', '--magnitude-limit', '15', '--limit', '400', '--out', '/tmp/cone.json']),
    { command: 'gaia-cone', raDeg: 256.408, decDeg: -10.143, radiusDeg: 0.2, magnitudeLimit: 15, limit: 400, out: '/tmp/cone.json', json: false, verbose: false });
  assert.throws(() => parseCli(['gaia-cone', '256.408', '-10.143']), TypeError);
  assert.throws(() => parseCli(['gaia-cone', '400,0,1']), RangeError);
});
