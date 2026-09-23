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
    assert.equal(result.sources?.[0]?.koaid, 'N2.20090805.31896.fits');
    assert.equal(result.sources?.[1]?.koaid, 'OI.20200101.00001.fits');
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

test('Gemini counts exact public science labels, deduplicates spelling variants, and treats HTTP rejection as unavailable', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'gemini-leads-'));
  try {
    const row = { object: 'HR8799', telescope: 'Gemini-North', instrument: 'NIRI', observation_class: 'science', data_label: 'GN-1-001' };
    const good: typeof fetch = async () => new Response(JSON.stringify([row, { ...row, observation_class: 'acq', data_label: 'GN-1-002' }]),
      { headers: { 'content-type': 'application/json' } });
    const result = await searchGeminiLeads(root, target, good);
    assert.equal(result.state, 'sampled');
    assert.deepEqual(result.instruments.map(item => [item.telescope, item.instrument, item.records]), [['Gemini-North', 'NIRI', 1]]);
    const unavailable = await searchGeminiLeads(root, target, async () => new Response('blocked', { status: 403 }));
    assert.equal(unavailable.state, 'unavailable');
    assert.equal(unavailable.instruments.length, 0);
  } finally { await rm(root, { recursive: true, force: true }); }
});
