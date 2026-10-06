import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { searchGeminiLeads, searchKeckLeads } from './archive-leads.mts';
import { FRESH_VARIABLE } from '../archives/memory.mts';

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
      energy_bandpassName: 'K', time_exposure: '30',
      time_bounds_lower: '58849', dataRelease: '2021-01-01T00:00:00.000' };
    const result = await searchGeminiLeads(root, target, async adql => {
      assert.match(adql, /o\.target_name IN \('HR 8799','HR8799','HR-8799'\)/u);
      return [row, row, { ...row, uri: 'gemini:GEMINI/gN20200101S0001_bias.fits' }];
    });
    assert.equal(result.state, 'sampled');
    assert.deepEqual(result.instruments.map(item => [item.telescope, item.instrument, item.records]), [['Gemini North', 'NIRI', 1]]);
    const source = result.sources?.[0]; assert.ok(source && 'uri' in source);
    assert.equal(source.uri, row.uri);
    // The answer above is saved, so only a fresh asking meets the mirror that is down.
    process.env[FRESH_VARIABLE] = '1';
    const unavailable = await searchGeminiLeads(root, target, async () => { throw new Error('CADC timeout'); });
    assert.equal(unavailable.state, 'unavailable');
    assert.equal(unavailable.instruments.length, 0);
  } finally { delete process.env[FRESH_VARIABLE]; await rm(root, { recursive: true, force: true }); }
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

test('with a place on the sky, Keck and Gemini are asked by name and by place, and a spelling only the place finds is reported', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'place-leads-'));
  const position = { raDeg: 346.8696, decDeg: 21.1343, radiusDeg: 0.5 / 60 }, koa: string[] = [], cadc: string[] = [];
  try {
    const keck = await searchKeckLeads(root, target, async query => {
      koa.push(query);
      if (!query.includes('koa_nirc2')) return [];
      const placed = query.includes('CONTAINS(');
      if (query.includes('SELECT TOP')) return [{ koaid: 'N2.20090805.31896.fits', targname: 'hd 218396', koaimtyp: 'object', filehand: '/koadata9/NIRC2/20090805/lev0/N2.20090805.31896.fits', date_obs: '2009-08-05 00:00:00' }];
      return placed ? [{ targname: 'HR8799', frames: '6' }, { targname: 'hd 218396', frames: '113' }, { targname: '', frames: '2' }] : [{ targname: 'HR8799', frames: '8' }];
    }, undefined, position);
    assert.equal(koa.filter(query => query.includes("CIRCLE('ICRS', 346.8696, 21.1343, 0.008333333333333333)")).length, 15, '14 counts by place and one sample');
    assert.ok(koa.every(query => !(query.includes('targname IN') && query.includes('CONTAINS('))), 'never both conditions in one query');
    // HR8799 by name holds the six the place found; the place adds the two spellings no name search tries.
    assert.deepEqual(keck.instruments.map(item => [item.sample, item.records]), [['HR8799', 8], ['hd 218396', 113], ['(no target name)', 2]]);
    assert.match(keck.scope, /within 30 arcsec of the target's position/u);
    const lead = keck.sources?.[0];
    assert.ok(lead && 'koaid' in lead && lead.targetName === 'hd 218396');

    const frame = (name: string, target_name: string) => ({ observationID: name.slice(0, -5), type: 'OBJECT', intent: 'science', instrument_name: 'GPI', target_name,
      uri: `gemini:GEMINI/${name}`, contentLength: '2880', energy_bandpassName: 'H', time_exposure: '60', time_bounds_lower: '56962', dataRelease: '2016-01-01T00:00:00.000' });
    const gemini = await searchGeminiLeads(root, target, async query => { cadc.push(query); return query.includes('INTERSECTS(')
      ? [frame('S20141101S0001.fits', 'HR 8799'), frame('S20141101S0002.fits', 'HD218396')] : [frame('S20141101S0001.fits', 'HR 8799')]; }, undefined, position);
    assert.equal(cadc.length, 2);
    // The two are asked at once, so either may be recorded first.
    assert.equal(cadc.filter(query => /INTERSECTS\(CIRCLE\('ICRS', 346\.8696, 21\.1343, 0\.008333333333333333\), p\.position_bounds\) = 1/u.test(query)).length, 1);
    assert.equal(cadc.filter(query => query.includes("o.target_name IN ('HR 8799','HR8799','HR-8799')")).length, 1);
    assert.deepEqual(gemini.instruments.map(item => [item.instrument, item.records]), [['GPI', 2]]);
    assert.equal(gemini.evidence?.length, 2);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('a second search within a day is answered from the saved answers, says so, and --fresh asks the archive again', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'remembered-leads-'));
  let asked = 0;
  const koa = async (query: string) => { asked++; return query.includes('koa_nirc2') && !query.includes('SELECT TOP') ? [{ targname: 'HR8799', frames: '8' }]
    : query.includes('SELECT TOP') ? [{ koaid: 'N2.20090805.31896.fits', targname: 'HR8799', koaimtyp: 'object', filehand: '/koadata9/NIRC2/20090805/lev0/N2.20090805.31896.fits', date_obs: '2009-08-05 00:00:00' }] : []; };
  try {
    const first = await searchKeckLeads(root, target, koa);
    assert.equal(asked, 15); assert.doesNotMatch(first.reason, /saved ones/u);
    const second = await searchKeckLeads(root, target, koa);
    assert.equal(asked, 15, 'no table is asked again');
    assert.match(second.reason, /15 answer\(s\) are saved ones from the last day; --fresh asks again\./u);
    assert.deepEqual([second.state, second.instruments, second.sources, second.evidence], [first.state, first.instruments, first.sources, first.evidence]);
    process.env[FRESH_VARIABLE] = '1';
    await searchKeckLeads(root, target, koa);
    assert.equal(asked, 30);
  } finally { delete process.env[FRESH_VARIABLE]; await rm(root, { recursive: true, force: true }); }
});
