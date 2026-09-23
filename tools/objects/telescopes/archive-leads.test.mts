import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { searchGeminiLeads, searchKeckLeads } from './archive-leads.mts';

const target = { id: 'hr-8799', name: 'HR 8799', aliases: [] };

test('Keck reports counts and bounded exact public FITS sources without claiming qualification', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'koa-leads-'));
  const queries: string[] = [];
  try {
    const result = await searchKeckLeads(root, target, async query => {
      queries.push(query);
      if (query.includes('koa_osiris')) return query.includes('SELECT TOP')
        ? [{ koaid: 'OI.20200101.00001.fits', targname: 'HR 8799', koaimtyp: 'object',
          filehand: '/OSIRIS/2020/20200101/lev0/OI.20200101.00001.fits', date_obs: '2020-01-01 00:00:00' }]
        : [{ targname: 'HR 8799', frames: '1' }];
      if (!query.includes('koa_nirc2')) return [];
      return query.includes('SELECT TOP') ? [{ koaid: 'N2.20090805.31896.fits', targname: 'HR8799', koaimtyp: 'object',
        filehand: '/koadata9/NIRC2/20090805/lev0/N2.20090805.31896.fits', date_obs: '2009-08-05 00:00:00' }] : [{ targname: 'HR8799', frames: '8' }];
    });
    assert.equal(queries.length, 16);
    assert.match(queries[0]!, /'HR 8799','HR8799','HR-8799'/u);
    assert.equal(result.state, 'sampled');
    assert.deepEqual(result.instruments.map(item => [item.instrument, item.records]), [['NIRC2', 8], ['OSIRIS', 1]]);
    const first = result.sources?.[0], second = result.sources?.[1];
    assert.ok(first && 'koaid' in first && second && 'koaid' in second);
    assert.equal(first.koaid, 'N2.20090805.31896.fits');
    assert.equal(second.koaid, 'OI.20200101.00001.fits');
    assert.equal(result.evidence?.length, 16);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('Keck keeps searching other instrument tables after an incomplete empty response', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'koa-partial-'));
  const queries: string[] = [];
  try {
    const result = await searchKeckLeads(root, target, async query => {
      queries.push(query);
      if (query.includes('koa_deimos') || query.includes('koa_esi')) throw new Error('TAP query was incomplete (OVERFLOW)');
      if (!query.includes('koa_nirc2')) return [];
      return query.includes('SELECT TOP') ? [{ koaid: 'N2.20090805.31896.fits', targname: 'HR8799', koaimtyp: 'object',
        filehand: '/koadata9/NIRC2/20090805/lev0/N2.20090805.31896.fits', date_obs: '2009-08-05 00:00:00' }] : [{ targname: 'HR8799', frames: '3' }];
    });
    assert.equal(queries.length, 15);
    assert.equal(result.state, 'overflow');
    assert.deepEqual(result.instruments.map(item => [item.instrument, item.records]), [['NIRC2', 3]]);
    assert.match(result.reason, /koa_deimos.*OVERFLOW/u);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('Gemini uses public CADC artifact identities and does not turn an unavailable mirror into an empty result', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'gemini-leads-'));
  try {
    const row = { observationID: 'GN-1-001', type: 'OBJECT', intent: 'science', instrument_name: 'NIRI',
      target_name: 'HR8799', uri: 'gemini:GEMINI/N20200101S0001.fits', contentLength: '2880',
      contentChecksum: 'md5:00000000000000000000000000000000', energy_bandpassName: 'K', time_exposure: '30',
      time_bounds_lower: '58849', dataRelease: '2021-01-01T00:00:00.000' };
    const result = await searchGeminiLeads(root, target, async adql => {
      assert.match(adql, /o\.target_name IN \('HR 8799','HR8799','HR-8799'\)/u);
      return [row, row, { ...row, uri: 'gemini:GEMINI/gN20200101S0001_bias.fits' }];
    });
    assert.equal(result.state, 'sampled');
    assert.deepEqual(result.instruments.map(item => [item.telescope, item.instrument, item.records]), [['Gemini North', 'NIRI', 1]]);
    const source = result.sources?.[0]; assert.ok(source && 'uri' in source);
    assert.equal(source.uri, row.uri);
    const unavailable = await searchGeminiLeads(root, target, async () => { throw new Error('CADC timeout'); });
    assert.equal(unavailable.state, 'unavailable');
    assert.equal(unavailable.instruments.length, 0);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('archive source filters narrow Keck tables and Gemini rows before their samples', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'filtered-leads-'));
  const time = { fromIso: '2009-08-01T00:00:00.000Z', toIso: '2009-08-31T23:59:59.000Z' };
  try {
    const keckQueries: string[] = [];
    const keck = await searchKeckLeads(root, target, async adql => {
      keckQueries.push(adql);
      return adql.includes('COUNT(*)') ? [{ targname: 'HR 8799', frames: '1' }]
        : [{ koaid: 'N2.20090805.31896.fits', targname: 'HR 8799', koaimtyp: 'object',
          filehand: '/koadata9/NIRC2/20090805/lev0/N2.20090805.31896.fits', date_obs: '2009-08-05' }];
    }, { instrument: 'NIRC2', time });
    assert.equal(keckQueries.length, 2);
    assert.ok(keckQueries.every(query => query.includes('koa_nirc2') && query.includes("date_obs BETWEEN '2009-08-01' AND '2009-08-31'")));
    assert.equal(keck.sources?.length, 1);
    const gemini = await searchGeminiLeads(root, target, async adql => {
      assert.match(adql, /o\.instrument_name='NIRI'/u);
      const bounds = adql.match(/p\.time_bounds_upper >= ([\d.]+) AND p\.time_bounds_lower <= ([\d.]+)/u);
      assert.ok(bounds);
      assert.equal(Number(bounds[1]), Date.parse(time.fromIso) / 86_400_000 + 40_587);
      assert.equal(Number(bounds[2]), Date.parse(time.toIso) / 86_400_000 + 40_587);
      return [];
    }, { instrument: 'NIRI', time });
    assert.equal(gemini.state, 'empty-in-scope');
  } finally { await rm(root, { recursive: true, force: true }); }
});
